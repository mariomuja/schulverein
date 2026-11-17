import fs from "fs"
import pg from "pg"
import { ensureArchiveSchema, roleFromDatabaseUrl } from "./archive-schema.mjs"

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match) process.env[match[1]] = match[2]
}

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL_OWNER || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
})
await db.connect()
await ensureArchiveSchema(db, roleFromDatabaseUrl(process.env.DATABASE_URL))
await db.end()
console.log("Archivtabellen bereit")
