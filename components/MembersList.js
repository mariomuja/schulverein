import Link from "next/link"
import DeleteMemberButton from "./DeleteMemberButton"
import { formatEuro } from "../lib/money"

function memberHref(letter) {
  return letter ? `/mitglieder?buchstabe=${letter}` : "/mitglieder"
}

function address(member) {
  const street = [member.street, member.houseNumber].filter(Boolean).join(" ")
  const place = [member.postalCode, member.city].filter(Boolean).join(" ")
  return [street, place].filter(Boolean).join(", ")
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

export default function MembersList({ members, letter }) {
  if (members.length === 0) {
    return <p className="text-secondary mb-0">Keine Mitglieder für diesen Anfangsbuchstaben.</p>
  }

  return (
    <>
      <div className="d-xl-none">
        <div className="row g-3">
          {members.map((member) => (
            <div className="col-12 col-md-6" key={member.id}>
              <article className="card h-100">
                <div className="card-body">
                  <h2 className="h6 mb-3">
                    {person(member)}
                    {member.memberNumber ? <span className="fw-normal text-secondary"> · Nr. {member.memberNumber}</span> : null}
                  </h2>
                  <dl className="row mb-3 small">
                    <dt className="col-5">Eintritt</dt>
                    <dd className="col-7">{entryDate(member.joinedOn)}</dd>
                    <dt className="col-5">Adresse</dt>
                    <dd className="col-7">{address(member) || "—"}</dd>
                    <dt className="col-5">E-Mail</dt>
                    <dd className="col-7 text-break">{member.email || "—"}</dd>
                    <dt className="col-5">Beitrag</dt>
                    <dd className="col-7">{member.contributionCents ? `${formatEuro(member.contributionCents)} €` : "—"}</dd>
                    <dt className="col-5">Bank</dt>
                    <dd className="col-7">
                      {member.bankName || member.bic || "—"}
                      {member.accountHolder ? <div className="text-secondary">{member.accountHolder}</div> : null}
                    </dd>
                  </dl>
                  <div className="d-flex flex-wrap gap-2">
                    <Link className="btn btn-sm btn-outline-secondary" href={`${memberHref(letter)}${letter ? "&" : "?"}bearbeiten=${member.id}`}>
                      Ändern
                    </Link>
                    <DeleteMemberButton id={member.id} letter={letter} />
                  </div>
                </div>
              </article>
            </div>
          ))}
        </div>
      </div>
      <div className="d-none d-xl-block table-responsive">
        <table className="table table-striped align-middle bg-white">
          <thead>
            <tr>
              <th>Name</th>
              <th>Eintritt</th>
              <th>Adresse</th>
              <th>E-Mail</th>
              <th>Beitrag</th>
              <th>Bank</th>
              <th><span className="visually-hidden">Aktionen</span></th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="fw-semibold">{person(member)}</div>
                  {member.memberNumber ? <div className="small text-secondary">Nr. {member.memberNumber}</div> : null}
                </td>
                <td>{entryDate(member.joinedOn)}</td>
                <td>{address(member) || "—"}</td>
                <td className="text-break">{member.email || "—"}</td>
                <td>{member.contributionCents ? `${formatEuro(member.contributionCents)} €` : "—"}</td>
                <td>
                  <div>{member.bankName || member.bic || "—"}</div>
                  <div className="small text-secondary">{member.accountHolder}</div>
                </td>
                <td>
                  <div className="d-flex flex-wrap gap-2">
                    <Link className="btn btn-sm btn-outline-secondary" href={`${memberHref(letter)}${letter ? "&" : "?"}bearbeiten=${member.id}`}>
                      Ändern
                    </Link>
                    <DeleteMemberButton id={member.id} letter={letter} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
