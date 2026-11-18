import { formatEuro } from "../lib/money"

function address(member) {
  const street = [member.street, member.houseNumber].filter(Boolean).join(" ")
  const place = [member.postalCode, member.city].filter(Boolean).join(" ")
  return [street, place].filter(Boolean).join(", ")
}

function MemberFacts({ member }) {
  if (member.unreadable) {
    return <p className="mb-0">Die Angaben können nicht gelesen werden.</p>
  }
  return (
    <dl className="row mb-0 small">
      <dt className="col-5">Adresse</dt>
      <dd className="col-7">{address(member) || "—"}</dd>
      <dt className="col-5">E-Mail</dt>
      <dd className="col-7 text-break">{member.email || "—"}</dd>
      <dt className="col-5">Beitrag</dt>
      <dd className="col-7">{formatEuro(member.contributionCents)} €</dd>
      <dt className="col-5">Bank</dt>
      <dd className="col-7">{member.bankName || "—"}</dd>
      <dt className="col-5">IBAN</dt>
      <dd className="col-7">{member.ibanStored ? "••••" : "—"}</dd>
      <dt className="col-5">Kontoinhaber</dt>
      <dd className="col-7">{member.accountHolder || "—"}</dd>
    </dl>
  )
}

export default function MembersList({ members }) {
  if (members.length === 0) {
    return <p className="text-secondary mb-0">Noch keine Mitglieder erfasst.</p>
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
                    {member.unreadable
                      ? "Mitglied"
                      : [member.givenName, member.familyName].filter(Boolean).join(" ")}
                  </h2>
                  <MemberFacts member={member} />
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
              <th>Adresse</th>
              <th>E-Mail</th>
              <th>Beitrag</th>
              <th>Bank</th>
              <th>IBAN</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="fw-semibold">
                    {member.unreadable
                      ? "Nicht lesbar"
                      : [member.givenName, member.familyName].filter(Boolean).join(" ")}
                  </div>
                </td>
                <td>{address(member) || "—"}</td>
                <td className="text-break">{member.email || "—"}</td>
                <td>{member.contributionCents ? `${formatEuro(member.contributionCents)} €` : "—"}</td>
                <td>
                  <div>{member.bankName || "—"}</div>
                  <div className="small text-secondary">{member.accountHolder}</div>
                </td>
                <td>{member.ibanStored ? "••••" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
