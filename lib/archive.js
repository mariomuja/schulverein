import { isApproved } from "./decision"
import { query } from "./db"
import { formatGermanDate } from "./money"
import { appendLog } from "./seal"

export function dayBefore(isoDate) {
  const [year, month, day] = String(isoDate).split("T")[0].split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - 1)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function periodLabel(start, end) {
  return `${formatGermanDate(start)} – ${formatGermanDate(dayBefore(end))}`
}

export function archiveId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export async function loadArchiveList() {
  const { rows } = await query(
    `SELECT id,
            period_start::text AS period_start,
            period_end::text AS period_end,
            archived_at,
            archived_by_name,
            approved_sum_cents
     FROM audit_periods
     ORDER BY period_end DESC, id DESC`,
  )
  return rows
}

function groupBy(rows, key) {
  const grouped = new Map()
  for (const row of rows) {
    if (!grouped.has(row[key])) grouped.set(row[key], [])
    grouped.get(row[key]).push(row)
  }
  return grouped
}

function toApplication(item, ballotRows, fileRows) {
  const votes = {}
  for (const ballot of ballotRows) {
    if (ballot.decision === "yes" || ballot.decision === "no") {
      votes[ballot.user_id] = ballot.decision
    }
  }
  return {
    id: item.application_id,
    application_date: item.application_date,
    applicant: item.applicant,
    purpose: item.purpose,
    amount_cents: item.amount_cents,
    voting_closed: item.voting_closed,
    approved: item.approved,
    files: fileRows.map((file) => ({ name: file.file_name })),
    voters: ballotRows.map((ballot) => ({
      id: ballot.user_id,
      name: ballot.voter_name,
      role_label: ballot.voter_role,
    })),
    votes,
    sealed: item.voting_closed,
    sealedAt: item.adopted ? null : item.sealed_at,
    sealedByName: item.sealed_by_name,
    proof: item.proof,
    proofOk: true,
  }
}

export async function loadArchive(id) {
  const periodResult = await query(
    `SELECT id,
            period_start::text AS period_start,
            period_end::text AS period_end,
            archived_at,
            archived_by_name,
            approved_sum_cents
     FROM audit_periods
     WHERE id = $1`,
    [id],
  )
  const period = periodResult.rows[0]
  if (!period) return null

  const [itemsResult, ballotsResult, filesResult] = await Promise.all([
    query(
      `SELECT id,
              application_id,
              application_date::text AS application_date,
              applicant,
              purpose,
              amount_cents,
              voting_closed,
              approved,
              yes_count,
              no_count,
              eligible_count,
              sealed_at,
              sealed_by_name,
              proof,
              adopted
       FROM audit_period_items
       WHERE period_id = $1
       ORDER BY application_date, id`,
      [id],
    ),
    query(
      `SELECT b.item_id, b.position, b.user_id, b.voter_name, b.voter_role, b.decision
       FROM audit_period_ballots b
       JOIN audit_period_items i ON i.id = b.item_id
       WHERE i.period_id = $1
       ORDER BY b.position`,
      [id],
    ),
    query(
      `SELECT f.item_id, f.file_name
       FROM audit_period_files f
       JOIN audit_period_items i ON i.id = f.item_id
       WHERE i.period_id = $1
       ORDER BY f.id`,
      [id],
    ),
  ])

  const ballots = groupBy(ballotsResult.rows, "item_id")
  const files = groupBy(filesResult.rows, "item_id")
  const applications = itemsResult.rows.map((item) =>
    toApplication(item, ballots.get(item.id) ?? [], files.get(item.id) ?? []),
  )
  const writers = []
  const seen = new Set()
  for (const application of applications) {
    for (const voter of application.voters) {
      if (seen.has(voter.id)) continue
      seen.add(voter.id)
      writers.push(voter)
    }
  }

  return {
    periodStart: period.period_start,
    periodEnd: period.period_end,
    archivedAt: period.archived_at,
    archivedByName: period.archived_by_name,
    approvedSumCents: period.approved_sum_cents,
    board: { writers, applications, lastAuditDate: period.period_start },
  }
}

export async function archivePeriod(q, user, periodStart, periodEnd) {
  const writers = await q(
    `SELECT id, name, role_label
     FROM users
     WHERE can_write
     ORDER BY sort_order, id`,
  )
  const apps = await q(
    `SELECT a.id,
            a.application_date::text AS application_date,
            a.applicant,
            a.purpose,
            a.amount_cents,
            r.closed_at,
            r.closed_by_name,
            r.applicant AS sealed_applicant,
            r.purpose AS sealed_purpose,
            r.amount_cents AS sealed_amount,
            r.application_date::text AS sealed_date,
            r.eligible_count,
            r.yes_count,
            r.no_count,
            r.approved AS sealed_approved,
            r.proof,
            r.adopted
     FROM applications a
     LEFT JOIN vote_records r ON r.application_id = a.id
     WHERE a.application_date >= $1::date
       AND a.application_date < $2::date
     ORDER BY a.application_date, a.id`,
    [periodStart, periodEnd],
  )
  const ids = apps.rows.map((row) => row.id)
  const votes = ids.length
    ? await q(
        `SELECT application_id, user_id, decision
         FROM votes
         WHERE application_id = ANY($1::int[])`,
        [ids],
      )
    : { rows: [] }
  const sealedBallots = ids.length
    ? await q(
        `SELECT r.application_id, b.user_id, b.voter_name, b.voter_role, b.decision
         FROM vote_record_ballots b
         JOIN vote_records r ON r.id = b.record_id
         LEFT JOIN users u ON u.id = b.user_id
         WHERE r.application_id = ANY($1::int[])
         ORDER BY u.sort_order NULLS LAST, b.user_id`,
        [ids],
      )
    : { rows: [] }
  const files = ids.length
    ? await q(
        `SELECT application_id, file_name, content_type, content
         FROM application_files
         WHERE application_id = ANY($1::int[])
         ORDER BY id`,
        [ids],
      )
    : { rows: [] }

  const votesByApplication = groupBy(votes.rows, "application_id")
  const ballotsByApplication = groupBy(sealedBallots.rows, "application_id")
  const filesByApplication = groupBy(files.rows, "application_id")

  let approvedSum = 0
  for (const row of apps.rows) {
    if (row.closed_at && row.sealed_approved) approvedSum += row.sealed_amount
  }

  const inserted = await q(
    `INSERT INTO audit_periods (
       period_start, period_end, archived_by_user_id, archived_by_name, approved_sum_cents
     )
     VALUES ($1::date, $2::date, $3, $4, $5)
     RETURNING id`,
    [periodStart, periodEnd, user.id, user.name, approvedSum],
  )
  const periodId = inserted.rows[0].id

  for (const row of apps.rows) {
    const sealed = Boolean(row.closed_at)
    const liveVotes = new Map(
      (votesByApplication.get(row.id) ?? []).map((vote) => [vote.user_id, vote.decision]),
    )
    const ballotRows = sealed
      ? (ballotsByApplication.get(row.id) ?? [])
      : writers.rows.map((writer) => ({
          user_id: writer.id,
          voter_name: writer.name,
          voter_role: writer.role_label,
          decision: liveVotes.get(writer.id) ?? "none",
        }))
    const yesCount = sealed
      ? row.yes_count
      : ballotRows.filter((ballot) => ballot.decision === "yes").length
    const noCount = sealed
      ? row.no_count
      : ballotRows.filter((ballot) => ballot.decision === "no").length
    const eligible = sealed ? row.eligible_count : ballotRows.length
    const item = await q(
      `INSERT INTO audit_period_items (
         period_id, application_id, application_date, applicant, purpose, amount_cents,
         voting_closed, approved, yes_count, no_count, eligible_count,
         sealed_at, sealed_by_name, proof, adopted
       )
       VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        periodId,
        row.id,
        sealed ? row.sealed_date : row.application_date,
        sealed ? row.sealed_applicant : row.applicant,
        sealed ? row.sealed_purpose : row.purpose,
        sealed ? row.sealed_amount : row.amount_cents,
        sealed,
        sealed ? row.sealed_approved : isApproved(yesCount, eligible),
        yesCount,
        noCount,
        eligible,
        sealed ? row.closed_at : null,
        sealed ? row.closed_by_name : null,
        sealed ? row.proof : null,
        sealed ? Boolean(row.adopted) : false,
      ],
    )
    let position = 0
    for (const ballot of ballotRows) {
      position += 1
      await q(
        `INSERT INTO audit_period_ballots (
           item_id, position, user_id, voter_name, voter_role, decision
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          item.rows[0].id,
          position,
          ballot.user_id,
          ballot.voter_name,
          ballot.voter_role,
          ballot.decision,
        ],
      )
    }
    for (const file of filesByApplication.get(row.id) ?? []) {
      await q(
        `INSERT INTO audit_period_files (item_id, file_name, content_type, content)
         VALUES ($1, $2, $3, $4)`,
        [item.rows[0].id, file.file_name, file.content_type, file.content],
      )
    }
  }

  await appendLog(q, {
    user,
    action: "zeitraum_archiviert",
    detail: `Zeitraum ${periodStart} bis ${dayBefore(periodEnd)} archiviert.`,
  })
  return periodId
}
