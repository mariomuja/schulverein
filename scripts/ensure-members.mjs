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

await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS join_link BOOLEAN NOT NULL DEFAULT FALSE`)
await db.query(
  `CREATE UNIQUE INDEX IF NOT EXISTS users_one_join_link ON users (join_link) WHERE join_link`,
)
await db.query(`
  CREATE TABLE IF NOT EXISTS join_requests (
    id SERIAL PRIMARY KEY,
    payload TEXT NOT NULL,
    confirm_hash TEXT NOT NULL UNIQUE,
    email_hash TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
  )
`)
await db.query(
  `CREATE INDEX IF NOT EXISTS join_requests_ip_created ON join_requests (ip_hash, created_at)`,
)
await db.query(
  `CREATE INDEX IF NOT EXISTS join_requests_email_created ON join_requests (email_hash, created_at)`,
)
await db.query(`
  CREATE TABLE IF NOT EXISTS join_nonces (
    nonce_hash TEXT PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ
  )
`)
await db.query(
  `CREATE INDEX IF NOT EXISTS join_nonces_ip_created ON join_nonces (ip_hash, created_at)`,
)
await db.query(`
  CREATE OR REPLACE FUNCTION schulverein_protect_join_user()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF OLD.join_link THEN
        RAISE EXCEPTION 'beitrittslink bleibt';
      END IF;
      RETURN OLD;
    END IF;
    IF OLD.join_link THEN
      IF NEW.name IS DISTINCT FROM OLD.name
         OR NEW.role_label IS DISTINCT FROM OLD.role_label
         OR NEW.can_write IS DISTINCT FROM OLD.can_write
         OR NEW.members_access IS DISTINCT FROM OLD.members_access
         OR NEW.is_treasurer IS DISTINCT FROM OLD.is_treasurer
         OR NEW.sort_order IS DISTINCT FROM OLD.sort_order
         OR NEW.join_link IS DISTINCT FROM OLD.join_link THEN
        RAISE EXCEPTION 'beitrittslink bleibt';
      END IF;
    ELSIF NEW.join_link THEN
      RAISE EXCEPTION 'beitrittslink bleibt';
    END IF;
    RETURN NEW;
  END;
  $fn$
`)
await db.query(`DROP TRIGGER IF EXISTS schulverein_protect_join_user ON users`)
await db.query(`
  CREATE TRIGGER schulverein_protect_join_user
  BEFORE UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION schulverein_protect_join_user()
`)

const joinUser = await db.query(`SELECT id FROM users WHERE join_link = TRUE`)
if (joinUser.rowCount === 0) {
  const named = await db.query(`SELECT id FROM users WHERE name = 'Neues Mitglied'`)
  if (named.rowCount > 0) {
    console.error("Beitrittsnutzer nicht angelegt, der Name ist belegt")
    process.exit(1)
  }
  await db.query(`
    INSERT INTO users (
      name, role_label, can_write, members_access, is_treasurer, sort_order,
      login_token, token_hint_pending, join_link
    )
    VALUES (
      'Neues Mitglied', 'Beitrittslink', FALSE, 'none', FALSE,
      (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM users),
      NULL, FALSE, TRUE
    )
  `)
}

if (appRole && /^[A-Za-z_][A-Za-z0-9_]*$/.test(appRole)) {
  const role = `"${appRole}"`
  await db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON join_requests TO ${role}`)
  await db.query(`GRANT USAGE, SELECT ON SEQUENCE join_requests_id_seq TO ${role}`)
  await db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON join_nonces TO ${role}`)
}

await db.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`)
await db.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS confirm_hash TEXT`)
await db.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS confirm_expires_at TIMESTAMPTZ`)
await db.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS confirmation_note TEXT`)
await db.query(
  `CREATE UNIQUE INDEX IF NOT EXISTS members_confirm_hash ON members (confirm_hash) WHERE confirm_hash IS NOT NULL`,
)
await db.query(
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS members_confirmed_backfill BOOLEAN NOT NULL DEFAULT FALSE`,
)
const backfill = await db.query(`SELECT members_confirmed_backfill FROM settings WHERE id = 1`)
if (!backfill.rows[0]?.members_confirmed_backfill) {
  await db.query(
    `UPDATE members SET confirmed_at = COALESCE(created_at, NOW()) WHERE confirmed_at IS NULL`,
  )
  await db.query(`UPDATE settings SET members_confirmed_backfill = TRUE WHERE id = 1`)
}

if (process.env.DATABASE_URL) {
  const app = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
  })
  await app.connect()
  try {
    await app.query("BEGIN")
    await app.query(`INSERT INTO join_nonces (nonce_hash, ip_hash) VALUES ('probe', 'probe')`)
    await app.query("ROLLBACK")
    await app.query("BEGIN")
    let blocked = false
    try {
      await app.query(`UPDATE users SET role_label = 'anders' WHERE join_link = TRUE`)
    } catch (error) {
      blocked = String(error?.message ?? "").includes("beitrittslink bleibt")
    }
    await app.query("ROLLBACK")
    if (!blocked) {
      console.error("Beitrittsnutzer ist nicht geschuetzt")
      process.exit(1)
    }
  } finally {
    await app.end()
  }
}

await db.end()
console.log("Mitgliedertabelle bereit")
