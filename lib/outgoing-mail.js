import { query } from "./db"
import { sendPlainMail } from "./mail.mjs"
import { clubName, renderMail, templateDefaults } from "./mail-templates.mjs"

function knownTemplate(id) {
  return templateDefaults.find((template) => template.id === id) ?? null
}

export async function listMailTemplates() {
  const stored = new Map()
  try {
    const { rows } = await query(`SELECT id, subject, body FROM mail_templates`)
    for (const row of rows) stored.set(row.id, row)
  } catch {
    // Ohne Tabelle gelten die mitgelieferten Texte.
  }
  return templateDefaults.map((template) => {
    const row = stored.get(template.id)
    if (!row) return { ...template }
    return { ...template, subject: row.subject, body: row.body }
  })
}

export async function getMailTemplate(id) {
  const templates = await listMailTemplates()
  return templates.find((template) => template.id === id) ?? null
}

export async function updateMailTemplate(id, subject, body) {
  if (!knownTemplate(id)) return false
  const result = await query(
    `UPDATE mail_templates SET subject = $2, body = $3 WHERE id = $1`,
    [id, subject, body],
  )
  return result.rowCount > 0
}

export async function sendTemplateMail({ templateId, addresses, values }) {
  const template = await getMailTemplate(templateId)
  if (!template) return false
  const rendered = { Verein: clubName, ...values, Verein: clubName }
  const subject = renderMail(template.subject, rendered).replace(/[\r\n]+/g, " ").trim()
  const text = renderMail(template.body, rendered)
  if (!subject || !text.trim()) return false
  const list = Array.isArray(addresses) ? addresses : []
  if (list.length === 0) return false
  let failed = 0
  for (const address of list) {
    const sent = await sendPlainMail({ to: address, subject, text })
    if (!sent) failed += 1
  }
  if (failed === list.length) return false
  if (failed > 0) return "partial"
  return true
}
