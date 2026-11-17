import { formatEuro, formatGermanDate, formatGermanDateTime } from "./money"
import { isVoteParticipant, voterColumns } from "./voters"

function cell(value) {
  const text = String(value ?? "")
  if (/[;"\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

function voteCell(application, writer) {
  if (!isVoteParticipant(application, writer.id)) return ""
  const decision = application.votes[writer.id]
  if (decision === "yes") return "Ja"
  if (decision === "no") return "Nein"
  return application.voting_closed ? "—" : ""
}

function writerHeading(writer) {
  return writer.role_label ? `${writer.name} (${writer.role_label})` : writer.name
}

export function applicationsToCsv({ writers, applications }) {
  const columns = voterColumns(applications, writers)
  const header = [
    "Datum",
    "Antragsteller",
    "Zweck",
    "Betrag",
    ...columns.map(writerHeading),
    "Genehmigt",
    "Abstimmung abgeschlossen",
    "Abgeschlossen am",
    "Abgeschlossen durch",
    "Prüfcode",
  ]
  const rows = applications.map((application) => [
    formatGermanDate(application.application_date),
    application.applicant,
    application.purpose,
    formatEuro(application.amount_cents),
    ...columns.map((writer) => voteCell(application, writer)),
    application.approved ? "Ja" : "Nein",
    application.voting_closed ? "Ja" : "Nein",
    application.sealedAt ? formatGermanDateTime(application.sealedAt) : "",
    application.sealedByName ?? "",
    application.proof ?? "",
  ])

  const body = [header, ...rows]
    .map((row) => row.map(cell).join(";"))
    .join("\r\n")

  return `\uFEFF${body}\r\n`
}
