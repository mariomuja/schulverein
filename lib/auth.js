import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ensureAccess, isJoinAccount } from "./access"
import { query } from "./db"
import { hashSecret } from "./secret"

export async function getUser() {
  const jar = await cookies()
  const sessionId = jar.get("sv_session")?.value
  if (!sessionId) return null
  await ensureAccess()

  const { rows } = await query(
    `SELECT u.id, u.name, u.role_label, u.can_write, u.is_treasurer, u.members_access, u.pots_access, u.join_link
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [hashSecret(sessionId)],
  )
  return rows[0] ?? null
}

export async function boardUser() {
  const user = await getUser()
  if (isJoinAccount(user)) redirect("/beitritt")
  return user
}
