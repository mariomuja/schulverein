import Link from "next/link"
import { addApplication } from "../app/actions"
import { boardHref } from "../lib/list-query"
import { formatEuro, formatGermanDate } from "../lib/money"
import { givenName } from "../lib/names"
import ApplicationsTable from "./ApplicationsTable"
import AuditDateForm from "./AuditDateForm"
import CloseControl from "./CloseControl"
import DateSort from "./DateSort"
import EditApplication from "./EditApplication"
import RemoveApplication from "./RemoveApplication"
import StatusIcon from "./StatusIcon"
import VoteControl from "./VoteControl"

const hints = {
  recht: "Dafür fehlt die Berechtigung.",
  datum: "Bitte ein gültiges Datum wählen.",
  antrag: "Der Antrag konnte nicht gespeichert werden. Bitte alle Felder prüfen.",
  geschlossen: "Die Abstimmung ist abgeschlossen. Die Stimme kann nicht mehr geändert werden.",
  schatzmeister: "Nur der Schatzmeister kann die Abstimmung abschließen.",
  benutzer: "Der Benutzer konnte nicht gespeichert werden. Bitte den Namen prüfen.",
  stimme: "Dieser Benutzer hat bereits abgestimmt und kann nicht entfernt werden.",
  stimmen: "Dieser Förderantrag hat bereits Stimmen und kann nicht entfernt werden.",
  geaendert: "Dieser Förderantrag hat bereits Stimmen und kann nicht mehr geändert werden.",
}

const filters = [
  { id: "", label: "Alle" },
  { id: "offen", label: "Offen" },
  { id: "abgeschlossen", label: "Abgeschlossen" },
  { id: "genehmigt", label: "Genehmigt" },
]

function matchesFilter(application, filter) {
  if (filter === "offen") return !application.voting_closed
  if (filter === "abgeschlossen") return application.voting_closed
  if (filter === "genehmigt") return application.approved
  return true
}

function roleLine(user) {
  const parts = []
  if (user.role_label) parts.push(user.role_label)
  parts.push(user.can_write ? "Schreibrecht" : "Leserecht")
  return parts.join(" · ")
}

export default function Board({ user, data, hinweis, sort, filter = "" }) {
  const message = hints[hinweis]
  const applications = data.applications.filter((application) =>
    matchesFilter(application, filter),
  )

  return (
    <>
      <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
        <h1 className="h4 mb-0">Förderanträge</h1>
        <p className="mb-0 text-secondary">
          {givenName(user.name)}
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

      <aside className="audit-note">
        <AuditDateForm
          canWrite={user.can_write}
          defaultValue={data.lastAuditDate ?? ""}
        />
        <p className="audit-note-hint">
          Gezählt werden genehmigte Anträge, deren Abstimmung abgeschlossen ist
          und deren Datum an oder nach diesem Tag liegt.
        </p>
        <p className="audit-note-sum">
          Gesamtsumme genehmigter Förderanträge seit der letzten Kassenprüfung:{" "}
          {formatEuro(data.approvedSumCents)} EUR
        </p>
      </aside>

      <div className="d-flex flex-column align-items-start gap-2 mb-3">
        <div className="d-flex flex-wrap gap-2">
          <a className="btn btn-sm btn-outline-secondary" href={`/export?sort=${sort}`}>
            CSV exportieren
          </a>
          <a className="btn btn-sm btn-outline-secondary" href="/export/pdf">
            PDF seit Kassenprüfung
          </a>
        </div>

        <div className="d-flex flex-wrap gap-2" role="group" aria-label="Förderanträge filtern">
          {filters.map((entry) => {
            const active = entry.id === filter
            return (
              <Link
                key={entry.id || "alle"}
                className={`btn btn-sm ${active ? "btn-secondary" : "btn-outline-secondary"}`}
                href={boardHref({ sort, filter: entry.id })}
                aria-current={active ? "page" : undefined}
              >
                {entry.label}
              </Link>
            )
          })}
        </div>
      </div>

      {applications.length === 0 ? (
        <p className="text-secondary">Keine Förderanträge in dieser Ansicht.</p>
      ) : (
      <>
      <div className="d-none d-xl-block">
        <ApplicationsTable
          applications={applications}
          writers={data.writers}
          user={user}
          sort={sort}
          filter={filter}
        />
      </div>

      <div className="d-xl-none">
        <div className="mb-2">
          <DateSort sort={sort} filter={filter} className="date-sort-mobile" />
        </div>
        {applications.map((application) => (
          <article className="card shadow-sm mb-3" key={application.id}>
            <div className="card-body">
              <div className="d-flex justify-content-between gap-3">
                <div>
                  <div className="fw-semibold">
                    {formatGermanDate(application.application_date)}
                  </div>
                  <div>{givenName(application.applicant)}</div>
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
                  <div className="fw-semibold">{givenName(writer.name)}</div>
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
                {user.can_write && !application.hasVotes ? (
                  <>
                    <EditApplication application={application} sort={sort} filter={filter} />
                    <RemoveApplication applicationId={application.id} />
                  </>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
      </>
      )}

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
