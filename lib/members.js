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
  return copy
}

export function preserveBankData(data, existing) {
  return {
    ...data,
    bic: existing?.bic ?? "",
    bankName: existing?.bankName ?? "",
    iban: existing?.iban ?? "",
    accountHolder: existing?.accountHolder ?? "",
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

function readRows(rows, full) {
  return rows.flatMap((row) => {
    try {
      const data = decryptMember(row.payload)
      return [full ? { id: row.id, ...data } : visibleMember(row, data)]
    } catch {
      return full ? [] : [{ id: row.id, unreadable: true, familyName: "", letter: "" }]
    }
  })
}

export async function countMembers() {
  const { rows } = await query(`SELECT COUNT(*)::int AS count FROM members`)
  return rows[0]?.count ?? 0
}

export async function listMembers() {
  const { rows } = await query(`SELECT id, payload FROM members`)
  return readRows(rows, false).sort(compareMembers)
}

export async function listMemberRecords() {
  const { rows } = await query(`SELECT id, payload FROM members`)
  return readRows(rows, true).sort(compareMembers)
}

export async function getMember(id) {
  const { rows } = await query(`SELECT id, payload FROM members WHERE id = $1`, [id])
  if (!rows[0]) return null
  try {
    return { id: rows[0].id, ...decryptMember(rows[0].payload) }
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

export async function insertMember(userId, data) {
  await query(`INSERT INTO members (payload, created_by) VALUES ($1, $2)`, [
    encryptMember(data),
    userId,
  ])
}

export async function updateMember(id, data) {
  const result = await query(`UPDATE members SET payload = $2 WHERE id = $1`, [
    id,
    encryptMember(data),
  ])
  return result.rowCount > 0
}

export async function deleteMember(id) {
  const result = await query(`DELETE FROM members WHERE id = $1`, [id])
  return result.rowCount > 0
}
