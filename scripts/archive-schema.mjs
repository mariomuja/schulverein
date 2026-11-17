export function roleFromDatabaseUrl(url) {
  if (!url) return null
  try {
    return decodeURIComponent(new URL(url).username)
  } catch {
    return null
  }
}

function quoteIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error("Rollenname ungültig")
  }
  return `"${name}"`
}

export async function ensureArchiveSchema(db, appRole) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_periods (
      id SERIAL PRIMARY KEY,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_by_user_id INTEGER,
      archived_by_name TEXT NOT NULL,
      approved_sum_cents INTEGER NOT NULL,
      CHECK (period_end > period_start),
      UNIQUE (period_start, period_end)
    );
    CREATE TABLE IF NOT EXISTS audit_period_items (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES audit_periods(id),
      application_id INTEGER,
      application_date DATE NOT NULL,
      applicant TEXT NOT NULL,
      purpose TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      voting_closed BOOLEAN NOT NULL,
      approved BOOLEAN NOT NULL,
      yes_count INTEGER NOT NULL,
      no_count INTEGER NOT NULL,
      eligible_count INTEGER NOT NULL,
      sealed_at TIMESTAMPTZ,
      sealed_by_name TEXT,
      proof TEXT,
      adopted BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE (period_id, application_id)
    );
    CREATE TABLE IF NOT EXISTS audit_period_ballots (
      item_id INTEGER NOT NULL REFERENCES audit_period_items(id),
      position INTEGER NOT NULL,
      user_id INTEGER,
      voter_name TEXT NOT NULL,
      voter_role TEXT,
      decision TEXT NOT NULL CHECK (decision IN ('yes', 'no', 'none')),
      PRIMARY KEY (item_id, position)
    );
    CREATE TABLE IF NOT EXISTS audit_period_files (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES audit_period_items(id),
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      content BYTEA NOT NULL
    );
  `)

  for (const table of [
    "audit_periods",
    "audit_period_items",
    "audit_period_ballots",
    "audit_period_files",
  ]) {
    await db.query(`DROP TRIGGER IF EXISTS ${table}_frozen ON ${table}`)
    await db.query(
      `CREATE TRIGGER ${table}_frozen
       BEFORE UPDATE OR DELETE ON ${table}
       FOR EACH ROW EXECUTE FUNCTION schulverein_reject_change()`,
    )
  }

  if (!appRole || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(appRole)) return
  const me = await db.query("SELECT current_user")
  if (me.rows[0].current_user === appRole) return
  const role = quoteIdent(appRole)
  await db.query(
    `GRANT SELECT, INSERT ON audit_periods, audit_period_items, audit_period_ballots, audit_period_files TO ${role}`,
  )
  await db.query(
    `GRANT USAGE, SELECT ON SEQUENCE audit_periods_id_seq, audit_period_items_id_seq, audit_period_files_id_seq TO ${role}`,
  )
}
