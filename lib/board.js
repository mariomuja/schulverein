import { isApproved } from "./decision"
import { query } from "./db"

export async function loadBoard(sort = "desc") {
  const [writersResult, settingsResult, applicationsResult, votesResult, recordsResult, ballotsResult] =
    await Promise.all([
      query(
        `SELECT id, name, role_label
         FROM users
         WHERE can_write
         ORDER BY sort_order, id`,
      ),
      query(`SELECT last_audit_date::text AS last_audit_date FROM settings WHERE id = 1`),
      query(
        `SELECT id,
                application_date::text AS application_date,
                applicant,
                purpose,
                amount_cents,
                voting_closed
         FROM applications`,
      ),
      query(
        `SELECT application_id, user_id, decision
         FROM votes`,
      ),
      query(
        `SELECT application_id,
                closed_at,
                closed_by_name,
                application_date::text AS application_date,
                applicant,
                purpose,
                amount_cents,
                approved,
                proof,
                adopted
         FROM vote_records`,
      ),
      query(
        `SELECT r.application_id, b.user_id, b.decision
         FROM vote_record_ballots b
         JOIN vote_records r ON r.id = b.record_id`,
      ),
    ])

  const writers = writersResult.rows
  const writerIds = new Set(writers.map((writer) => writer.id))
  const votesByApplication = new Map()
  for (const vote of votesResult.rows) {
    if (!writerIds.has(vote.user_id)) continue
    if (!votesByApplication.has(vote.application_id)) {
      votesByApplication.set(vote.application_id, {})
    }
    votesByApplication.get(vote.application_id)[vote.user_id] = vote.decision
  }

  const applicationsWithVotes = new Set(
    votesResult.rows.map((vote) => vote.application_id),
  )
  const records = new Map(
    recordsResult.rows.map((record) => [record.application_id, record]),
  )
  const sealedVotes = new Map()
  for (const ballot of ballotsResult.rows) {
    if (!sealedVotes.has(ballot.application_id)) sealedVotes.set(ballot.application_id, {})
    if (ballot.decision === "yes" || ballot.decision === "no") {
      sealedVotes.get(ballot.application_id)[ballot.user_id] = ballot.decision
    }
  }
  const applications = applicationsResult.rows.map((application) => {
    const record = records.get(application.id)
    if (record) {
      return {
        ...application,
        application_date: record.application_date,
        applicant: record.applicant,
        purpose: record.purpose,
        amount_cents: record.amount_cents,
        voting_closed: true,
        votes: sealedVotes.get(application.id) ?? {},
        hasVotes: true,
        approved: record.approved,
        sealed: true,
        sealedAt: record.adopted ? null : record.closed_at,
        sealedByName: record.closed_by_name,
        proof: record.proof,
        adopted: record.adopted,
      }
    }
    const votes = votesByApplication.get(application.id) ?? {}
    const yesCount = writers.filter((writer) => votes[writer.id] === "yes").length
    return {
      ...application,
      votes,
      hasVotes: applicationsWithVotes.has(application.id),
      approved: isApproved(yesCount, writers.length),
      sealed: false,
      sealedAt: null,
      sealedByName: null,
      proof: null,
      adopted: false,
    }
  })

  const direction = sort === "asc" ? 1 : -1
  applications.sort((left, right) => {
    if (left.application_date !== right.application_date) {
      return left.application_date < right.application_date ? -direction : direction
    }
    return (left.id - right.id) * direction
  })

  const lastAuditDate = settingsResult.rows[0]?.last_audit_date ?? null
  const approvedSumCents = applications
    .filter((application) => {
      return (
        application.sealed &&
        application.approved &&
        lastAuditDate &&
        application.application_date >= lastAuditDate
      )
    })
    .reduce((sum, application) => sum + application.amount_cents, 0)

  return { writers, applications, lastAuditDate, approvedSumCents }
}

export async function loadAccounts() {
  const { rows } = await query(
    `SELECT u.id, u.name, u.role_label, u.can_write, u.login_token,
            (
              EXISTS (SELECT 1 FROM votes v WHERE v.user_id = u.id)
              OR EXISTS (SELECT 1 FROM vote_record_ballots b WHERE b.user_id = u.id)
            ) AS has_voted
     FROM users u
     ORDER BY u.sort_order, u.id`,
  )
  return rows
}
