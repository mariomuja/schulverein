import { query } from "./db"
import { decryptMember, encryptMember } from "./member-secret"

function visibleMember(row, data) {
  return {
    id: row.id,
    familyName: data.familyName ?? "",
    givenName: data.givenName ?? "",
    street: data.street ?? "",
    houseNumber: data.houseNumber ?? "",
    postalCode: data.postalCode ?? "",
    city: data.city ?? "",
    email: data.email ?? "",
    contributionCents: data.contributionCents,
    bankName: data.bankName ?? "",
    accountHolder: data.accountHolder ?? "",
    ibanStored: Boolean(data.iban),
  }
}

export async function listMembers() {
  const { rows } = await query(
    `SELECT id, payload FROM members ORDER BY id DESC`,
  )
  return rows.map((row) => {
    try {
      return visibleMember(row, decryptMember(row.payload))
    } catch {
      return { id: row.id, unreadable: true, ibanStored: false }
    }
  })
}

export async function insertMember(userId, data) {
  const stored = { ...data }
  delete stored.children
  delete stored.childFamilyName
  delete stored.childGivenName
  delete stored.furtherNames
  delete stored.signedPlace
  delete stored.signedOn
  await query(
    `INSERT INTO members (payload, created_by) VALUES ($1, $2)`,
    [encryptMember(stored), userId],
  )
}
