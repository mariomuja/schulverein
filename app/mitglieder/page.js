import { redirect } from "next/navigation"
import MemberForm from "../../components/MemberForm"
import MembersList from "../../components/MembersList"
import SectionTabs from "../../components/SectionTabs"
import { canEditMembers, canReadMembers } from "../../lib/access"
import { getUser } from "../../lib/auth"
import { countMembers, familyLetter, getMember, listDeletedMembers, listMembers, withoutBankData } from "../../lib/members"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Mitglieder · Schulverein Gymnasium Heidberg",
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

function filled(value) {
  return String(value ?? "").trim() !== ""
}

function usedMemberFields(members) {
  return {
    memberNumber: members.some((member) => filled(member.memberNumber)),
    joinedOn: members.some((member) => filled(member.joinedOn)),
    email: members.some((member) => filled(member.email)),
    contribution: members.some((member) => member.contributionCents),
    mandateId: members.some((member) => filled(member.mandateId)),
    bic: members.some((member) => member.bicStored),
    bankName: members.some((member) => filled(member.bankName)),
    iban: members.some((member) => member.ibanStored),
    accountHolder: members.some((member) => filled(member.accountHolder)),
  }
}

export default async function MembersPage({ searchParams }) {
  const user = await getUser()
  if (!user) redirect("/")
  const editor = canEditMembers(user)
  const reader = canReadMembers(user)
  const params = await searchParams
  const hinweis = Array.isArray(params.hinweis) ? params.hinweis[0] : params.hinweis
  const requested = Array.isArray(params.buchstabe) ? params.buchstabe[0] : params.buchstabe
  const letter = familyLetter(requested)
  const count = await countMembers()

  let members = []
  let deletedMembers = []
  let editing = null
  if (editor) {
    members = await listMembers()
    deletedMembers = await listDeletedMembers()
    const editId = Number(Array.isArray(params.bearbeiten) ? params.bearbeiten[0] : params.bearbeiten)
    if (Number.isInteger(editId) && editId > 0) editing = withoutBankData(await getMember(editId))
  }
  const present = new Set(members.map((member) => member.letter).filter(Boolean))
  const shown = letter ? members.filter((member) => member.letter === letter) : members

  return (
    <>
      <SectionTabs active="mitglieder" />
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
      {editor || reader ? (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {editor ? <MemberForm letter={letter} usedFields={usedMemberFields(members)} /> : null}
          {reader ? (
            <>
              <a className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" href="/mitglieder/emails">
                <i className="bi bi-download" aria-hidden="true" />
                eMails
              </a>
              <a className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" href="/mitglieder/sepa">
                <i className="bi bi-download" aria-hidden="true" />
                SEPA
              </a>
            </>
          ) : null}
        </div>
      ) : null}
      {editor ? (
        <>
          <nav className="d-flex flex-wrap gap-1 mb-3" aria-label="Nach Nachnamen filtern">
            <a className={`btn btn-sm ${letter ? "btn-outline-secondary" : "btn-secondary"}`} href="/mitglieder">
              Alle
            </a>
            {alphabet.map((entry) => (
              present.has(entry) ? (
                <a
                  key={entry}
                  className={`btn btn-sm ${letter === entry ? "btn-secondary" : "btn-outline-secondary"}`}
                  href={`/mitglieder?buchstabe=${entry}`}
                  aria-current={letter === entry ? "page" : undefined}
                >
                  {entry}
                </a>
              ) : (
                <button key={entry} className="btn btn-sm btn-outline-secondary" type="button" disabled>
                  {entry}
                </button>
              )
            ))}
          </nav>
          <MembersList members={shown} deletedMembers={deletedMembers} letter={letter} />
          {editing ? <MemberForm key={editing.id} member={editing} letter={letter} /> : null}
        </>
      ) : (
        <p className="mb-0">Der Schulverein hat derzeit {count} {count === 1 ? "Mitglied" : "Mitglieder"}.</p>
      )}
    </>
  )
}
