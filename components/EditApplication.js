"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { updateApplication } from "../app/actions"
import { formatEuro } from "../lib/money"

export default function EditApplication({ application, sort, filter }) {
  const titleId = useId()
  const dateId = useId()
  const applicantId = useId()
  const purposeId = useId()
  const amountId = useId()
  const dialogRef = useRef(null)
  const [open, setOpen] = useState(false)

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
        className="btn btn-outline-secondary btn-sm edit-application mt-2"
        type="button"
        onClick={() => setOpen(true)}
      >
        Korrigieren
      </button>
      {open
        ? createPortal(
        <>
          <div className="modal-backdrop fade show" onClick={() => setOpen(false)} />
          <div className="modal fade show d-block" role="presentation" onClick={() => setOpen(false)}>
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
                className="modal-content"
                action={async (formData) => {
                  await updateApplication(formData)
                  setOpen(false)
                }}
              >
                <div className="modal-header">
                  <h2 className="modal-title h5" id={titleId}>
                    Förderantrag korrigieren
                  </h2>
                  <button
                    className="btn-close"
                    type="button"
                    aria-label="Schließen"
                    onClick={() => setOpen(false)}
                  />
                </div>
                <div className="modal-body">
                  <input type="hidden" name="applicationId" value={application.id} />
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
                        defaultValue={application.application_date}
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
                        defaultValue={application.applicant}
                        required
                        autoComplete="given-name"
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
                        defaultValue={application.purpose}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label" htmlFor={amountId}>
                        Betrag in EUR
                      </label>
                      <input
                        id={amountId}
                        className="form-control"
                        name="amount"
                        inputMode="decimal"
                        defaultValue={formatEuro(application.amount_cents)}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary save-btn" type="submit">
                    Speichern
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
