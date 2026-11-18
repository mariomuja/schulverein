"use client"

import { useState } from "react"
import { setVotingClosed } from "../app/actions"
import { formatGermanDateTime } from "../lib/money"

const missingReceiptMessage =
  "Die Abstimmung kann erst abgeschlossen werden, wenn ein Beleg hinterlegt ist."

export default function CloseControl({ application, user }) {
  const [missingReceipt, setMissingReceipt] = useState(false)
  const hasReceipt = (application.files ?? []).length > 0

  if (application.voting_closed) {
    return (
      <div>
        <div className="fw-semibold">Ja</div>
        <div className="seal-meta">
          Festgeschrieben
          {application.sealedAt ? (
            <span className="d-block">{formatGermanDateTime(application.sealedAt)}</span>
          ) : null}
          {application.sealedByName ? (
            <span className="d-block">von {application.sealedByName}</span>
          ) : null}
          {application.proofOk === false ? (
            <span className="d-block">Prüfcode passt nicht zur Stimmenliste.</span>
          ) : null}
        </div>
      </div>
    )
  }

  if (!user.is_treasurer) {
    return <span className="fw-semibold">Nein</span>
  }

  function keepCardClosed(event) {
    event.stopPropagation()
  }

  if (!hasReceipt) {
    return (
      <div className="close-control" onClick={keepCardClosed}>
        <button
          className="btn close-btn btn-primary"
          type="button"
          onClick={() => setMissingReceipt(true)}
        >
          Abschließen
        </button>
        {missingReceipt ? (
          <div className="alert alert-warning mt-2 mb-0 py-2" role="alert">
            {missingReceiptMessage}
          </div>
        ) : (
          <div className="seal-meta">Beleg fehlt</div>
        )}
      </div>
    )
  }

  return (
    <form className="close-control" action={setVotingClosed} onClick={keepCardClosed}>
      <input type="hidden" name="applicationId" value={application.id} />
      <input type="hidden" name="closed" value="true" />
      <button className="btn close-btn btn-primary" type="submit">
        Abschließen
      </button>
    </form>
  )
}
