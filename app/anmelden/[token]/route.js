import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { query } from "../../../lib/db"

export const dynamic = "force-dynamic"

export async function GET(request, context) {
  const { token } = await context.params
  const home = new URL("/", request.url)

  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token ?? "")) {
    return NextResponse.redirect(home)
  }

  const found = await query(`SELECT id FROM users WHERE login_token = $1`, [token])
  const user = found.rows[0]
  if (!user) return NextResponse.redirect(home)

  const sessionId = randomBytes(32).toString("base64url")
  await query(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '400 days')`,
    [sessionId, user.id],
  )

  const response = NextResponse.redirect(home)
  response.cookies.set("sv_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  })
  return response
}
