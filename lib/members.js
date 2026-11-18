import { ensureAccess } from "./access"
import { query } from "./db"
import { decryptMember, encryptMember } from "./member-secret"

let ready = null

export function ensureMembers() {
  ready ??= ensureAccess()
    .then(() =>
      query(`
        CREATE TABLE IF NOT EXISTS members (
          id SERIAL PRIMARY KEY,
          payload TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by INTEGER REFERENCES users(id)
        )
      `),
    )
    .catch((error) => {
      ready = null
      throw error
    })
  return ready
}

function visibleMember(row, data) {
  return {
    id: row.id,
    familyName: data.familyName ?? "",
    givenName: data.givenName ?? "",
    furtherNames: data.furtherNames ?? "",
    street: data.street ?? "",
    houseNumber: data.houseNumber ?? "",
    postalCode: data.postalCode ?? "",
    city: data.city ?? "",
    email: data.email ?? "",
    contributionCents: data.contributionCents,
    signedPlace: data.signedPlace ?? "",
    signedOn: data.signedOn ?? "",
    bankName: data.bankName ?? "",
    accountHolder: data.accountHolder ?? "",
    ibanStored: Boolean(data.iban),
  }
}

export async function listMembers() {
  await ensureMembers()
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
  await ensureMembers()
  const stored = { ...data }
  delete stored.children
  delete stored.childFamilyName
  delete stored.childGivenName
  await query(
    `INSERT INTO members (payload, created_by) VALUES ($1, $2)`,
    [encryptMember(stored), userId],
  )
}
