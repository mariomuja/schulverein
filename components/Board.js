import { addApplication, saveAuditDate } from "../app/actions"
import { formatEuro, formatGermanDate } from "../lib/money"
import CloseControl from "./CloseControl"
import StatusIcon from "./StatusIcon"
import VoteControl from "./VoteControl"

const hints = {
  recht: "Dafür fehlt die Berechtigung.",
  datum: "Bitte ein gültiges Datum wählen.",
  antrag: "Der Antrag konnte nicht gespeichert werden. Bitte alle Felder prüfen.",
  geschlossen: "Die Abstimmung ist abgeschlossen. Die Stimme kann nicht mehr geändert werden.",
  schatzmeister: "Nur der Schatzmeister kann die Abstimmung abschließen.",
}

function roleLine(user) {
  const parts = []
  if (user.role_label) parts.push(user.role_label)
  parts.push(user.can_write ? "Schreibrecht" : "Leserecht")
  return parts.join(" · ")
}

export default function Board({ user, data, hinweis }) {
  const message = hints[hinweis]

  return (
    <>
      <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
        <h1 className="h4 mb-0">Förderanträge</h1>
        <p className="mb-0 text-secondary">
          {user.name}
          <span className="d-block d-md-inline">
            <span className="d-none d-md-inline"> · </span>
            {roleLine(user)}
          </span>
        </p>
      </div>

      {message ? (
        <div className="alert alert-warning" role="status">
          {message}
        </div>
      ) : null}

      <form action={saveAuditDate} className="card shadow-sm mb-3">
        <div className="card-body">
          <label className="form-label" htmlFor="lastAuditDate">
            Datum der letzten Kassenprüfung
          </label>
          <div className="d-flex flex-column flex-sm-row gap-2 align-items-stretch align-items-sm-end">
            <input
              id="lastAuditDate"
              className="form-control"
              style={{ maxWidth: "16rem" }}
              type="date"
              name="lastAuditDate"
              defaultValue={data.lastAuditDate ?? ""}
              disabled={!user.can_write}
            />
            {user.can_write ? (
              <button className="btn btn-primary save-btn" type="submit">
                Speichern
              </button>
            ) : null}
          </div>
          <p className="form-text mb-0">
            Gezählt werden genehmigte Anträge, deren Abstimmung abgeschlossen
            ist und deren Datum an oder nach diesem Tag liegt.
          </p>
        </div>
      </form>

      <p className="fw-semibold mb-3">
        Gesamtsumme genehmigter Förderanträge: {formatEuro(data.approvedSumCents)} EUR
      </p>

      <div className="d-none d-xl-block table-responsive card shadow-sm">
        <table className="table table-bordered table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Datum</th>
              <th>Antragsteller</th>
              <th>Zweck</th>
              <th className="text-end">Betrag</th>
              {data.writers.map((writer) => (
                <th key={writer.id}>
                  <div>{writer.name}</div>
                  {writer.role_label ? (
                    <div className="fw-normal text-secondary small">
                      {writer.role_label}
                    </div>
                  ) : null}
                </th>
              ))}
              <th>Genehmigt</th>
              <th>Abstimmung abgeschlossen</th>
            </tr>
          </thead>
          <tbody>
            {data.applications.map((application) => (
              <tr key={application.id}>
                <td className="text-nowrap">
                  {formatGermanDate(application.application_date)}
                </td>
                <td>{application.applicant}</td>
                <td className="purpose">{application.purpose}</td>
                <td className="text-end text-nowrap">
                  {formatEuro(application.amount_cents)} €
                </td>
                {data.writers.map((writer) => (
                  <td key={writer.id}>
                    <VoteControl
                      application={application}
                      voter={writer}
                      user={user}
                    />
                  </td>
                ))}
                <td className="text-center">
                  <StatusIcon approved={application.approved} />
                </td>
                <td>
                  <CloseControl application={application} user={user} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-xl-none">
        {data.applications.map((application) => (
          <article className="card shadow-sm mb-3" key={application.id}>
            <div className="card-body">
              <div className="d-flex justify-content-between gap-3">
                <div>
                  <div className="fw-semibold">
                    {formatGermanDate(application.application_date)}
                  </div>
                  <div>{application.applicant}</div>
                </div>
                <div className="text-end">
                  <div className="fs-5 fw-semibold text-nowrap">
                    {formatEuro(application.amount_cents)} €
                  </div>
                  <StatusIcon approved={application.approved} />
                </div>
              </div>
              <p className="purpose mt-2 mb-3">{application.purpose}</p>
              <div className="small text-secondary mb-1">Stimmen</div>
              {data.writers.map((writer) => (
                <div className="border-top py-2" key={writer.id}>
                  <div className="fw-semibold">{writer.name}</div>
                  {writer.role_label ? (
                    <div className="small text-secondary mb-1">
                      {writer.role_label}
                    </div>
                  ) : null}
                  <VoteControl
                    application={application}
                    voter={writer}
                    user={user}
                  />
                </div>
              ))}
              <div className="border-top pt-3 mt-2">
                <div className="fw-semibold mb-2">Abstimmung abgeschlossen</div>
                <CloseControl application={application} user={user} />
              </div>
            </div>
          </article>
        ))}
      </div>

      {user.can_write ? (
        <form action={addApplication} className="card shadow-sm mt-3">
          <div className="card-body">
            <h2 className="h5">Neuer Förderantrag</h2>
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <label className="form-label" htmlFor="applicationDate">
                  Datum
                </label>
                <input
                  id="applicationDate"
                  className="form-control"
                  type="date"
                  name="applicationDate"
                  required
                />
              </div>
              <div className="col-12 col-md-8">
                <label className="form-label" htmlFor="applicant">
                  Antragsteller
                </label>
                <input
                  id="applicant"
                  className="form-control"
                  name="applicant"
                  maxLength={120}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="purpose">
                  Zweck
                </label>
                <textarea
                  id="purpose"
                  className="form-control"
                  name="purpose"
                  rows={3}
                  maxLength={500}
                  required
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label" htmlFor="amount">
                  Betrag in EUR
                </label>
                <input
                  id="amount"
                  className="form-control"
                  name="amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="col-12">
                <button className="btn btn-primary save-btn" type="submit">
                  Antrag hinzufügen
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : null}
    </>
  )
}
