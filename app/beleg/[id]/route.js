import { boardUser } from "../../../lib/auth"
import { query } from "../../../lib/db"
import { receiptDisposition } from "../../../lib/receipts"

export const dynamic = "force-dynamic"

const servedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
])

export async function GET(request, context) {
  const user = await boardUser()
  if (!user) return Response.redirect(new URL("/", request.url))

  const id = Number((await context.params).id)
  if (!Number.isInteger(id) || id <= 0) return new Response(null, { status: 404 })

  const result = await query(
    `SELECT file_name, content_type, content
     FROM application_files
     WHERE id = $1`,
    [id],
  )
  const file = result.rows[0]
  if (!file) return new Response(null, { status: 404 })

  return new Response(file.content, {
    headers: {
      "Content-Type": servedTypes.has(file.content_type)
        ? file.content_type
        : "application/octet-stream",
      "Content-Disposition": receiptDisposition(file.file_name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
