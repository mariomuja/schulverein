import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request, context) {
  const { token } = await context.params
  const target = new URL(`/${token}`, request.url)
  return NextResponse.redirect(target)
}
