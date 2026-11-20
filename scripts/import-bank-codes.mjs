import { readFileSync } from "fs"
import { roleFromDatabaseUrl } from "./archive-schema.mjs"
import pg from "pg"

// Quelle: Bankleitzahlendatei der Deutschen Bundesbank (TXT).
// https://www.bundesbank.de/de/startseite/bankleitzahlendateien-txt--602678

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (!match || process.env[match[1]] != null) continue
  let value = match[2]
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  process.env[match[1]] = value
}

const file = process.argv[2]
if (!file) {
  console.error("Pfad zur BLZ-Datei fehlt")
  process.exit(1)
}

const banks = new Map()
for (const line of readFileSync(file).toString("latin1").split(/\r?\n/)) {
  if (line.length < 168) continue
  const blz = line.slice(0, 8)
  const leading = line[8] === "1"
  const bic = line.slice(139, 150).trim()
  const removed = line[158] === "D"
  const shortName = line.slice(107, 134).trim()
  const longName = line.slice(9, 67).trim()
  const name = shortName || longName
  if (!leading || removed || !/^\d{8}$/.test(blz) || !bic || !name) continue
  banks.set(blz, { bic, name })
}

if (banks.size < 1000) {
  console.error("Zu wenige Bankleitzahlen")
  process.exit(1)
}

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL_OWNER,
  ssl: { rejectUnauthorized: true },
})
await db.connect()
await db.query(`
  CREATE TABLE IF NOT EXISTS bank_codes (
    blz CHAR(8) PRIMARY KEY,
    bic TEXT NOT NULL,
    name TEXT NOT NULL
  )
`)
const appRole = roleFromDatabaseUrl(process.env.DATABASE_URL)
if (appRole && /^[A-Za-z_][A-Za-z0-9_]*$/.test(appRole)) {
  await db.query(`GRANT SELECT ON bank_codes TO "${appRole}"`)
}
const rows = [...banks.entries()]
await db.query("BEGIN")
await db.query(`TRUNCATE bank_codes`)
await db.query(
  `INSERT INTO bank_codes (blz, bic, name) SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[])`,
  [rows.map(([blz]) => blz), rows.map(([, bank]) => bank.bic), rows.map(([, bank]) => bank.name)],
)
await db.query("COMMIT")
const check = await db.query(
  `SELECT blz, bic, name FROM bank_codes WHERE blz IN ('20050550', '20070000', '20190003') ORDER BY blz`,
)
console.log(`${rows.length} Banken`)
for (const row of check.rows) console.log(`${row.blz} ${row.bic} ${row.name}`)
await db.end()
