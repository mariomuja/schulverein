import { randomBytes } from "crypto"
import { query } from "./db"
import { hashSecret, sessionDays } from "./secret"

export const tokenPattern = /^[A-Za-z0-9_-]{20,128}$/

export async function tokenMatchesSession(user, token) {
  if (!user || !tokenPattern.test(token ?? "")) return false
  const { rows } = await query(
    `SELECT id FROM users WHERE id = $1 AND login_token = $2`,
    [user.id, hashSecret(token)],
  )
  return Boolean(rows[0])
}

export async function createLoginSession(token) {
  if (!tokenPattern.test(token ?? "")) return null
  const found = await query(
    `SELECT id, join_link FROM users WHERE login_token = $1`,
    [hashSecret(token)],
  )
  const user = found.rows[0]
  if (!user) return null
  const sessionId = randomSessionId()
  const counted = await query(
    `UPDATE users AS account
     SET login_count = account.login_count + 1,
         token_hint_pending = FALSE
     FROM (SELECT id, token_hint_pending FROM users WHERE id = $1) AS previous
     WHERE account.id = previous.id
     RETURNING account.login_count, previous.token_hint_pending`,
    [user.id],
  )
  await query(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 day'))`,
    [hashSecret(sessionId), user.id, sessionDays],
  )
  const loginCount = Number(counted.rows[0]?.login_count)
  const pending = counted.rows[0]?.token_hint_pending === true
  return {
    sessionId,
    sessionDays,
    join: user.join_link === true,
    showTokenHint: user.join_link !== true && (pending || loginCount % 10 === 0),
  }
}

function randomSessionId() {
  return randomBytes(32).toString("base64url")
}
