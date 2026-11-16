import { randomBytes } from "crypto"
import fs from "fs"
import pg from "pg"

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    process.env[match[1]] = match[2]
  }
}

function token() {
  return randomBytes(32).toString("base64url")
}

const users = [
  ["Mario", "Vorsitzender und Schatzmeister", true, true, 1],
  ["Meike", "Stellvertretende Vorsitzende", true, false, 2],
  ["Sebastian", "Beisitzer", true, false, 3],
  ["Alexander", "Beisitzer", true, false, 4],
  ["Markus", null, false, false, 5],
  ["Miriam", null, false, false, 6],
]

const firstPurpose =
  "präsent für thomas als dank für die tätigkeit als schatzmeister"

loadEnv(".env.local")

const directUrl = process.env.DIRECT_URL
const databaseUrl = process.env.DATABASE_URL
if (!directUrl || !databaseUrl) {
  console.error("DIRECT_URL und DATABASE_URL fehlen in .env.local")
  process.exit(1)
}

const ssl = { rejectUnauthorized: false }
const admin = new pg.Client({ connectionString: directUrl, ssl })
await admin.connect()
const existing = await admin.query(
  "SELECT 1 FROM pg_database WHERE datname = 'schulverein'",
)
if (existing.rowCount === 0) {
  await admin.query("CREATE DATABASE schulverein")
  console.log("Datenbank schulverein erstellt")
} else {
  console.log("Datenbank schulverein vorhanden")
}
await admin.end()

const db = new pg.Client({ connectionString: databaseUrl, ssl })
await db.connect()
await db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role_label TEXT,
    can_write BOOLEAN NOT NULL DEFAULT FALSE,
    is_treasurer BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL,
    login_token TEXT NOT NULL UNIQUE,
    token_used_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_audit_date DATE
  );
  INSERT INTO settings (id, last_audit_date)
  VALUES (1, NULL)
  ON CONFLICT (id) DO NOTHING;
  CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    application_date DATE NOT NULL,
    applicant TEXT NOT NULL,
    purpose TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    voting_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS votes (
    application_id INTEGER NOT NULL REFERENCES applications(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    decision TEXT NOT NULL CHECK (decision IN ('yes', 'no')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (application_id, user_id)
  );
`)

for (const [name, roleLabel, canWrite, isTreasurer, sortOrder] of users) {
  await db.query(
    `INSERT INTO users (name, role_label, can_write, is_treasurer, sort_order, login_token)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (name) DO NOTHING`,
    [name, roleLabel, canWrite, isTreasurer, sortOrder, token()],
  )
}

const inserted = await db.query(
  `INSERT INTO applications (application_date, applicant, purpose, amount_cents, voting_closed)
   SELECT DATE '2026-11-10', 'Mario', $1, 5479, FALSE
   WHERE NOT EXISTS (
     SELECT 1 FROM applications
     WHERE application_date = DATE '2026-11-10'
       AND applicant = 'Mario'
       AND purpose = $1
   )
   RETURNING id`,
  [firstPurpose],
)
if (inserted.rows[0]) {
  await db.query(
    `INSERT INTO votes (application_id, user_id, decision)
     SELECT $1, id, 'yes' FROM users WHERE can_write`,
    [inserted.rows[0].id],
  )
  console.log("Erstantrag angelegt")
}

const links = await db.query(
  `SELECT name, role_label, can_write, login_token
   FROM users
   ORDER BY sort_order`,
)
await db.end()

const lines = links.rows.map((row) => {
  const right = row.can_write ? "schreiben" : "lesen"
  const role = row.role_label ? ` (${row.role_label})` : ""
  return `${row.name}${role} [${right}]\n/${row.login_token}`
})
fs.writeFileSync("tokens.local.txt", `${lines.join("\n\n")}\n`)
console.log(lines.join("\n\n"))
