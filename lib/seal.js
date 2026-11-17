import { createHash } from "crypto"
import { isApproved } from "./decision"

export function canonicalInstant(value) {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z")
}

export function sealProof(record) {
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

export function proofMatches(record, ballots) {
  const expected = sealProof({
    applicationId: record.application_id,
    applicationDate: record.application_date,
    applicant: record.applicant,
    purpose: record.purpose,
    amountCents: record.amount_cents,
    eligibleCount: record.eligible_count,
    yesCount: record.yes_count,
    noCount: record.no_count,
    approved: record.approved,
    closedAt: canonicalInstant(record.closed_at),
    closedByName: record.closed_by_name,
    closedByRole: record.closed_by_role,
    ballots: ballots.map((ballot) => ({
      userId: ballot.user_id,
      name: ballot.voter_name,
      role: ballot.voter_role,
      decision: ballot.decision,
    })),
  })
  return expected === record.proof
}

export async function appendLog(q, entry) {
  await q(
    `INSERT INTO audit_log (actor_user_id, actor_name, action, application_id, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      entry.user?.id ?? null,
      entry.user?.name ?? "System",
      entry.action,
      entry.applicationId ?? null,
      entry.detail,
    ],
  )
}

export async function sealApplication(q, applicationId, user) {
  const found = await q(
    `SELECT id,
            application_date::text AS application_date,
            applicant,
            purpose,
            amount_cents,
            voting_closed
     FROM applications
     WHERE id = $1
     FOR UPDATE`,
    [applicationId],
  )
  const application = found.rows[0]
  if (!application) return { error: "antrag" }

  const existing = await q(
    `SELECT id FROM vote_records WHERE application_id = $1`,
    [applicationId],
  )
  if (existing.rowCount > 0 || application.voting_closed) return { error: "versiegelt" }

  const writers = await q(
    `SELECT id, name, role_label
     FROM users
     WHERE can_write
     ORDER BY sort_order, id`,
  )
  const votes = await q(
    `SELECT user_id, decision FROM votes WHERE application_id = $1`,
    [applicationId],
  )
  const decisions = new Map(votes.rows.map((vote) => [vote.user_id, vote.decision]))
  const ballots = writers.rows.map((writer) => ({
    userId: writer.id,
    name: writer.name,
    role: writer.role_label,
    decision: decisions.get(writer.id) ?? "none",
  }))
  const yesCount = ballots.filter((ballot) => ballot.decision === "yes").length
  const noCount = ballots.filter((ballot) => ballot.decision === "no").length
  const approved = isApproved(yesCount, ballots.length)
  const closedAt = canonicalInstant(new Date())
  const proof = sealProof({
    applicationId,
    applicationDate: application.application_date,
    applicant: application.applicant,
    purpose: application.purpose,
    amountCents: application.amount_cents,
    eligibleCount: ballots.length,
    yesCount,
    noCount,
    approved,
    closedAt,
    closedByName: user.name,
    closedByRole: user.role_label,
    ballots,
  })

  const inserted = await q(
    `INSERT INTO vote_records (
       application_id, closed_at, closed_by_user_id, closed_by_name, closed_by_role,
       application_date, applicant, purpose, amount_cents,
       eligible_count, yes_count, no_count, approved, proof
     )
     VALUES ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [
      applicationId,
      closedAt,
      user.id,
      user.name,
      user.role_label,
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
    await q(
      `INSERT INTO vote_record_ballots (record_id, user_id, voter_name, voter_role, decision)
       VALUES ($1, $2, $3, $4, $5)`,
      [inserted.rows[0].id, ballot.userId, ballot.name, ballot.role, ballot.decision],
    )
  }
  await q(`UPDATE applications SET voting_closed = TRUE WHERE id = $1`, [applicationId])
  await appendLog(q, {
    user,
    action: "abstimmung_abgeschlossen",
    applicationId,
    detail: `${approved ? "Genehmigt" : "Nicht genehmigt"}. ${yesCount} Ja, ${noCount} Nein, ${ballots.length} Stimmberechtigte. Prüfcode ${proof.slice(0, 12)}.`,
  })
  return { ok: true }
}
