import { query } from "./db"
import { decryptMember, encryptMember } from "./member-secret"
import { parseEuroToCents } from "./money"

const storedKeys = [
  "memberNumber",
  "familyName",
  "givenName",
  "email",
  "contributionCents",
  "joinedOn",
  "mandateId",
  "bic",
  "bankName",
  "iban",
  "accountHolder",
]

const bankKeys = ["bic", "bankName", "iban", "accountHolder"]

export function withoutBankData(member) {
  if (!member) return null
  const copy = { ...member }
  for (const key of bankKeys) delete copy[key]
  delete copy.mandateText
  delete copy.mandateAcceptedAt
  return copy
}

export function preserveBankData(data, existing) {
  return {
    ...data,
    bic: existing?.bic ?? "",
    bankName: existing?.bankName ?? "",
    iban: existing?.iban ?? "",
    accountHolder: existing?.accountHolder ?? "",
    mandateText: existing?.mandateText ?? "",
    mandateAcceptedAt: existing?.mandateAcceptedAt ?? "",
  }
}

export function familyLetter(name) {
  const folded = String(name ?? "")
    .trim()
    .charAt(0)
    .toLocaleUpperCase("de")
    .replace("Ä", "A")
    .replace("Ö", "O")
    .replace("Ü", "U")
  const letter = folded === "SS" || folded === "ẞ" ? "S" : folded.charAt(0)
  return /^[A-Z]$/.test(letter) ? letter : ""
}

export function splitEmails(value) {
  return String(value ?? "")
    .split(/[;,\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.includes("@"))
}

function visibleMember(row, data) {
  return {
    id: row.id,
    memberNumber: data.memberNumber ?? "",
    familyName: data.familyName ?? "",
    givenName: data.givenName ?? "",
    email: data.email ?? "",
    contributionCents: data.contributionCents ?? null,
    joinedOn: data.joinedOn ?? "",
    mandateId: data.mandateId ?? "",
    bankName: data.bankName ?? "",
    accountHolder: data.accountHolder ?? "",
    bicStored: Boolean(data.bic),
    ibanStored: Boolean(data.iban),
    letter: familyLetter(data.familyName),
  }
}

function withStatus(row, member) {
  return {
    ...member,
    draft: Object.hasOwn(row, "confirmed_at") ? !row.confirmed_at : false,
    confirmationNote: row.confirmation_note ?? "",
  }
}

function readRows(rows, full) {
  return rows.flatMap((row) => {
    try {
      const data = decryptMember(row.payload)
      const member = full ? { id: row.id, ...data } : visibleMember(row, data)
      return [withStatus(row, member)]
    } catch {
      return full
        ? []
        : [withStatus(row, { id: row.id, unreadable: true, familyName: "", letter: "" })]
    }
  })
}

function berlinDay(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export async function listMembershipEvents() {
  const { rows } = await query(
    `SELECT payload, deleted_at FROM members WHERE confirmed_at IS NOT NULL`,
  )
  return rows.map((row) => {
    let joinedOn = ""
    try {
      joinedOn = decryptMember(row.payload).joinedOn ?? ""
    } catch {
      joinedOn = ""
    }
    return { joinedOn, leftOn: row.deleted_at ? berlinDay(row.deleted_at) : "" }
  })
}

export function foldMemberName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("de")
}

export async function memberNameExists(givenName, familyName) {
  const given = foldMemberName(givenName)
  const family = foldMemberName(familyName)
  if (!given || !family) return false
  const { rows } = await query(
    `SELECT payload FROM members WHERE deleted_at IS NULL`,
  )
  for (const row of rows) {
    try {
      const data = decryptMember(row.payload)
      if (foldMemberName(data.givenName) === given && foldMemberName(data.familyName) === family) {
        return true
      }
    } catch {
      // Eine unlesbare Zeile gilt nicht als Treffer.
    }
  }
  return false
}

export async function memberEmailExists(email) {
  const wanted = foldMemberName(email)
  if (!wanted || !wanted.includes("@")) return false
  const { rows } = await query(
    `SELECT payload FROM members WHERE deleted_at IS NULL`,
  )
  for (const row of rows) {
    try {
      const data = decryptMember(row.payload)
      const used = splitEmails(data.email).some((part) => foldMemberName(part) === wanted)
      if (used) return true
    } catch {
      // Eine unlesbare Zeile gilt nicht als Treffer.
    }
  }
  return false
}

export async function countMembers() {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM members WHERE deleted_at IS NULL AND confirmed_at IS NOT NULL`,
  )
  return rows[0]?.count ?? 0
}

export async function listMembers() {
  const { rows } = await query(
    `SELECT id, payload, confirmed_at, confirmation_note FROM members WHERE deleted_at IS NULL`,
  )
  return readRows(rows, false).sort(compareMembers)
}

export async function listMemberRecords() {
  const { rows } = await query(
    `SELECT id, payload, confirmed_at, confirmation_note
     FROM members
     WHERE deleted_at IS NULL AND confirmed_at IS NOT NULL`,
  )
  return readRows(rows, true).sort(compareMembers)
}

export async function listDeletedMembers() {
  const { rows } = await query(`SELECT id, payload FROM members WHERE deleted_at IS NOT NULL`)
  return readRows(rows, false)
    .map((member) => ({
      id: member.id,
      familyName: member.familyName ?? "",
      givenName: member.givenName ?? "",
      unreadable: Boolean(member.unreadable),
    }))
    .sort(compareMembers)
}

export async function getMember(id) {
  const { rows } = await query(
    `SELECT id, payload, confirmed_at, confirmation_note
     FROM members
     WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  )
  if (!rows[0]) return null
  try {
    return withStatus(rows[0], { id: rows[0].id, ...decryptMember(rows[0].payload) })
  } catch {
    return null
  }
}

function compareMembers(a, b) {
  const family = String(a.familyName ?? "").localeCompare(String(b.familyName ?? ""), "de")
  if (family) return family
  return String(a.givenName ?? "").localeCompare(String(b.givenName ?? ""), "de")
}

function limited(value, max) {
  return String(value ?? "").trim().slice(0, max)
}

function cleanIban(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
}

export function memberFromFields(fields) {
  const familyName = limited(fields.familyName, 80)
  const givenName = limited(fields.givenName, 80)
  const email = limited(fields.email, 240)
  const iban = cleanIban(fields.iban)
  const joinedOn = limited(fields.joinedOn, 10)
  const contributionCents = parseEuroToCents(fields.contribution)
  const addresses = email.split(/[;,\s]+/).filter(Boolean)
  if (
    familyName.length < 1 ||
    givenName.length < 1 ||
    contributionCents == null ||
    addresses.some((part) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)) ||
    (iban && !/^DE\d{20}$/.test(iban)) ||
    (joinedOn && !/^\d{4}-\d{2}-\d{2}$/.test(joinedOn))
  ) {
    return null
  }
  const data = {
    memberNumber: limited(fields.memberNumber, 20),
    familyName,
    givenName,
    email,
    contributionCents,
    joinedOn,
    mandateId: limited(fields.mandateId, 40),
    bic: limited(fields.bic, 11).toUpperCase(),
    bankName: limited(fields.bankName, 120),
    iban,
    accountHolder: limited(fields.accountHolder, 120),
  }
  for (const key of Object.keys(data)) {
    if (!storedKeys.includes(key)) delete data[key]
  }
  return data
}

export async function insertMember(userId, data, options = {}) {
  const draft = Boolean(options.draft)
  const result = await query(
    `INSERT INTO members (
       payload, created_by, confirmed_at, confirm_hash, confirm_expires_at, confirmation_note
     )
     VALUES (
       $1, $2,
       CASE WHEN $3 THEN NULL ELSE NOW() END,
       $4,
       CASE WHEN $3 THEN NOW() + INTERVAL '48 hours' ELSE NULL END,
       $5
     )
     RETURNING id`,
    [encryptMember(data), userId, draft, options.confirmHash ?? null, options.note || null],
  )
  return result.rows[0].id
}

export async function replaceDraftConfirmation(id, data, confirmHash, note) {
  const result = await query(
    `UPDATE members
     SET payload = $2, confirm_hash = $3, confirm_expires_at = NOW() + INTERVAL '48 hours',
         confirmation_note = $4
     WHERE id = $1 AND confirmed_at IS NULL AND deleted_at IS NULL`,
    [id, encryptMember(data), confirmHash, note || null],
  )
  return result.rowCount > 0
}

export async function updateMember(id, data) {
  const result = await query(`UPDATE members SET payload = $2 WHERE id = $1`, [
    id,
    encryptMember(data),
  ])
  return result.rowCount > 0
}

export async function markMemberDeleted(id) {
  const result = await query(
    `UPDATE members SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  )
  return result.rowCount > 0
}

export async function restoreMember(id) {
  const result = await query(
    `UPDATE members SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL`,
    [id],
  )
  return result.rowCount > 0
}
