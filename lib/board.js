import { isApproved } from "./decision"
import { query } from "./db"
import { proofMatches } from "./seal"

export async function loadBoard(sort = "desc") {
  const [writersResult, settingsResult, applicationsResult, votesResult, recordsResult, ballotsResult, filesResult] =
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
                closed_by_role,
                application_date::text AS application_date,
                applicant,
                purpose,
                amount_cents,
                eligible_count,
                yes_count,
                no_count,
                approved,
                proof,
                adopted
         FROM vote_records`,
      ),
      query(
        `SELECT r.application_id, b.user_id, b.voter_name, b.voter_role, b.decision
         FROM vote_record_ballots b
         JOIN vote_records r ON r.id = b.record_id
         LEFT JOIN users u ON u.id = b.user_id
         ORDER BY u.sort_order NULLS LAST, b.user_id`,
      ),
      query(
        `SELECT id, application_id, file_name
         FROM application_files
         ORDER BY id`,
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
  const sealedBallots = new Map()
  for (const ballot of ballotsResult.rows) {
    if (!sealedBallots.has(ballot.application_id)) sealedBallots.set(ballot.application_id, [])
    sealedBallots.get(ballot.application_id).push(ballot)
  }
  const filesByApplication = new Map()
  for (const file of filesResult.rows) {
    if (!filesByApplication.has(file.application_id)) {
      filesByApplication.set(file.application_id, [])
    }
    filesByApplication.get(file.application_id).push({ id: file.id, name: file.file_name })
  }
  const applications = applicationsResult.rows.map((application) => {
    const record = records.get(application.id)
    if (record) {
      const ballots = sealedBallots.get(application.id) ?? []
      const proofOk = proofMatches(record, ballots)
      const shown = proofOk ? ballots : []
      const votes = {}
      for (const ballot of shown) {
        if (ballot.decision === "yes" || ballot.decision === "no") {
          votes[ballot.user_id] = ballot.decision
        }
      }
      return {
        ...application,
        application_date: record.application_date,
        applicant: record.applicant,
        purpose: record.purpose,
        amount_cents: record.amount_cents,
        voting_closed: true,
        files: filesByApplication.get(application.id) ?? [],
        voters: shown.map((ballot) => ({
          id: ballot.user_id,
          name: ballot.voter_name,
          role_label: ballot.voter_role,
        })),
        votes,
        proofOk,
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
      voters: writers,
      files: filesByApplication.get(application.id) ?? [],
      votes,
      hasVotes: applicationsWithVotes.has(application.id),
      approved: isApproved(yesCount, writers.length),
      proofOk: true,
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
    `SELECT u.id, u.name, u.role_label, u.can_write,
            (u.login_token IS NOT NULL) AS token_active,
            (
              EXISTS (SELECT 1 FROM votes v WHERE v.user_id = u.id)
              OR EXISTS (SELECT 1 FROM vote_record_ballots b WHERE b.user_id = u.id)
            ) AS has_voted
     FROM users u
     ORDER BY u.sort_order, u.id`,
  )
  return rows
}
