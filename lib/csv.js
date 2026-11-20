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

const sepaColumnCount = 215
const creditorIban = "DE54201901090031838740"
const creditorName = "Schulverein des Gymnasium Heidberg"
const creditorId = "DE64ZZZ00000104062"

function sepaLine(values) {
  return Array.from({ length: sepaColumnCount }, (_, index) => cell(values[index] ?? "")).join(";")
}

function memberOrder(left, right) {
  const leftNumber = Number(left.memberNumber)
  const rightNumber = Number(right.memberNumber)
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber
  }
  return String(left.familyName ?? "").localeCompare(String(right.familyName ?? ""), "de")
}

export function membersToSepaCsv(members, year) {
  const header = sepaLine([
    "Bezeichnung",
    "Zahlungspflichtiger",
    "IBAN des Zahlungspflichtigen",
    "BIC",
    "Bei Kreditinstitut",
    "Betrag",
    "Verwendungszweck",
    "IBAN Zahlungsempfänger",
    "Zahlungsempfänger",
    "Mandatsreferenz",
    "Unterschrieben",
    "Ausführungsart",
    "Gläubiger ID Zahlungsempfänger",
  ])
  const purpose = `Schulverein Beitrag ${year}`
  const rows = members
    .filter((member) => /^DE\d{20}$/.test(String(member.iban ?? "").replace(/\s/g, "")))
    .sort(memberOrder)
    .map((member) => {
      const iban = String(member.iban).replace(/\s/g, "").toUpperCase()
      const number = String(member.memberNumber ?? "").trim()
      const payer = String(member.accountHolder ?? "").trim() || String(member.familyName ?? "").trim()
      return sepaLine([
        member.familyName ?? "",
        payer,
        iban,
        member.bic ?? "",
        "",
        member.contributionCents ? formatEuro(member.contributionCents) : "",
        purpose,
        creditorIban,
        creditorName,
        `${number}Schulverein`,
        fullDate(member.joinedOn),
        "",
        creditorId,
      ])
    })
  return `${[header, ...rows].join("\r\n")}\r\n`
}

export function encodeWindows1252(text) {
  const bytes = []
  for (const char of text) {
    const code = char.codePointAt(0)
    bytes.push(code <= 255 ? code : 63)
  }
  return Buffer.from(bytes)
}
