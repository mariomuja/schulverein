import { createHash } from "crypto"
import fs from "fs"
import pg from "pg"

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match) process.env[match[1]] = match[2]
}

function canonicalInstant(value) {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z")
}

function sealProof(record) {
  const ballots = record.ballots
    .slice()
    .sort((left, right) => left.userId - right.userId)
    .map((ballot) => `${ballot.userId}|${ballot.name}|${ballot.role ?? ""}|${ballot.decision}`)
    .join(",")
  const text = [
    "v1",
    record.applicationId,
    record.applicationDate,
    record.applicant,
    record.purpose,
    record.amountCents,
    record.eligibleCount,
    record.yesCount,
    record.noCount,
    record.approved ? "1" : "0",
    record.closedAt,
    record.closedByName,
    record.closedByRole ?? "",
    ballots,
  ].join("\n")
  return createHash("sha256").update(text).digest("hex")
}

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL_OWNER || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
})
await db.connect()

await db.query(`
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

await db.query(`
  CREATE OR REPLACE FUNCTION schulverein_reject_change()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    RAISE EXCEPTION 'revisionssicher: dieser Eintrag darf nicht geändert werden';
  END;
  $$;
  CREATE OR REPLACE FUNCTION schulverein_protect_application()
  RETURNS trigger LANGUAGE plpgsql AS $$
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
  RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM vote_records r
      WHERE r.application_id = app_id
        AND r.eligible_count = (SELECT count(*) FROM vote_record_ballots b WHERE b.record_id = r.id)
        AND r.yes_count = (SELECT count(*) FROM vote_record_ballots b WHERE b.record_id = r.id AND b.decision = 'yes')
        AND r.no_count = (SELECT count(*) FROM vote_record_ballots b WHERE b.record_id = r.id AND b.decision = 'no')
        AND r.approved = (r.eligible_count > 0 AND r.yes_count * 2 > r.eligible_count)
    );
  $$;
  CREATE OR REPLACE FUNCTION schulverein_protect_ballot()
  RETURNS trigger LANGUAGE plpgsql AS $$
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
  CREATE OR REPLACE FUNCTION schulverein_protect_vote()
  RETURNS trigger LANGUAGE plpgsql AS $$
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
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END;
  $$;
`)

await db.query(
  `ALTER TABLE vote_records ADD COLUMN IF NOT EXISTS adopted BOOLEAN NOT NULL DEFAULT FALSE`,
)
await db.query(`DROP TRIGGER IF EXISTS vote_records_frozen ON vote_records`)
await db.query(
  `UPDATE vote_records
   SET adopted = TRUE
   WHERE application_id IN (
     SELECT application_id FROM audit_log WHERE action = 'abschluss_uebernommen'
   )`,
)

for (const table of ["vote_records", "vote_record_ballots", "audit_log"]) {
  await db.query(`DROP TRIGGER IF EXISTS ${table}_frozen ON ${table}`)
  await db.query(
    `CREATE TRIGGER ${table}_frozen BEFORE UPDATE OR DELETE ON ${table}
     FOR EACH ROW EXECUTE FUNCTION schulverein_reject_change()`,
  )
}
await db.query(`DROP TRIGGER IF EXISTS applications_sealed ON applications`)
await db.query(
  `CREATE TRIGGER applications_sealed BEFORE UPDATE OR DELETE ON applications
   FOR EACH ROW EXECUTE FUNCTION schulverein_protect_application()`,
)
await db.query(`DROP TRIGGER IF EXISTS votes_sealed ON votes`)
await db.query(
  `CREATE TRIGGER votes_sealed BEFORE INSERT OR UPDATE OR DELETE ON votes
   FOR EACH ROW EXECUTE FUNCTION schulverein_protect_vote()`,
)
await db.query(`DROP TRIGGER IF EXISTS vote_record_ballots_extend ON vote_record_ballots`)
await db.query(
  `CREATE TRIGGER vote_record_ballots_extend BEFORE INSERT ON vote_record_ballots
   FOR EACH ROW EXECUTE FUNCTION schulverein_protect_ballot()`,
)

const treasurer = await db.query(
  `SELECT id, name, role_label FROM users WHERE is_treasurer ORDER BY sort_order, id LIMIT 1`,
)
const closer = treasurer.rows[0]
const pending = await db.query(
  `SELECT a.id,
          a.application_date::text AS application_date,
          a.applicant,
          a.purpose,
          a.amount_cents,
          MAX(v.updated_at) AS last_vote_at
   FROM applications a
   LEFT JOIN votes v ON v.application_id = a.id
   WHERE a.voting_closed
     AND NOT EXISTS (SELECT 1 FROM vote_records r WHERE r.application_id = a.id)
   GROUP BY a.id`,
)

for (const application of pending.rows) {
  const people = await db.query(
    `SELECT id, name, role_label
     FROM users u
     WHERE u.can_write
        OR EXISTS (
          SELECT 1 FROM votes v
          WHERE v.application_id = $1 AND v.user_id = u.id
        )
     ORDER BY sort_order, id`,
    [application.id],
  )
  const votes = await db.query(
    `SELECT user_id, decision FROM votes WHERE application_id = $1`,
    [application.id],
  )
  const decisions = new Map(votes.rows.map((vote) => [vote.user_id, vote.decision]))
  const ballots = people.rows.map((person) => ({
    userId: person.id,
    name: person.name,
    role: person.role_label,
    decision: decisions.get(person.id) ?? "none",
  }))
  const yesCount = ballots.filter((ballot) => ballot.decision === "yes").length
  const noCount = ballots.filter((ballot) => ballot.decision === "no").length
  const approved = ballots.length > 0 && yesCount * 2 > ballots.length
  const closedAt = canonicalInstant(application.last_vote_at ?? new Date())
  const proof = sealProof({
    applicationId: application.id,
    applicationDate: application.application_date,
    applicant: application.applicant,
    purpose: application.purpose,
    amountCents: application.amount_cents,
    eligibleCount: ballots.length,
    yesCount,
    noCount,
    approved,
    closedAt,
    closedByName: closer.name,
    closedByRole: closer.role_label,
    ballots,
  })
  const inserted = await db.query(
    `INSERT INTO vote_records (
       application_id, closed_at, closed_by_user_id, closed_by_name, closed_by_role,
       application_date, applicant, purpose, amount_cents,
       eligible_count, yes_count, no_count, approved, proof, adopted
     )
     VALUES ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE)
     RETURNING id`,
    [
      application.id,
      closedAt,
      closer.id,
      closer.name,
      closer.role_label,
      application.application_date,
      application.applicant,
      application.purpose,
      application.amount_cents,
      ballots.length,
      yesCount,
      noCount,
      approved,
      proof,
    ],
  )
  for (const ballot of ballots) {
    await db.query(
      `INSERT INTO vote_record_ballots (record_id, user_id, voter_name, voter_role, decision)
       VALUES ($1, $2, $3, $4, $5)`,
      [inserted.rows[0].id, ballot.userId, ballot.name, ballot.role, ballot.decision],
    )
  }
  await db.query(
    `INSERT INTO audit_log (actor_user_id, actor_name, action, application_id, detail)
     VALUES ($1, $2, 'abschluss_uebernommen', $3, $4)`,
    [
      closer.id,
      closer.name,
      application.id,
      `Bestehender Abschluss festgeschrieben. Zeitpunkt ist die letzte gespeicherte Stimme, weil der Abschluss selbst nicht protokolliert war. Prüfcode ${proof.slice(0, 12)}.`,
    ],
  )
  console.log(
    JSON.stringify({
      id: application.id,
      applicant: application.applicant,
      approved,
      yesCount,
      eligible: ballots.length,
      closedAt,
      proof: proof.slice(0, 12),
    }),
  )
}

await db.query("BEGIN")
const probe = await db.query(
  `INSERT INTO applications (application_date, applicant, purpose, amount_cents, voting_closed)
   VALUES (DATE '2026-11-16', 'Probe', 'Schutztest', 100, TRUE)
   RETURNING id`,
)
const probeId = probe.rows[0].id
await db.query(
  `INSERT INTO vote_records (
     application_id, closed_at, closed_by_user_id, closed_by_name,
     application_date, applicant, purpose, amount_cents,
     eligible_count, yes_count, no_count, approved, proof
   )
   VALUES ($1, NOW(), $2, $3, DATE '2026-11-16', 'Probe', 'Schutztest', 100, 1, 1, 0, TRUE, 'test')`,
  [probeId, closer.id, closer.name],
)
let blocked = 0
for (const statement of [
  `UPDATE applications SET purpose = 'geaendert' WHERE id = ${probeId}`,
  `UPDATE applications SET voting_closed = FALSE WHERE id = ${probeId}`,
  `DELETE FROM applications WHERE id = ${probeId}`,
  `UPDATE vote_records SET purpose = 'geaendert' WHERE application_id = ${probeId}`,
]) {
  try {
    await db.query("SAVEPOINT probe")
    await db.query(statement)
    console.log("NICHT blockiert: " + statement)
  } catch (error) {
    await db.query("ROLLBACK TO SAVEPOINT probe")
    if (String(error.message).includes("revisionssicher")) blocked += 1
    else console.log(error.message)
  }
}
await db.query("ROLLBACK")
console.log(JSON.stringify({ blocked }))
await db.end()
