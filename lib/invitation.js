import { createHash } from "crypto"
import { query } from "./db"
import { sendPlainMails } from "./mail.mjs"
import { clubName, renderMail } from "./mail-templates.mjs"
import { listMemberRecords, splitEmails } from "./members"
import { getMailTemplate } from "./outgoing-mail"
import { hashSecret } from "./secret"
import { appendLog } from "./seal"

const emailPattern = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/
const maxPdf = 5 * 1024 * 1024

function addressesOf(member) {
  const seen = new Set()
  const addresses = []
  for (const address of splitEmails(member?.email)) {
    const clean = address.trim()
    const key = clean.toLocaleLowerCase("de")
    if (!emailPattern.test(clean) || seen.has(key)) continue
    seen.add(key)
    addresses.push(clean)
  }
  return addresses
}

async function confirmedMembers() {
  return (await listMemberRecords()).filter((member) => !member.unreadable)
}

export async function invitationContext() {
  const template = await getMailTemplate("versammlung")
  const members = await confirmedMembers()
  let recipientCount = 0
  for (const member of members) {
    if (addressesOf(member).length > 0) recipientCount += 1
  }
  return {
    subject: template?.subject ?? "",
    body: template?.body ?? "",
    recipientCount,
  }
}

export function readAgenda(file) {
  if (!file || typeof file.arrayBuffer !== "function" || Number(file.size) === 0) return null
  if (Number(file.size) > maxPdf) return { error: "pdf" }
  const original = String(file.name ?? "")
  if (!original.toLowerCase().endsWith(".pdf")) return { error: "pdf" }
  return { file, filename: "Tagesordnung.pdf" }
}

async function agendaContent(agenda) {
  if (!agenda) return null
  if (agenda.error) return agenda
  const content = Buffer.from(await agenda.file.arrayBuffer())
  if (content.length > maxPdf || content.subarray(0, 5).toString("latin1") !== "%PDF-") return { error: "pdf" }
  return { filename: agenda.filename, content }
}

function targetsFrom(members) {
  const seen = new Set()
  const targets = []
  for (const member of members) {
    for (const address of addressesOf(member)) {
      const key = address.toLocaleLowerCase("de")
      if (seen.has(key)) continue
      seen.add(key)
      targets.push({
        address,
        givenName: member.givenName ?? "",
        familyName: member.familyName ?? "",
      })
    }
  }
  return targets
}

function rendered(subject, body, target) {
  const values = { Vorname: target.givenName, Name: target.familyName, Verein: clubName }
  return {
    to: target.address,
    subject: renderMail(subject, values).replace(/[\r\n]+/g, " ").trim().slice(0, 200),
    text: renderMail(body, values),
  }
}

export async function deliverInvitation({ user, mode, subject, body, agenda, testAddress }) {
  const cleanSubject = String(subject ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200)
  const cleanBody = String(body ?? "").replace(/\r\n/g, "\n").slice(0, 8000)
  if (!cleanSubject || !cleanBody.trim()) return { error: "Betreff und Text werden benötigt." }
  const attachment = await agendaContent(agenda)
  if (attachment?.error) return { error: "Die Tagesordnung muss eine PDF-Datei mit höchstens 5 MB sein." }

  let targets
  if (mode === "test") {
    const address = String(testAddress ?? "").trim()
    if (!emailPattern.test(address) || address.length > 200) {
      return { error: "Bitte eine gültige E-Mail-Adresse eingeben." }
    }
    targets = [{ address, givenName: "", familyName: "" }]
  } else {
    targets = targetsFrom(await confirmedMembers())
    if (targets.length === 0) return { error: "Es gibt keine Mitglieder mit E-Mail-Adresse." }
  }

  const digest = attachment
    ? createHash("sha256").update(attachment.content).digest("hex")
    : ""
  const batchHash = hashSecret(["invitation", cleanSubject, cleanBody, digest].join("\n"))
  const known = await query(
    `SELECT email_hash FROM invitation_deliveries WHERE batch_hash = $1`,
    [batchHash],
  )
  const already = new Set(known.rows.map((row) => row.email_hash))
  const pending = []
  let skipped = 0
  for (const target of targets) {
    const emailHash = hashSecret(`invitation:${target.address.toLocaleLowerCase("de")}`)
    if (already.has(emailHash)) {
      skipped += 1
      continue
    }
    const message = rendered(cleanSubject, cleanBody, target)
    if (!message.subject || !message.text.trim()) continue
    pending.push({ ...message, emailHash, attachment: attachment ?? undefined })
  }

  const results = pending.length > 0 ? await sendPlainMails(pending) : []
  let sent = 0
  let failed = 0
  for (let index = 0; index < pending.length; index += 1) {
    if (!results[index]) {
      failed += 1
      continue
    }
    sent += 1
    await query(
      `INSERT INTO invitation_deliveries (batch_hash, email_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [batchHash, pending[index].emailHash],
    )
  }

  if (sent > 0) {
    const detail = mode === "test"
      ? "Test der Einladung zur Mitgliederversammlung."
      : `Einladung zur Mitgliederversammlung an ${sent} Adressen gesendet.`
    await appendLog(query, { user, action: "einladung", detail })
  }

  if (mode === "test") {
    if (sent > 0) return { message: "Die Testmail wurde gesendet." }
    if (skipped > 0 && failed === 0) return { message: "Diese Testmail wurde an diese Adresse bereits gesendet." }
    return { error: "Die Testmail konnte nicht zugestellt werden." }
  }
  if (sent === 0 && failed === 0 && skipped > 0) {
    return { message: "Diese Einladung wurde bereits an alle Empfänger gesendet." }
  }
  if (failed > 0) {
    return {
      message: `Die Einladung wurde an ${sent} Adressen gesendet. ${failed} Zustellungen wurden abgelehnt. Ein erneuter Versand mit demselben Text stellt nur die fehlenden zu.`,
    }
  }
  const repeated = skipped > 0 ? " Bereits zugestellte Adressen wurden nicht erneut angeschrieben." : ""
  return { message: `Die Einladung wurde an ${sent} Adressen gesendet.${repeated}` }
}
