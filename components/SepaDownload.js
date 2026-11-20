"use client"

import { useEffect, useId, useRef, useState } from "react"

export default function SepaDownload() {
  const titleId = useId()
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
        className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
        type="button"
        onClick={() => setOpen(true)}
      >
        <i className="bi bi-download" aria-hidden="true" />
        SEPA
      </button>
      {open ? (
        <>
          <div className="modal-backdrop fade show" onClick={() => setOpen(false)} />
          <div className="modal fade show d-block" role="presentation" onClick={() => setOpen(false)}>
            <div
              ref={dialogRef}
              className="modal-dialog modal-dialog-centered"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title h5" id={titleId}>
                    Vorankündigung
                  </h2>
                  <button className="btn-close" type="button" aria-label="Schließen" onClick={() => setOpen(false)} />
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Vor der Abbuchung sollte eine E-Mail an alle Mitglieder als Vorankündigung gesendet
                    werden, um die Zahl der Rückläufer klein zu halten. Die Adressen stehen in der Datei
                    unter eMails.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" type="button" onClick={() => setOpen(false)}>
                    Abbrechen
                  </button>
                  <a className="btn btn-primary" href="/mitglieder/sepa">
                    SEPA-Liste herunterladen
                  </a>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
