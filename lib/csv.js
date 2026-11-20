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
    "Höchstbetrag",
    "Belege",
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
    (application.files ?? []).map((file) => file.name).join(", "),
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

function fullDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return ""
  const [year, month, day] = value.split("-")
  return `${day}.${month}.${year}`
}

export function membersToSepaCsv(members) {
  const header = [
    "Nr",
    "Name",
    "Vorname",
    "Straße",
    "Hausnummer",
    "PLZ",
    "Ort",
    "E-Mail",
    "Beitrag",
    "Eintritt",
    "Mandatsreferenz",
    "BIC",
    "Bank",
    "IBAN",
    "Kontoinhaber",
  ]
  const rows = members.map((member) => [
    member.memberNumber ?? "",
    member.familyName ?? "",
    member.givenName ?? "",
    member.street ?? "",
    member.houseNumber ?? "",
    member.postalCode ?? "",
    member.city ?? "",
    member.email ?? "",
    member.contributionCents ? formatEuro(member.contributionCents) : "",
    fullDate(member.joinedOn),
    member.mandateId ?? "",
    member.bic ?? "",
    member.bankName ?? "",
    member.iban ?? "",
    member.accountHolder ?? "",
  ])
  const body = [header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n")
  return `\uFEFF${body}\r\n`
}
