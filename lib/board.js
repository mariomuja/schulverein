import { query } from "./db"

function isApproved(yesCount, writerCount) {
  return writerCount > 0 && yesCount * 2 > writerCount
}

export async function loadBoard(sort = "desc") {
  const [writersResult, settingsResult, applicationsResult, votesResult] =
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

  const applications = applicationsResult.rows.map((application) => {
    const votes = votesByApplication.get(application.id) ?? {}
    const yesCount = writers.filter((writer) => votes[writer.id] === "yes").length
    return {
      ...application,
      votes,
      yesCount,
      approved: isApproved(yesCount, writers.length),
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
        application.voting_closed &&
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
            EXISTS (SELECT 1 FROM votes v WHERE v.user_id = u.id) AS has_voted
     FROM users u
     ORDER BY u.sort_order, u.id`,
  )
  return rows
}
