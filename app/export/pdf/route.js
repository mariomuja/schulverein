import { getUser } from "../../../lib/auth"
import { loadBoard } from "../../../lib/board"
import { buildTreasurerPdf } from "../../../lib/treasurer-pdf"

export const dynamic = "force-dynamic"

export async function GET(request) {
  const user = await getUser()
  if (!user) {
    return Response.redirect(new URL("/", request.url))
  }

  const data = await loadBoard("asc")
  const pdf = await buildTreasurerPdf(data)

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="Foerderantraege-seit-Kassenpruefung.pdf"',
      "Cache-Control": "no-store",
    },
  })
}
