"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { addUser, deactivateUserToken, removeUser, renewUserToken, updateUserAccess } from "../app/actions"
import { givenName } from "../lib/names"
import CopyTokenButton from "./CopyTokenButton"

const hints = {
  benutzer: "Der Benutzer konnte nicht gespeichert werden. Bitte den Namen prüfen.",
  stimme: "Dieser Benutzer hat bereits abgestimmt und kann nicht entfernt werden.",
}

export default function UserAdmin({ accounts, canAdminister = false, currentUserId }) {
  const params = useSearchParams()
  const hint = params.get("hinweis")
  const message = hints[hint] ?? ""
  const titleId = useId()
  const dialogRef = useRef(null)
  const addFormRef = useRef(null)
  const [open, setOpen] = useState(Boolean(message))
  const [issued, setIssued] = useState(null)

  function close() {
    setIssued(null)
    setOpen(false)
  }

  useEffect(() => {
    if (message) setOpen(true)
  }, [message])

  useEffect(() => {
    if (!open) return undefined
    const dialog = dialogRef.current
    dialog?.focus()
    document.body.classList.add("modal-open")

    function onKeyDown(event) {
      if (event.key === "Escape") close()
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.classList.remove("modal-open")
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        className="user-admin-btn"
        type="button"
        aria-label="Benutzerverwaltung"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <i className="bi bi-person" aria-hidden="true" />
        <span aria-hidden="true">
          Benutzer
          <br />
          verwaltung
        </span>
      </button>
      {open ? (
        <>
          <div className="modal-backdrop fade show" onClick={close} />
          <div className="modal fade show d-block" role="presentation" onClick={close}>
            <div
              ref={dialogRef}
              className="modal-dialog modal-dialog-scrollable modal-lg"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title h5" id={titleId}>
                    Benutzerverwaltung
                  </h2>
                  <button
                    className="btn-close"
                    type="button"
                    aria-label="Schließen"
                    onClick={close}
                  />
                </div>
                <div className="modal-body">
                  {canAdminister ? (
                  <div className="alert alert-light border small mb-3" role="note">
                    <ul className="mb-0 ps-3">
                      <li>
                        <span className="fw-semibold">Token deaktivieren:</span> der Nutzer kann sich
                        nicht mehr anmelden. Das Konto wird nicht gelöscht. Alle Abstimmungen des
                        Nutzers bleiben dauerhaft erhalten.
                      </li>
                      <li>
                        <span className="fw-semibold">Neues Token:</span> das alte Token wird
                        ungültig. Der neue Anmeldelink wird nur dieses eine Mal vollständig angezeigt.
                      </li>
                      <li>
                        <span className="fw-semibold">Entfernen:</span> das Konto wird gelöscht. Dies
                        ist nur möglich, solange der Nutzer noch nicht an Abstimmungen teilgenommen
                        hat.
                      </li>
                      <li>
                        <span className="fw-semibold">Rechte:</span> für Förderanträge Leserecht oder
                        Schreibrecht, für Mitglieder kein Zugang, Leserecht oder Schreibrecht.
                      </li>
                    </ul>
                  </div>
                  ) : (
                    <p className="small text-secondary">
                      Ein neues Token macht den bisherigen Anmeldelink ungültig. Der neue Link wird nur einmal angezeigt.
                    </p>
                  )}
                  {message ? (
                    <div className="alert alert-warning" role="status">
                      {message}
                    </div>
                  ) : null}
                  {issued?.loginUrl ? (
                    <div className="alert alert-info" role="status">
                      <p className="mb-2">
                        Anmeldelink für {givenName(issued.name)}. Er wird nur dieses eine Mal angezeigt.
                      </p>
                      <p className="font-monospace small text-break mb-2">{issued.loginUrl}</p>
                      <CopyTokenButton url={issued.loginUrl} />
                    </div>
                  ) : null}
                  <ul className="list-group list-group-flush mb-3">
                    {accounts.map((account) => (
                      <li className="list-group-item px-0" key={account.id}>
                        <div className="fw-semibold">{givenName(account.name)}</div>
                        <div className="small text-secondary mb-2">
                          {account.roleLabel ? `${account.roleLabel} · ` : ""}
                          {account.canWrite ? "Schreibrecht" : "Leserecht"}
                          {!account.tokenActive ? " · Token deaktiviert" : ""}
                        </div>
                        {canAdminister ? (
                        <form action={updateUserAccess} className="row g-2 align-items-end mb-2">
                          <input type="hidden" name="userId" value={account.id} />
                          <div className="col-12 col-md-4">
                            <label className="form-label small mb-1" htmlFor={`applications-${account.id}`}>
                              Förderanträge
                            </label>
                            <select
                              id={`applications-${account.id}`}
                              className="form-select form-select-sm"
                              name="applicationsAccess"
                              defaultValue={account.canWrite ? "write" : "read"}
                            >
                              <option value="read">Leserecht</option>
                              <option value="write">Schreibrecht</option>
                            </select>
                          </div>
                          <div className="col-12 col-md-4">
                            <label className="form-label small mb-1" htmlFor={`members-${account.id}`}>
                              Mitglieder
                            </label>
                            <select
                              id={`members-${account.id}`}
                              className="form-select form-select-sm"
                              name="membersAccess"
                              defaultValue={account.membersAccess ?? "none"}
                            >
                              <option value="none">Kein Zugang</option>
                              <option value="read">Leserecht</option>
                              <option value="write">Schreibrecht</option>
                            </select>
                          </div>
                          <div className="col-12 col-md-4">
                            <button className="btn btn-outline-primary btn-sm" type="submit">
                              Rechte speichern
                            </button>
                          </div>
                        </form>
                        ) : null}
                        <div className="d-flex flex-wrap gap-2">
                          {canAdminister && account.canWrite && account.tokenActive ? (
                            <form
                              action={async (formData) => {
                                await deactivateUserToken(formData)
                                setIssued((current) =>
                                  current?.id === account.id ? null : current,
                                )
                              }}
                            >
                              <input type="hidden" name="userId" value={account.id} />
                              <button className="btn btn-outline-primary btn-sm" type="submit">
                                Token deaktivieren
                              </button>
                            </form>
                          ) : null}
                          {canAdminister || account.id === currentUserId ? (
                            <form
                              action={async (formData) => {
                                const renewed = await renewUserToken(formData)
                                if (renewed?.loginUrl) setIssued(renewed)
                              }}
                            >
                              <input type="hidden" name="userId" value={account.id} />
                              <button className="btn btn-outline-primary btn-sm" type="submit">
                                Neues Token
                              </button>
                            </form>
                          ) : null}
                          {canAdminister && account.canWrite ? (
                            account.hasVoted ? (
                              <span className="small text-secondary align-self-center">
                                Hat bereits abgestimmt
                              </span>
                            ) : (
                              <form action={removeUser}>
                                <input type="hidden" name="userId" value={account.id} />
                                <button className="btn btn-outline-danger btn-sm" type="submit">
                                  Entfernen
                                </button>
                              </form>
                            )
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {canAdminister ? (
                  <>
                  <h3 className="h6">Benutzer hinzufügen</h3>
                  <form
                    ref={addFormRef}
                    action={async (formData) => {
                      const created = await addUser(formData)
                      if (created?.loginUrl) {
                        addFormRef.current?.reset()
                        setIssued(created)
                      }
                    }}
                    className="row g-3"
                  >
                    <div className="col-12 col-md-5">
                      <label className="form-label" htmlFor="userName">
                        Name
                      </label>
                      <input
                        id="userName"
                        className="form-control"
                        name="name"
                        maxLength={120}
                        required
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label" htmlFor="roleLabel">
                        Rolle
                      </label>
                      <input
                        id="roleLabel"
                        className="form-control"
                        name="roleLabel"
                        maxLength={80}
                        placeholder="optional"
                      />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label" htmlFor="applicationsAccess">
                        Förderanträge
                      </label>
                      <select id="applicationsAccess" className="form-select" name="applicationsAccess" defaultValue="read">
                        <option value="read">Leserecht</option>
                        <option value="write">Schreibrecht</option>
                      </select>
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label" htmlFor="membersAccess">
                        Mitglieder
                      </label>
                      <select id="membersAccess" className="form-select" name="membersAccess" defaultValue="none">
                        <option value="none">Kein Zugang</option>
                        <option value="read">Leserecht</option>
                        <option value="write">Schreibrecht</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <button className="btn btn-primary save-btn" type="submit">
                        Benutzer hinzufügen
                      </button>
                    </div>
                  </form>
                  </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
