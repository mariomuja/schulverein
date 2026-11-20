import fs from "fs"
import pg from "pg"
import { roleFromDatabaseUrl } from "./archive-schema.mjs"

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && process.env[match[1]] == null) {
      let value = match[2]
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[match[1]] = value
    }
}

if (!process.env.DATABASE_URL_OWNER) {
  console.error("DATABASE_URL_OWNER fehlt")
  process.exit(1)
}

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL_OWNER,
  ssl: { rejectUnauthorized: true },
})
await db.connect()

await db.query(
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS members_access TEXT NOT NULL DEFAULT 'none'`,
)
await db.query(
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0`,
)
await db.query(
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_hint_pending BOOLEAN NOT NULL DEFAULT TRUE`,
)
await db.query(
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS members_access_seeded BOOLEAN NOT NULL DEFAULT FALSE`,
)
await db.query(
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS members_tab_limited BOOLEAN NOT NULL DEFAULT FALSE`,
)
await db.query(
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS members_demo_editors BOOLEAN NOT NULL DEFAULT FALSE`,
)

await db.query(`
  CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
  )
`)
await db.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`)

const appRole = roleFromDatabaseUrl(process.env.DATABASE_URL)
if (appRole && /^[A-Za-z_][A-Za-z0-9_]*$/.test(appRole)) {
  const role = `"${appRole}"`
  await db.query(`GRANT SELECT, UPDATE ON users TO ${role}`)
  await db.query(`GRANT SELECT, UPDATE ON settings TO ${role}`)
  await db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON members TO ${role}`)
  await db.query(`GRANT USAGE, SELECT ON SEQUENCE members_id_seq TO ${role}`)
}

await db.end()
console.log("Mitgliedertabelle bereit")
