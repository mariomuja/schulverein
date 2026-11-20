import { boardUser } from "../../lib/auth"
import { loadBoard } from "../../lib/board"
import { applicationsToCsv } from "../../lib/csv"

export const dynamic = "force-dynamic"

export async function GET(request) {
  const user = await boardUser()
  if (!user) {
    return Response.redirect(new URL("/", request.url))
  }

  const sort = new URL(request.url).searchParams.get("sort") === "asc" ? "asc" : "desc"
  const data = await loadBoard(sort)
  const csv = applicationsToCsv(data)
  const filename = "Foerderantraege.csv"

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
