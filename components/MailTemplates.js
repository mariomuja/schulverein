"use client"

import { useState } from "react"
import { saveMailTemplate } from "../app/actions"
import { clubName, mailPlaceholders } from "../lib/mail-templates.mjs"

export default function MailTemplates({ templates, canEdit, initialId }) {
  const known = templates.some((template) => template.id === initialId)
  const [selected, setSelected] = useState(known ? initialId : templates[0]?.id ?? "")
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(templates.map((template) => [template.id, { subject: template.subject, body: template.body }])),
  )
  const current = drafts[selected] ?? { subject: "", body: "" }

  function updateDraft(field, value) {
    setDrafts((existing) => ({
      ...existing,
      [selected]: { ...existing[selected], [field]: value },
    }))
  }

  if (templates.length === 0) return null

  return (
    <form
      action={canEdit ? saveMailTemplate : undefined}
      className="row g-3"
      onSubmit={(event) => {
        if (!canEdit) event.preventDefault()
      }}
    >
      <div className="col-12 col-md-6 col-lg-4">
        <select
          className="form-select"
          aria-label="E-Mail-Vorlage"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor="mail-subject">
          Betreff
        </label>
        <input
          id="mail-subject"
          className="form-control"
          name={canEdit ? "subject" : undefined}
          value={current.subject}
          maxLength={200}
          readOnly={!canEdit}
          onChange={(event) => updateDraft("subject", event.target.value)}
        />
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor="mail-body">
          Text
        </label>
        <textarea
          id="mail-body"
          className="form-control"
          name={canEdit ? "body" : undefined}
          rows={16}
          maxLength={8000}
          readOnly={!canEdit}
          value={current.body}
          onChange={(event) => updateDraft("body", event.target.value)}
        />
        <div className="form-text">
          Platzhalter: {mailPlaceholders.map((name) => `{${name}}`).join(" ")}. {"{Verein}"} ist der {clubName}.
        </div>
      </div>
      {canEdit ? (
        <div className="col-12">
          <input type="hidden" name="templateId" value={selected} />
          <button className="btn btn-primary" type="submit">
            Speichern
          </button>
        </div>
      ) : null}
    </form>
  )
}
