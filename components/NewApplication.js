"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { addApplication } from "../app/actions"

export default function NewApplication({ sort, filter, openOnError = false }) {
  const titleId = useId()
  const dateId = useId()
  const applicantId = useId()
  const purposeId = useId()
  const amountId = useId()
  const dialogRef = useRef(null)
  const formRef = useRef(null)
  const [open, setOpen] = useState(openOnError)

  useEffect(() => {
    if (openOnError) setOpen(true)
  }, [openOnError])

  useEffect(() => {
    if (!open) return undefined
    dialogRef.current?.focus()
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
        className="btn btn-sm btn-primary ms-auto"
        type="button"
        onClick={() => setOpen(true)}
      >
        Neuer Förderantrag
      </button>
      {open
        ? createPortal(
            <>
              <div className="modal-backdrop fade show" onClick={() => setOpen(false)} />
              <div
                className="modal fade show d-block"
                role="presentation"
                onClick={() => setOpen(false)}
              >
                <div
                  ref={dialogRef}
                  className="modal-dialog modal-dialog-scrollable"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  tabIndex={-1}
                  onClick={(event) => event.stopPropagation()}
                >
                  <form
                    ref={formRef}
                    className="modal-content"
                    action={async (formData) => {
                      await addApplication(formData)
                      formRef.current?.reset()
                      setOpen(false)
                    }}
                  >
                    <div className="modal-header">
                      <h2 className="modal-title h5" id={titleId}>
                        Neuer Förderantrag
                      </h2>
                      <button
                        className="btn-close"
                        type="button"
                        aria-label="Schließen"
                        onClick={() => setOpen(false)}
                      />
                    </div>
                    <div className="modal-body">
                      <input type="hidden" name="sort" value={sort} />
                      <input type="hidden" name="filter" value={filter} />
                      <div className="row g-3">
                        <div className="col-12 col-md-5">
                          <label className="form-label" htmlFor={dateId}>
                            Datum
                          </label>
                          <input
                            id={dateId}
                            className="form-control"
                            type="date"
                            name="applicationDate"
                            required
                          />
                        </div>
                        <div className="col-12 col-md-7">
                          <label className="form-label" htmlFor={applicantId}>
                            Antragsteller
                          </label>
                          <input
                            id={applicantId}
                            className="form-control"
                            name="applicant"
                            maxLength={120}
                            required
                            placeholder="Vor- und Nachname"
                            autoComplete="name"
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label" htmlFor={purposeId}>
                            Zweck
                          </label>
                          <textarea
                            id={purposeId}
                            className="form-control"
                            name="purpose"
                            rows={3}
                            maxLength={500}
                            required
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label" htmlFor={amountId}>
                            Höchstbetrag in EUR
                          </label>
                          <input
                            id={amountId}
                            className="form-control"
                            name="amount"
                            inputMode="decimal"
                            placeholder="0,00"
                            required
                          />
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-primary save-btn" type="submit">
                        Antrag hinzufügen
                      </button>
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
