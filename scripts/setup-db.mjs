import { createHash, randomBytes } from "crypto"
import fs from "fs"
import pg from "pg"
import { ensureArchiveSchema, roleFromDatabaseUrl } from "./archive-schema.mjs"

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

function hashSecret(value) {
  return createHash("sha256").update(value).digest("hex")
}

const users = [
  ["Mario", "Vorsitzender und Schatzmeister", true, true, 1],
  ["Meike", "Stellvertretende Vorsitzende", true, false, 2],
  ["Sebastian", "Beisitzer", true, false, 3],
  ["Alexander", "Beisitzer", true, false, 4],
  ["Markus", "Kassenprüfung", false, false, 5],
  ["Miriam", "Kassenprüfung", false, false, 6],
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

const ssl = { rejectUnauthorized: true }
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

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL_OWNER || databaseUrl,
  ssl,
})
await db.connect()
await db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role_label TEXT,
    can_write BOOLEAN NOT NULL DEFAULT FALSE,
    is_treasurer BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL,
    login_token TEXT UNIQUE,
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
  CREATE TABLE IF NOT EXISTS vote_records (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL UNIQUE REFERENCES applications(id),
    closed_at TIMESTAMPTZ NOT NULL,
    closed_by_user_id INTEGER REFERENCES users(id),
    closed_by_name TEXT NOT NULL,
    closed_by_role TEXT,
    application_date DATE NOT NULL,
    applicant TEXT NOT NULL,
    purpose TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    eligible_count INTEGER NOT NULL,
    yes_count INTEGER NOT NULL,
    no_count INTEGER NOT NULL,
    approved BOOLEAN NOT NULL,
    proof TEXT NOT NULL,
    adopted BOOLEAN NOT NULL DEFAULT FALSE
  );
  CREATE TABLE IF NOT EXISTS vote_record_ballots (
    record_id INTEGER NOT NULL REFERENCES vote_records(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    voter_name TEXT NOT NULL,
    voter_role TEXT,
    decision TEXT NOT NULL CHECK (decision IN ('yes', 'no', 'none')),
    PRIMARY KEY (record_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS application_files (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content BYTEA NOT NULL,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id INTEGER,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    application_id INTEGER,
    detail TEXT NOT NULL
  );
`)
await db.query(`ALTER TABLE users ALTER COLUMN login_token DROP NOT NULL`)

await db.query(`
  CREATE OR REPLACE FUNCTION schulverein_reject_change()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RAISE EXCEPTION 'revisionssicher: dieser Eintrag darf nicht geändert werden';
  END;
  $$;

  CREATE OR REPLACE FUNCTION schulverein_protect_application()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF EXISTS (SELECT 1 FROM vote_records WHERE application_id = OLD.id) THEN
        RAISE EXCEPTION 'revisionssicher: abgeschlossener Antrag darf nicht gelöscht werden';
      END IF;
      RETURN OLD;
    END IF;
    IF EXISTS (SELECT 1 FROM vote_records WHERE application_id = OLD.id) THEN
      IF OLD.voting_closed
         OR NEW.application_date IS DISTINCT FROM OLD.application_date
         OR NEW.applicant IS DISTINCT FROM OLD.applicant
         OR NEW.purpose IS DISTINCT FROM OLD.purpose
         OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
         OR NEW.voting_closed IS DISTINCT FROM TRUE
         OR NOT schulverein_record_matches(NEW.id) THEN
        RAISE EXCEPTION 'revisionssicher: abgeschlossener Antrag darf nicht geändert werden';
      END IF;
    ELSIF NEW.voting_closed THEN
      RAISE EXCEPTION 'revisionssicher: abschluss ohne passende niederschrift';
    END IF;
    RETURN NEW;
  END;
  $$;

  CREATE OR REPLACE FUNCTION schulverein_record_matches(app_id INTEGER)
  RETURNS BOOLEAN
  LANGUAGE sql
  STABLE
  AS $$
    SELECT EXISTS (
      SELECT 1
      FROM vote_records r
      WHERE r.application_id = app_id
        AND r.eligible_count = (
          SELECT count(*) FROM vote_record_ballots b WHERE b.record_id = r.id
        )
        AND r.yes_count = (
          SELECT count(*) FROM vote_record_ballots b
          WHERE b.record_id = r.id AND b.decision = 'yes'
        )
        AND r.no_count = (
          SELECT count(*) FROM vote_record_ballots b
          WHERE b.record_id = r.id AND b.decision = 'no'
        )
        AND r.approved = (r.eligible_count > 0 AND r.yes_count * 2 > r.eligible_count)
    );
  $$;

  CREATE OR REPLACE FUNCTION schulverein_protect_ballot()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    closed BOOLEAN;
  BEGIN
    SELECT a.voting_closed INTO closed
    FROM vote_records r
    JOIN applications a ON a.id = r.application_id
    WHERE r.id = NEW.record_id;
    IF closed THEN
      RAISE EXCEPTION 'revisionssicher: niederschrift darf nicht ergänzt werden';
    END IF;
    RETURN NEW;
  END;
  $$;

  CREATE OR REPLACE FUNCTION schulverein_protect_file()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    app_id INTEGER;
  BEGIN
    app_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.application_id ELSE NEW.application_id END;
    IF EXISTS (SELECT 1 FROM vote_records WHERE application_id = app_id) THEN
      RAISE EXCEPTION 'revisionssicher: belege einer abgeschlossenen abstimmung bleiben unverändert';
    END IF;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END;
  $$;

  CREATE OR REPLACE FUNCTION schulverein_protect_vote()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    app_id INTEGER;
  BEGIN
    app_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.application_id ELSE NEW.application_id END;
    IF TG_OP = 'UPDATE' AND NEW.application_id IS DISTINCT FROM OLD.application_id THEN
      RAISE EXCEPTION 'revisionssicher: Stimme darf nicht verschoben werden';
    END IF;
    IF EXISTS (SELECT 1 FROM vote_records WHERE application_id = app_id) THEN
      RAISE EXCEPTION 'revisionssicher: Stimme einer abgeschlossenen Abstimmung darf nicht geändert werden';
    END IF;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END;
  $$;
`)

for (const [table, fn] of [
  ["vote_records", "schulverein_reject_change"],
  ["vote_record_ballots", "schulverein_reject_change"],
  ["audit_log", "schulverein_reject_change"],
]) {
  await db.query(`DROP TRIGGER IF EXISTS ${table}_frozen ON ${table}`)
  await db.query(
    `CREATE TRIGGER ${table}_frozen
     BEFORE UPDATE OR DELETE ON ${table}
     FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
  )
}
await db.query(`DROP TRIGGER IF EXISTS applications_sealed ON applications`)
await db.query(
  `CREATE TRIGGER applications_sealed
   BEFORE UPDATE OR DELETE ON applications
   FOR EACH ROW EXECUTE FUNCTION schulverein_protect_application()`,
)
await db.query(`DROP TRIGGER IF EXISTS votes_sealed ON votes`)
await db.query(
  `CREATE TRIGGER votes_sealed
   BEFORE INSERT OR UPDATE OR DELETE ON votes
   FOR EACH ROW EXECUTE FUNCTION schulverein_protect_vote()`,
)
await db.query(`DROP TRIGGER IF EXISTS vote_record_ballots_extend ON vote_record_ballots`)
await db.query(
  `CREATE TRIGGER vote_record_ballots_extend
   BEFORE INSERT ON vote_record_ballots
   FOR EACH ROW EXECUTE FUNCTION schulverein_protect_ballot()`,
)
await db.query(`DROP TRIGGER IF EXISTS application_files_sealed ON application_files`)
await db.query(
  `CREATE TRIGGER application_files_sealed
   BEFORE INSERT OR UPDATE OR DELETE ON application_files
   FOR EACH ROW EXECUTE FUNCTION schulverein_protect_file()`,
)

const freshLinks = []
for (const [name, roleLabel, canWrite, isTreasurer, sortOrder] of users) {
  const raw = token()
  const inserted = await db.query(
    `INSERT INTO users (name, role_label, can_write, is_treasurer, sort_order, login_token)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (name) DO NOTHING
     RETURNING name`,
    [name, roleLabel, canWrite, isTreasurer, sortOrder, hashSecret(raw)],
  )
  if (inserted.rowCount > 0) freshLinks.push({ name, roleLabel, canWrite, raw })
}

const inserted = await db.query(
  `INSERT INTO applications (application_date, applicant, purpose, amount_cents, voting_closed)
   SELECT DATE '2026-11-10', 'Mario Muja', $1, 5479, FALSE
   WHERE NOT EXISTS (
     SELECT 1 FROM applications
     WHERE application_date = DATE '2026-11-10'
       AND applicant = 'Mario Muja'
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

await ensureArchiveSchema(db, roleFromDatabaseUrl(databaseUrl))
await db.end()

const lines = freshLinks.map((row) => {
  const right = row.canWrite ? "schreiben" : "lesen"
  const role = row.roleLabel ? ` (${row.roleLabel})` : ""
  return `${row.name}${role} [${right}]\n/${row.raw}`
})
if (lines.length > 0) {
  fs.writeFileSync("tokens.local.txt", `${lines.join("\n\n")}\n`)
}
console.log(`${freshLinks.length} neue Benutzer, Tokens nur als Hash in der Datenbank`)
