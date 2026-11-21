"use client"

import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import { updateApplication } from "../app/actions"
import { formatEuro } from "../lib/money"

export default function EditApplication({ application, pots = [], sort, filter, onClose }) {
  const titleId = useId()
  const dateId = useId()
  const applicantId = useId()
  const purposeId = useId()
  const amountId = useId()
  const potFieldId = useId()
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    dialogRef.current?.focus()
    document.body.classList.add("modal-open")

    function onKeyDown(event) {
      if (event.key === "Escape") onCloseRef.current()
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.classList.remove("modal-open")
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  return createPortal(
    <>
      <div className="modal-backdrop fade show" onClick={() => onCloseRef.current()} />
      <div className="modal fade show d-block" role="presentation" onClick={() => onCloseRef.current()}>
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
              onCloseRef.current()
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
                onClick={() => onCloseRef.current()}
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
                    defaultValue={application.purpose}
                    required
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor={potFieldId}>
                    Spendentopf
                  </label>
                  <select
                    id={potFieldId}
                    className="form-select"
                    name="potId"
                    defaultValue={application.pot_id ? String(application.pot_id) : ""}
                  >
                    <option value="">Kein Spendentopf</option>
                    {pots.map((pot) => (
                      <option key={pot.id} value={pot.id}>
                        {pot.name}
                      </option>
                    ))}
                  </select>
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
                    defaultValue={formatEuro(application.amount_cents)}
                    required
                  />
                  <div className="form-text">
                    Solange die Abstimmung nicht abgeschlossen ist, kann der
                    Höchstbetrag geändert werden, auch wenn der Antrag schon
                    genehmigt ist. Der tatsächliche Betrag aus der Rechnung darf
                    niedriger sein.
                  </div>
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
}
