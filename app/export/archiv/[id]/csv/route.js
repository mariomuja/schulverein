import { archiveId, dayBefore, loadArchive } from "../../../../../lib/archive"
import { getUser } from "../../../../../lib/auth"
import { applicationsToCsv } from "../../../../../lib/csv"

export const dynamic = "force-dynamic"

export async function GET(request, context) {
  const user = await getUser()
  if (!user) return Response.redirect(new URL("/", request.url))

  const { id } = await context.params
  const archiveKey = archiveId(id)
  if (!archiveKey) return new Response("Nicht gefunden", { status: 404 })

  const archive = await loadArchive(archiveKey)
  if (!archive) return new Response("Nicht gefunden", { status: 404 })

  const csv = applicationsToCsv(archive.board)
  const filename = `Foerderantraege-${archive.periodStart}-bis-${dayBefore(archive.periodEnd)}.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
