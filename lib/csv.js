import { formatEuro, formatGermanDate } from "./money"

function cell(value) {
  const text = String(value ?? "")
  if (/[;"\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

function voteLabel(decision) {
  if (decision === "yes") return "Ja"
  if (decision === "no") return "Nein"
  return ""
}

function writerHeading(writer) {
  return writer.role_label ? `${writer.name} (${writer.role_label})` : writer.name
}

export function applicationsToCsv({ writers, applications }) {
  const header = [
    "Datum",
    "Antragsteller",
    "Zweck",
    "Betrag",
    ...writers.map(writerHeading),
    "Genehmigt",
    "Abstimmung abgeschlossen",
  ]
  const rows = applications.map((application) => [
    formatGermanDate(application.application_date),
    application.applicant,
    application.purpose,
    formatEuro(application.amount_cents),
    ...writers.map((writer) => voteLabel(application.votes[writer.id])),
    application.approved ? "Ja" : "Nein",
    application.voting_closed ? "Ja" : "Nein",
  ])

  const body = [header, ...rows]
    .map((row) => row.map(cell).join(";"))
    .join("\r\n")

  return `\uFEFF${body}\r\n`
}
