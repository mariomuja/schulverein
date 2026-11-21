"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { addDonation, addDonationPot } from "../app/actions"

function Dialog({ titleId, onClose, children }) {
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
      <div className="modal-backdrop fade show" onClick={onClose} />
      <div className="modal fade show d-block" role="presentation" onClick={onClose}>
        <div
          ref={dialogRef}
          className="modal-dialog modal-dialog-centered"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  )
}

export default function PotDialogs({ potId = null, openName = false, openDonation = false }) {
  const nameTitle = useId()
  const donationTitle = useId()
  const nameId = useId()
  const amountId = useId()
  const purposeId = useId()
  const [nameOpen, setNameOpen] = useState(openName)
  const [donationOpen, setDonationOpen] = useState(openDonation)

  return (
    <>
      <button className="btn btn-sm btn-primary" type="button" onClick={() => setNameOpen(true)}>
        Neuer Spendentopf
      </button>
      {potId ? (
        <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => setDonationOpen(true)}>
          Neue Spende
        </button>
      ) : null}
      {nameOpen ? (
        <Dialog titleId={nameTitle} onClose={() => setNameOpen(false)}>
          <form className="modal-content" action={addDonationPot}>
            <div className="modal-header">
              <h2 className="modal-title h5" id={nameTitle}>
                Neuer Spendentopf
              </h2>
              <button className="btn-close" type="button" aria-label="Schließen" onClick={() => setNameOpen(false)} />
            </div>
            <div className="modal-body">
              <label className="form-label" htmlFor={nameId}>
                Name
              </label>
              <input id={nameId} className="form-control" name="name" maxLength={80} required autoFocus />
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" type="submit">
                Anlegen
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
      {donationOpen && potId ? (
        <Dialog titleId={donationTitle} onClose={() => setDonationOpen(false)}>
          <form className="modal-content" action={addDonation}>
            <div className="modal-header">
              <h2 className="modal-title h5" id={donationTitle}>
                Neue Spende
              </h2>
              <button className="btn-close" type="button" aria-label="Schließen" onClick={() => setDonationOpen(false)} />
            </div>
            <div className="modal-body">
              <input type="hidden" name="potId" value={potId} />
              <div className="mb-3">
                <label className="form-label" htmlFor={amountId}>
                  Betrag in Euro
                </label>
                <input
                  id={amountId}
                  className="form-control"
                  name="amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label" htmlFor={purposeId}>
                  Verwendungszweck
                </label>
                <textarea id={purposeId} className="form-control" name="purpose" rows={3} maxLength={500} required />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" type="submit">
                Spende buchen
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  )
}
