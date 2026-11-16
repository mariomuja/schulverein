import { setVotingClosed } from "../app/actions"
import { formatGermanDateTime } from "../lib/money"

export default function CloseControl({ application, user }) {
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
            <span className="d-block">{application.sealedByName}</span>
          ) : null}
        </div>
      </div>
    )
  }

  if (!user.is_treasurer) {
    return <span className="fw-semibold">Nein</span>
  }

  return (
    <form action={setVotingClosed}>
      <input type="hidden" name="applicationId" value={application.id} />
      <input type="hidden" name="closed" value="true" />
      <button className="btn close-btn btn-primary" type="submit">
        Abschließen
      </button>
    </form>
  )
}
