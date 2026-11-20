import { randomBytes } from "crypto"
import { headers } from "next/headers"
import { requestOrigin } from "./account-links"
import { query, withTransaction } from "./db"
import { cleanIban, maskIban, validGermanIban } from "./iban.mjs"
import { assessJoinSeal, issueJoinSeal } from "./join-seal.mjs"
import { sendJoinMail } from "./mail.mjs"
import { mandateText } from "./mandate.mjs"
import { decryptMember, encryptMember } from "./member-secret"
import { formatEuro, parseEuroToCents } from "./money"
import { appendLog } from "./seal"
import { hashSecret } from "./secret"

const bicPattern = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function limited(value, max) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max)
}

function todayInBerlin() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

async function requestIpHash() {
  const store = await headers()
  const forwarded = store.get("x-forwarded-for") ?? ""
  const ip = forwarded.split(",")[0].trim() || store.get("x-real-ip") || "unbekannt"
  return hashSecret(`join-ip:${ip}`)
}

export function mandateHash(text) {
  return hashSecret(text).slice(0, 20)
}

export function joinMandate(data) {
  return mandateText({
    amount: `${formatEuro(data.contributionCents)} €`,
    accountHolder: data.accountHolder,
  })
}

function readFields(formData) {
  const familyName = limited(formData.get("familyName"), 80)
  const givenName = limited(formData.get("givenName"), 80)
  const email = String(formData.get("email") ?? "").trim()
  const iban = cleanIban(formData.get("iban"))
  const bic = limited(formData.get("bic"), 11).replace(/\s/g, "").toUpperCase()
  const typedHolder = limited(formData.get("accountHolder"), 120)
  const contributionCents = parseEuroToCents(formData.get("contribution"))
  if (familyName.length < 1 || givenName.length < 1 || email.length > 240 || !emailPattern.test(email)) {
    return { error: "angaben" }
  }
  if (!validGermanIban(iban)) return { error: "iban" }
  if (bic && !bicPattern.test(bic)) return { error: "angaben" }
  if (contributionCents == null || contributionCents > 100000) return { error: "angaben" }
  return {
    data: {
      memberNumber: "",
      familyName,
      givenName,
      email,
      contributionCents,
      joinedOn: "",
      mandateId: "",
      bic,
      bankName: "",
      iban,
      accountHolder: typedHolder || `${givenName} ${familyName}`,
    },
  }
}

async function countOf(sql, params = []) {
  const { rows } = await query(sql, params)
  return rows[0]?.count ?? 0
}

export async function cleanupJoin() {
  await query(`DELETE FROM join_requests WHERE expires_at < NOW()`)
  await query(`DELETE FROM join_nonces WHERE created_at < NOW() - INTERVAL '3 hours'`)
}

export async function issueJoinForm() {
  await cleanupJoin()
  const ipHash = await requestIpHash()
  const ownLoads = await countOf(
    `SELECT COUNT(*)::int AS count FROM join_nonces WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [ipHash],
  )
  const allLoads = await countOf(
    `SELECT COUNT(*)::int AS count FROM join_nonces WHERE created_at > NOW() - INTERVAL '1 hour'`,
  )
  if (ownLoads >= 80 || allLoads >= 500) return { limited: true }
  const ticket = issueJoinSeal()
  await query(`INSERT INTO join_nonces (nonce_hash, ip_hash) VALUES ($1, $2)`, [
    hashSecret(ticket.nonce),
    ipHash,
  ])
  return { limited: false, ...ticket }
}

async function consumeNonce(nonce) {
  const updated = await query(
    `UPDATE join_nonces
     SET used_at = NOW()
     WHERE nonce_hash = $1 AND used_at IS NULL AND created_at > NOW() - INTERVAL '2 hours'
     RETURNING nonce_hash`,
    [hashSecret(nonce)],
  )
  return updated.rowCount > 0
}

async function overLimit(ipHash, emailHash) {
  const own = await countOf(
    `SELECT COUNT(*)::int AS count FROM join_requests WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [ipHash],
  )
  if (own >= 40) return true
  const all = await countOf(
    `SELECT COUNT(*)::int AS count FROM join_requests WHERE created_at > NOW() - INTERVAL '1 hour'`,
  )
  if (all >= 150) return true
  const sameEmail = await countOf(
    `SELECT COUNT(*)::int AS count FROM join_requests WHERE email_hash = $1 AND created_at > NOW() - INTERVAL '1 day'`,
    [emailHash],
  )
  return sameEmail >= 5
}

export async function submitJoinRequest(user, formData) {
  const sealError = assessJoinSeal({
    issued: formData.get("issued"),
    nonce: formData.get("nonce"),
    seal: formData.get("seal"),
  })
  if (sealError) return { error: sealError }
  const nonce = String(formData.get("nonce") ?? "")
  if (!(await consumeNonce(nonce))) return { error: "angaben" }
  if (String(formData.get("fax") ?? "").trim() || formData.get("client") !== "1") {
    return { error: "angaben" }
  }
  const parsed = readFields(formData)
  if (parsed.error) return parsed
  const ipHash = await requestIpHash()
  const emailHash = hashSecret(`join-mail:${parsed.data.email.toLocaleLowerCase("de")}`)
  if (await overLimit(ipHash, emailHash)) return { error: "rate" }

  const token = randomBytes(32).toString("base64url")
  const confirmHash = hashSecret(token)
  try {
    await query(
      `INSERT INTO join_requests (payload, confirm_hash, email_hash, ip_hash, user_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '48 hours')`,
      [encryptMember(parsed.data), confirmHash, emailHash, ipHash, user.id],
    )
  } catch {
    return { error: "angaben" }
  }

  const url = `${await requestOrigin()}/beitritt/bestaetigen/${token}`
  const sent = await sendJoinMail({ to: parsed.data.email, url, givenName: parsed.data.givenName })
  if (!sent) {
    await query(`DELETE FROM join_requests WHERE confirm_hash = $1`, [confirmHash])
    return { error: "mail", reload: true }
  }
  return { ok: true }
}

function publicView(data) {
  return {
    givenName: data.givenName ?? "",
    familyName: data.familyName ?? "",
    email: data.email ?? "",
    contributionCents: data.contributionCents ?? null,
    accountHolder: data.accountHolder ?? "",
    ibanMasked: maskIban(data.iban),
    mandate: joinMandate(data),
  }
}

export async function readJoinRequest(token) {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token ?? "")) return null
  await cleanupJoin()
  const { rows } = await query(
    `SELECT payload, expires_at FROM join_requests WHERE confirm_hash = $1`,
    [hashSecret(token)],
  )
  const row = rows[0]
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null
  try {
    return publicView(decryptMember(row.payload))
  } catch {
    return null
  }
}

async function nextMemberNumber(q) {
  const { rows } = await q(`SELECT payload FROM members`)
  let max = 0
  for (const row of rows) {
    try {
      const value = Number(String(decryptMember(row.payload).memberNumber ?? "").trim())
      if (Number.isInteger(value) && value > max) max = value
    } catch {
      // Eine unlesbare Zeile vergibt keine Nummer.
    }
  }
  return String(max + 1)
}

export async function confirmJoinRequest(token, mandateHashValue) {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token ?? "")) return { error: "ungueltig" }
  try {
    return await withTransaction(async (q) => {
      await q(`SELECT pg_advisory_xact_lock(840221)`)
      const found = await q(
        `SELECT j.id, j.payload, j.expires_at, u.id AS user_id, u.name AS user_name
         FROM join_requests j
         JOIN users u ON u.id = j.user_id
         WHERE j.confirm_hash = $1
         FOR UPDATE OF j`,
        [hashSecret(token)],
      )
      const row = found.rows[0]
      if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
        if (row) await q(`DELETE FROM join_requests WHERE id = $1`, [row.id])
        return { error: "ungueltig" }
      }
      const data = decryptMember(row.payload)
      const text = joinMandate(data)
      if (mandateHashValue !== mandateHash(text)) return { error: "neu" }
      const memberNumber = await nextMemberNumber(q)
      const record = {
        ...data,
        memberNumber,
        mandateId: `${memberNumber}Schulverein`,
        joinedOn: todayInBerlin(),
        mandateText: text,
        mandateAcceptedAt: new Date().toISOString(),
      }
      await q(`INSERT INTO members (payload, created_by) VALUES ($1, $2)`, [
        encryptMember(record),
        row.user_id,
      ])
      await q(`DELETE FROM join_requests WHERE id = $1`, [row.id])
      await appendLog(q, {
        user: { id: row.user_id, name: row.user_name },
        action: "beitritt",
        detail: "Mitgliedschaft und Lastschriftmandat über den Beitrittslink bestätigt.",
      })
      return { ok: true }
    })
  } catch {
    return { error: "ungueltig" }
  }
}
