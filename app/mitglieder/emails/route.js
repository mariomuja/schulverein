import { canEditMembers } from "../../../lib/access"
import { getUser } from "../../../lib/auth"
import { listMemberRecords, splitEmails } from "../../../lib/members"

export const dynamic = "force-dynamic"

export async function GET(request) {
  const user = await getUser()
  if (!canEditMembers(user)) return Response.redirect(new URL("/mitglieder", request.url))
  const records = await listMemberRecords()
  const emails = [...new Set(records.flatMap((member) => splitEmails(member.email)))]
  const tranches = []
  for (let index = 0; index < emails.length; index += 100) {
    const tranche = Math.floor(index / 100) + 1
    tranches.push(`Tranche ${tranche}\r\n${emails.slice(index, index + 100).join("\r\n")}`)
  }
  const notice = [
    "Die meisten E-Mail-Programme können eine Mail nur an höchstens 100 Adressaten senden.",
    "Die Einladung zur Mitgliederversammlung muss daher auf mehrere Tranchen aufgeteilt werden.",
    "",
  ].join("\r\n")
  return new Response(`${notice}${tranches.join("\r\n\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Mitglieder-E-Mail.txt"',
      "Cache-Control": "no-store",
    },
  })
}
