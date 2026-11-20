import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { query } from "../../lib/db"
import { hashSecret, sessionDays } from "../../lib/secret"

export const dynamic = "force-dynamic"

export async function GET(request, context) {
  const { token } = await context.params
  const home = new URL("/", request.url)

  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token ?? "")) {
    return NextResponse.redirect(home)
  }

  const found = await query(`SELECT id FROM users WHERE login_token = $1`, [hashSecret(token)])
  const user = found.rows[0]
  if (!user) return NextResponse.redirect(home)

  const sessionId = randomBytes(32).toString("base64url")
  const counted = await query(
    `UPDATE users SET login_count = login_count + 1 WHERE id = $1 RETURNING login_count`,
    [user.id],
  )
  await query(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 day'))`,
    [hashSecret(sessionId), user.id, sessionDays],
  )

  const response = NextResponse.redirect(home)
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  response.cookies.set("sv_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * sessionDays,
  })
  if (Number(counted.rows[0]?.login_count) % 10 === 0) {
    response.cookies.set("sv_token_hint", "1", {
      httpOnly: false,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 120,
    })
  }
  return response
}
