import Link from "next/link"
import { boardHref } from "../lib/list-query"
import { givenName } from "../lib/names"
import ApplicationCards from "./ApplicationCards"
import ApplicationsTable from "./ApplicationsTable"
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
        CSV
      </a>
      <a className={className} href="/export/pdf">
        <i className="bi bi-download" aria-hidden="true" />
        PDF
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

      <div className="board-toolbar d-flex flex-column align-items-start gap-2">
        <div className="d-flex flex-wrap gap-2 d-xl-none">
          <ExportLinks sort={sort} />
        </div>

        <div className="board-actions">
          <div className="board-filters d-flex flex-wrap gap-2" role="group" aria-label="Förderanträge filtern">
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
          <div className="board-divider d-xl-none" role="separator" />
          <div className="d-none d-xl-flex flex-wrap align-items-center gap-2 ms-xl-auto">
            <ExportLinks sort={sort} primary />
          </div>
          <DateSort sort={sort} filter={filter} className="date-sort-mobile d-xl-none" />
          {user.can_write ? (
            <NewApplication
              className="board-new-application"
              sort={sort}
              filter={filter}
              openOnError={!editId && (hinweis === "antrag" || hinweis === "nachname")}
            />
          ) : null}
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
