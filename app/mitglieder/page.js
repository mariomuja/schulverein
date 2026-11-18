import { redirect } from "next/navigation"
import MemberCapture from "../../components/MemberCapture"
import MembersList from "../../components/MembersList"
import SectionTabs from "../../components/SectionTabs"
import { canSeeMembers, canWriteMembers } from "../../lib/access"
import { getUser } from "../../lib/auth"
import { listMembers } from "../../lib/members"
import { givenName } from "../../lib/names"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Mitglieder · Schulverein Gymnasium Heidberg",
}

function roleLine(user) {
  const parts = []
  if (user.role_label) parts.push(user.role_label)
  parts.push(user.can_write ? "Förderanträge Schreibrecht" : "Förderanträge Leserecht")
  parts.push(user.members_access === "write" ? "Mitglieder Schreibrecht" : "Mitglieder Leserecht")
  return parts.join(" · ")
}

export default async function MembersPage({ searchParams }) {
  const user = await getUser()
  if (!user || !canSeeMembers(user)) redirect("/")
  const params = await searchParams
  const hinweis = Array.isArray(params.hinweis) ? params.hinweis[0] : params.hinweis
  const members = await listMembers()

  return (
    <>
      <SectionTabs user={user} active="mitglieder" />
      <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
        <h1 className="h4 mb-0">Mitglieder</h1>
        <p className="mb-0 text-secondary">
          {givenName(user.name)}
          <span className="d-block d-md-inline">
            <span className="d-none d-md-inline"> · </span>
            {roleLine(user)}
          </span>
        </p>
      </div>
      {hinweis === "mitglied" ? (
        <div className="alert alert-warning" role="status">
          Das Mitglied konnte nicht gespeichert werden. Bitte Name, Vorname und Beitrag prüfen.
        </div>
      ) : null}
      {hinweis === "schluessel" ? (
        <div className="alert alert-warning" role="status">
          Die Angaben konnten nicht verschlüsselt gespeichert werden.
        </div>
      ) : null}
      {canWriteMembers(user) ? <MemberCapture /> : null}
      <MembersList members={members} />
    </>
  )
}
