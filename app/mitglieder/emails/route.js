import { canEditMembers } from "../../../lib/access"
import { getUser } from "../../../lib/auth"
import { listMemberRecords, splitEmails } from "../../../lib/members"

export const dynamic = "force-dynamic"

export async function GET(request) {
  const user = await getUser()
  if (!canEditMembers(user)) return Response.redirect(new URL("/mitglieder", request.url))
  const records = await listMemberRecords()
  const emails = [...new Set(records.flatMap((member) => splitEmails(member.email)))]
  return new Response(`${emails.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Mitglieder-E-Mail.txt"',
      "Cache-Control": "no-store",
    },
  })
}
