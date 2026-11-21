import { query } from "./db"

export async function listPots() {
  const { rows } = await query(
    `SELECT p.id,
            p.name,
            COALESCE(SUM(CASE WHEN e.direction = 'in' THEN e.amount_cents WHEN e.direction = 'out' THEN -e.amount_cents ELSE 0 END), 0)::int AS balance_cents
     FROM donation_pots p
     LEFT JOIN donation_entries e ON e.pot_id = p.id
     GROUP BY p.id
     ORDER BY p.name, p.id`,
  )
  return rows
}

export async function listPotEntries(potId) {
  const { rows } = await query(
    `SELECT id, direction, amount_cents, purpose, created_at
     FROM donation_entries
     WHERE pot_id = $1
     ORDER BY created_at, id`,
    [potId],
  )
  return rows
}

export async function potCovers(q, potId, amountCents) {
  const pot = await q(`SELECT id FROM donation_pots WHERE id = $1 FOR UPDATE`, [potId])
  if (pot.rowCount === 0) return false
  const balance = await q(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount_cents ELSE -amount_cents END), 0)::int AS cents
     FROM donation_entries
     WHERE pot_id = $1`,
    [potId],
  )
  return amountCents <= balance.rows[0].cents
}

export async function addOutflow(q, entry) {
  await q(
    `INSERT INTO donation_entries (pot_id, direction, amount_cents, purpose, application_id, created_by)
     VALUES ($1, 'out', $2, $3, $4, $5)`,
    [entry.potId, entry.amountCents, entry.purpose, entry.applicationId, entry.userId],
  )
}
