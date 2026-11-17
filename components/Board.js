import Link from "next/link"
import { boardHref } from "../lib/list-query"
import { periodLabel } from "../lib/archive"
import { formatEuro } from "../lib/money"
import { givenName } from "../lib/names"
import ApplicationCards from "./ApplicationCards"
import ApplicationsTable from "./ApplicationsTable"
import AuditDateForm from "./AuditDateForm"
import DateSort from "./DateSort"
import NewApplication from "./NewApplication"

const hints = {
  recht: "Dafür fehlt die Berechtigung.",
  datum: "Bitte ein gültiges Datum wählen.",
  antrag: "Der Antrag konnte nicht gespeichert werden. Bitte alle Felder prüfen.",
  nachname: "Beim Antragsteller müssen Vor- und Nachname genannt werden.",
  geschlossen: "Die Abstimmung ist abgeschlossen. Die Stimme kann nicht mehr geändert werden.",
  schatzmeister: "Nur der Schatzmeister kann die Abstimmung abschließen.",
  benutzer: "Der Benutzer konnte nicht gespeichert werden. Bitte den Namen prüfen.",
  stimme: "Dieser Benutzer hat bereits abgestimmt und kann nicht entfernt werden.",
  stimmen: "Dieser Förderantrag hat bereits Stimmen und kann nicht entfernt werden.",
  geaendert: "Eine abgeschlossene Abstimmung kann nicht mehr geändert werden.",
  versiegelt:
    "Eine abgeschlossene Abstimmung bleibt festgeschrieben und kann nicht wieder geöffnet werden.",
  ohnebeleg: "Die Abstimmung kann erst abgeschlossen werden, wenn ein Beleg hinterlegt ist.",
  zeitraum:
    "Das Datum der Kassenprüfung kann nur auf einen späteren Tag gesetzt werden. Der bisherige Zeitraum wird dabei archiviert.",
  beleg:
    "Der Beleg konnte nicht gespeichert werden. Erlaubt sind Fotos und PDF bis 4 MB, höchstens 12 Dateien je Antrag.",
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

function ExportLinks({ sort, primary = false }) {
  const className = primary
    ? "btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
    : "btn btn-sm btn-outline-secondary export-btn d-inline-flex align-items-center"
  return (
    <>
      <a className={className} href={`/export?sort=${sort}`}>
        <i className="bi bi-download" aria-hidden="true" />
        CSV exportieren
      </a>
      <a className={className} href="/export/pdf">
        <i className="bi bi-download" aria-hidden="true" />
        PDF seit Kassenprüfung
      </a>
    </>
  )
}

function roleLine(user) {
  const parts = []
  if (user.role_label) parts.push(user.role_label)
  parts.push(user.can_write ? "Schreibrecht" : "Leserecht")
  return parts.join(" · ")
}

export default function Board({ user, data, hinweis, sort, filter = "", editId = null }) {
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
          min={data.archives.length ? data.lastAuditDate ?? "" : ""}
        />
        <p className="audit-note-sum">
          Gesamtsumme genehmigter Förderanträge seit der letzten Kassenprüfung:{" "}
          {formatEuro(data.approvedSumCents)} EUR
        </p>
        <div className="audit-archive">
          <div className="audit-note-label">Archivierte Zeiträume</div>
          {data.archives.length === 0 ? (
            <p className="mb-0">Noch keiner.</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {data.archives.map((period) => (
                <li key={period.id}>
                  {periodLabel(period.period_start, period.period_end)}
                  {" · "}
                  {formatEuro(period.approved_sum_cents)} EUR
                  {" · "}
                  <a href={`/export/archiv/${period.id}/pdf`}>PDF</a>
                  {" · "}
                  <a href={`/export/archiv/${period.id}/csv`}>CSV</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="d-flex flex-column align-items-start gap-2 mb-3">
        <div className="d-flex flex-wrap gap-2 d-xl-none">
          <ExportLinks sort={sort} />
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2 w-100">
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
          <div
            className={
              user.can_write
                ? "d-flex flex-wrap align-items-center gap-2 ms-auto"
                : "d-none d-xl-flex flex-wrap align-items-center gap-2 ms-auto"
            }
          >
            <div className="d-none d-xl-flex flex-wrap gap-2">
              <ExportLinks sort={sort} primary />
            </div>
            {user.can_write ? (
              <NewApplication
                sort={sort}
                filter={filter}
                openOnError={!editId && (hinweis === "antrag" || hinweis === "nachname")}
              />
            ) : null}
          </div>
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
          editId={hinweis === "antrag" || hinweis === "nachname" ? editId : null}
        />
      </div>

      <div className="d-xl-none">
        <div className="mb-2">
          <DateSort sort={sort} filter={filter} className="date-sort-mobile" />
        </div>
        <ApplicationCards
          applications={applications}
          user={user}
          sort={sort}
          filter={filter}
          editId={hinweis === "antrag" || hinweis === "nachname" ? editId : null}
        />
      </div>
      </>
      )}
    </>
  )
}
