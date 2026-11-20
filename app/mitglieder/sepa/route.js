import { canReadMembers } from "../../../lib/access"
import { boardUser } from "../../../lib/auth"
import { encodeWindows1252, membersToSepaCsv } from "../../../lib/csv"
import { listMemberRecords } from "../../../lib/members"
import { currentYear } from "../../../lib/membership-stats"

export const dynamic = "force-dynamic"

export async function GET(request) {
  const user = await boardUser()
  if (!canReadMembers(user)) return Response.redirect(new URL("/statistik", request.url))
  const year = currentYear()
  const csv = encodeWindows1252(membersToSepaCsv(await listMemberRecords(), year))
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=windows-1252",
      "Content-Disposition": `attachment; filename="SEPA-Einzug-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
