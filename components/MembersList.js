"use client"

import { useRouter } from "next/navigation"
import { formatEuro } from "../lib/money"

function editHref(letter, id) {
  const params = new URLSearchParams()
  if (letter) params.set("buchstabe", letter)
  params.set("bearbeiten", String(id))
  return `/mitglieder?${params}`
}

function entryDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return "—"
  const [year, month, day] = value.split("-")
  return `${day}.${month}.${year}`
}

function person(member) {
  if (member.unreadable) return "Nicht lesbar"
  return [member.familyName, member.givenName].filter(Boolean).join(", ")
}

function openEdit(event, router, href) {
  if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return
  if (event.key === " ") event.preventDefault()
  router.push(href)
}

export default function MembersList({ members, letter }) {
  const router = useRouter()
  if (members.length === 0) {
    return <p className="text-secondary mb-0">Keine Mitglieder für diesen Anfangsbuchstaben.</p>
  }

  return (
    <>
      <div className="d-xl-none">
        <div className="row g-3">
          {members.map((member) => {
            const href = editHref(letter, member.id)
            return (
              <div className="col-12 col-md-6" key={member.id}>
                <article
                  className="card h-100 member-row"
                  role="button"
                  tabIndex={member.unreadable ? -1 : 0}
                  aria-label={`${person(member)} ändern`}
                  aria-disabled={member.unreadable || undefined}
                  onClick={(event) => {
                    if (!member.unreadable) openEdit(event, router, href)
                  }}
                  onKeyDown={(event) => {
                    if (!member.unreadable) openEdit(event, router, href)
                  }}
                >
                  <div className="card-body">
                    <h2 className="h6 mb-3">
                      {person(member)}
                      {member.memberNumber ? <span className="fw-normal text-secondary"> · Nr. {member.memberNumber}</span> : null}
                    </h2>
                    <dl className="row mb-0 small">
                      <dt className="col-5">Eintritt</dt>
                      <dd className="col-7">{entryDate(member.joinedOn)}</dd>
                      <dt className="col-5">E-Mail</dt>
                      <dd className="col-7 text-break">{member.email || "—"}</dd>
                      <dt className="col-5">Beitrag</dt>
                      <dd className="col-7">{member.contributionCents ? `${formatEuro(member.contributionCents)} €` : "—"}</dd>
                      <dt className="col-5">BIC</dt>
                      <dd className="col-7 mb-0">{member.bicStored ? "••••" : "—"}</dd>
                    </dl>
                  </div>
                </article>
              </div>
            )
          })}
        </div>
      </div>
      <div className="d-none d-xl-block table-responsive">
        <table className="table table-striped table-hover align-middle bg-white member-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Eintritt</th>
              <th>E-Mail</th>
              <th>Beitrag</th>
              <th>BIC</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const href = editHref(letter, member.id)
              return (
                <tr
                  key={member.id}
                  className="member-row"
                  role="button"
                  tabIndex={member.unreadable ? -1 : 0}
                  aria-label={`${person(member)} ändern`}
                  aria-disabled={member.unreadable || undefined}
                  onClick={(event) => {
                    if (!member.unreadable) openEdit(event, router, href)
                  }}
                  onKeyDown={(event) => {
                    if (!member.unreadable) openEdit(event, router, href)
                  }}
                >
                  <td>
                    <div className="fw-semibold">{person(member)}</div>
                    {member.memberNumber ? <div className="small text-secondary">Nr. {member.memberNumber}</div> : null}
                  </td>
                  <td>{entryDate(member.joinedOn)}</td>
                  <td className="text-break">{member.email || "—"}</td>
                  <td>{member.contributionCents ? `${formatEuro(member.contributionCents)} €` : "—"}</td>
                  <td>{member.bicStored ? "••••" : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
