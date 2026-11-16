"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { addUser, removeUser } from "../app/actions"
import { givenName } from "../lib/names"
import CopyLink from "./CopyLink"

const hints = {
  benutzer: "Der Benutzer konnte nicht gespeichert werden. Bitte den Namen prüfen.",
  stimme: "Dieser Benutzer hat bereits abgestimmt und kann nicht entfernt werden.",
}

export default function UserAdmin({ accounts }) {
  const params = useSearchParams()
  const hint = params.get("hinweis")
  const message = hints[hint] ?? ""
  const titleId = useId()
  const dialogRef = useRef(null)
  const addFormRef = useRef(null)
  const [open, setOpen] = useState(Boolean(message))

  useEffect(() => {
    if (message) setOpen(true)
  }, [message])

  useEffect(() => {
    if (!open) return undefined
    const dialog = dialogRef.current
    dialog?.focus()
    document.body.classList.add("modal-open")

    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false)
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
          <div className="modal-backdrop fade show" onClick={() => setOpen(false)} />
          <div
            className="modal fade show d-block"
            role="presentation"
            onClick={() => setOpen(false)}
          >
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
                    onClick={() => setOpen(false)}
                  />
                </div>
                <div className="modal-body">
                  {message ? (
                    <div className="alert alert-warning" role="status">
                      {message}
                    </div>
                  ) : null}
                  <ul className="list-group list-group-flush mb-3">
                    {accounts.map((account) => (
                      <li className="list-group-item px-0" key={account.id}>
                        <div className="d-flex flex-column flex-sm-row justify-content-between gap-2">
                          <div>
                            <div className="fw-semibold">{givenName(account.name)}</div>
                            <div className="small text-secondary">
                              {account.roleLabel ? `${account.roleLabel} · ` : ""}
                              {account.canWrite ? "Schreibrecht" : "Leserecht"}
                            </div>
                          </div>
                          {account.hasVoted ? (
                            <div className="small text-secondary align-self-sm-center">
                              Hat bereits abgestimmt
                            </div>
                          ) : (
                            <form action={removeUser} className="align-self-sm-center">
                              <input type="hidden" name="userId" value={account.id} />
                              <button className="btn btn-outline-danger btn-sm" type="submit">
                                Entfernen
                              </button>
                            </form>
                          )}
                        </div>
                        <div className="mt-2">
                          <CopyLink href={account.loginUrl} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <h3 className="h6">Benutzer hinzufügen</h3>
                  <form
                    ref={addFormRef}
                    action={async (formData) => {
                      await addUser(formData)
                      addFormRef.current?.reset()
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
                    <div className="col-12 col-md-3 d-flex align-items-end">
                      <div className="form-check mb-2">
                        <input
                          id="canWrite"
                          className="form-check-input"
                          type="checkbox"
                          name="canWrite"
                        />
                        <label className="form-check-label" htmlFor="canWrite">
                          Schreibrecht
                        </label>
                      </div>
                    </div>
                    <div className="col-12">
                      <button className="btn btn-primary save-btn" type="submit">
                        Benutzer hinzufügen
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
