"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { createPortal } from "react-dom"
import { sendAssemblyInvitation } from "../app/actions"

export default function InvitationDialog({ subject, body, recipientCount }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [draftSubject, setDraftSubject] = useState(subject)
  const [draftBody, setDraftBody] = useState(body)
  const [state, action, pending] = useActionState(sendAssemblyInvitation, null)
  const titleId = useId()
  const fileId = useId()
  const testAddressId = useId()

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event) {
      if (event.key === "Escape" && !pending) setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, pending])

  function close() {
    if (!pending) setOpen(false)
  }

  return (
    <>
      <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => setOpen(true)}>
        Einladung zur Mitgliederversammlung
      </button>
      {open && mounted
        ? createPortal(
          <>
            <div className="modal-backdrop fade show" onClick={close} />
            <div className="modal fade show d-block" role="presentation" onClick={close}>
              <div
                className="modal-dialog modal-lg modal-dialog-scrollable"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
              >
                <form action={action} className="modal-content">
                  <div className="modal-header">
                    <h2 className="modal-title h5" id={titleId}>Einladung zur Mitgliederversammlung</h2>
                    <button className="btn-close" type="button" aria-label="Schließen" onClick={close} disabled={pending} />
                  </div>
                  <div className="modal-body">
                    {state?.message ? <div className="alert alert-success" role="status">{state.message}</div> : null}
                    {state?.error ? <div className="alert alert-warning" role="status">{state.error}</div> : null}
                    <div className="mb-3">
                      <label className="form-label" htmlFor="invite-subject">Betreff</label>
                      <input
                        id="invite-subject"
                        className="form-control"
                        name="subject"
                        value={draftSubject}
                        maxLength={200}
                        onChange={(event) => setDraftSubject(event.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="invite-body">Text</label>
                      <textarea
                        id="invite-body"
                        className="form-control"
                        name="body"
                        rows={14}
                        maxLength={8000}
                        value={draftBody}
                        onChange={(event) => setDraftBody(event.target.value)}
                      />
                      <div className="form-text">
                        Platzhalter: {"{Vorname}"} {"{Name}"} {"{Verein}"}. Änderungen gelten für diesen Versand.
                      </div>
                    </div>
                    <div>
                      <label className="form-label" htmlFor={fileId}>Tagesordnung als PDF</label>
                      <input id={fileId} className="form-control" name="agenda" type="file" accept="application/pdf,.pdf" />
                      <div className="form-text">Die Datei wird der E-Mail angehängt. Ohne Datei geht die Einladung ohne Anhang hinaus.</div>
                    </div>
                    {confirmAll ? (
                      <div className="alert alert-warning mt-3 mb-0" role="status">
                        <p className="mb-2">Die Einladung wirklich an {recipientCount} Mitglieder senden?</p>
                        <div className="d-flex flex-wrap gap-2">
                          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setConfirmAll(false)} disabled={pending}>
                            Abbrechen
                          </button>
                          <button className="btn btn-primary btn-sm" type="submit" name="mode" value="all" disabled={pending || recipientCount < 1}>
                            {pending ? "Wird gesendet …" : "Senden"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" type="button" onClick={close} disabled={pending}>
                      Schließen
                    </button>
                    {confirmAll ? null : (
                      <>
                        <div className="d-flex flex-grow-1 flex-wrap align-items-center gap-2">
                          <button className="btn btn-outline-primary" type="submit" name="mode" value="test" disabled={pending}>
                            {pending ? "Wird gesendet …" : "Test an diese Mail-Adresse:"}
                          </button>
                          <label className="visually-hidden" htmlFor={testAddressId}>
                            Mail-Adresse für den Test
                          </label>
                          <input
                            id={testAddressId}
                            className="form-control"
                            style={{ width: "16rem" }}
                            type="email"
                            name="testAddress"
                            inputMode="email"
                            autoComplete="email"
                            maxLength={200}
                            spellCheck={false}
                            disabled={pending}
                          />
                        </div>
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={pending || recipientCount < 1}
                          onClick={() => setConfirmAll(true)}
                        >
                          An alle Mitglieder senden
                        </button>
                      </>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </>,
          document.body,
        )
        : null}
    </>
  )
}
