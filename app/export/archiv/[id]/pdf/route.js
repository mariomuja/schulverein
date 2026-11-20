import { archiveId, dayBefore, loadArchive } from "../../../../../lib/archive"
import { boardUser } from "../../../../../lib/auth"
import { buildTreasurerPdf } from "../../../../../lib/treasurer-pdf"

export const dynamic = "force-dynamic"

export async function GET(request, context) {
  const user = await boardUser()
  if (!user) return Response.redirect(new URL("/", request.url))

  const { id } = await context.params
  const archiveKey = archiveId(id)
  if (!archiveKey) return new Response("Nicht gefunden", { status: 404 })

  const archive = await loadArchive(archiveKey)
  if (!archive) return new Response("Nicht gefunden", { status: 404 })

  const pdf = await buildTreasurerPdf(archive.board, {
    archived: true,
    periodStart: archive.periodStart,
    periodEnd: archive.periodEnd,
    archivedAt: archive.archivedAt,
    archivedByName: archive.archivedByName,
  })
  const filename = `Foerderantraege-${archive.periodStart}-bis-${dayBefore(archive.periodEnd)}.pdf`

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
