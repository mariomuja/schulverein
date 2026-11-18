import { query } from "./db"

let ready = null

async function seedAccess() {
  await query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS members_access TEXT NOT NULL DEFAULT 'none'`,
  )
  await query(
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS members_access_seeded BOOLEAN NOT NULL DEFAULT FALSE`,
  )
  const seeded = await query(
    `SELECT members_access_seeded FROM settings WHERE id = 1`,
  )
  if (seeded.rows[0]?.members_access_seeded) return
  await query(
    `UPDATE users
     SET members_access = 'write'
     WHERE lower(btrim(name)) IN ('mario', 'mario muja')`,
  )
  await query(
    `UPDATE users
     SET members_access = 'write', can_write = FALSE
     WHERE lower(btrim(name)) = 'steffi'`,
  )
  await query(`UPDATE settings SET members_access_seeded = TRUE WHERE id = 1`)
}

export function ensureAccess() {
  ready ??= seedAccess().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export function membersAccess(user) {
  const value = String(user?.members_access ?? "none")
  if (value === "read" || value === "write") return value
  return "none"
}

export function canSeeMembers(user) {
  return membersAccess(user) !== "none"
}

export function canWriteMembers(user) {
  return membersAccess(user) === "write"
}
