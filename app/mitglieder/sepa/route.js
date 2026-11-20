import { canEditMembers } from "../../../lib/access"
import { getUser } from "../../../lib/auth"
import { membersToSepaCsv } from "../../../lib/csv"
import { listMemberRecords } from "../../../lib/members"

export const dynamic = "force-dynamic"

export async function GET(request) {
  const user = await getUser()
  if (!canEditMembers(user)) return Response.redirect(new URL("/mitglieder", request.url))
  const csv = membersToSepaCsv(await listMemberRecords())
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="SEPA.csv"',
      "Cache-Control": "no-store",
    },
  })
}
