import { castVote } from "../app/actions"

function label(decision) {
  if (decision === "yes") return "Ja"
  if (decision === "no") return "Nein"
  return "—"
}

export default function VoteControl({ application, voter, user }) {
  const decision = application.votes[voter.id] ?? null
  const canEdit =
    user.can_write && user.id === voter.id && !application.voting_closed

  if (!canEdit) {
    return <span className="fw-semibold">{label(decision)}</span>
  }

  return (
    <div className="d-grid gap-2 d-xl-flex">
      <form action={castVote}>
        <input type="hidden" name="applicationId" value={application.id} />
        <input type="hidden" name="decision" value="yes" />
        <button
          className={`btn vote-btn ${decision === "yes" ? "btn-success" : "btn-outline-success"}`}
          type="submit"
        >
          Zustimmen
        </button>
      </form>
      <form action={castVote}>
        <input type="hidden" name="applicationId" value={application.id} />
        <input type="hidden" name="decision" value="no" />
        <button
          className={`btn vote-btn ${decision === "no" ? "btn-danger" : "btn-outline-danger"}`}
          type="submit"
        >
          Ablehnen
        </button>
      </form>
    </div>
  )
}
