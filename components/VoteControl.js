import { castVote } from "../app/actions"

function label(decision) {
  if (decision === "yes") return "Ja"
  if (decision === "no") return "Nein"
  return "—"
}

function VoteLabel({ text }) {
  const words = text.split(/\s+/).filter(Boolean)
  return words.map((word, index) => (
    <span key={`${index}-${word}`}>
      {index > 0 ? " " : null}
      <span className="vote-word">{word}</span>
    </span>
  ))
}

export default function VoteControl({ application, voter, user, compact = false }) {
  const decision = application.votes[voter.id] ?? null
  const canEdit =
    user.can_write && user.id === voter.id && !application.voting_closed

  if (!canEdit) {
    return <span className="fw-semibold">{label(decision)}</span>
  }

  if (compact) {
    return (
      <span className="d-inline-flex gap-1">
        <form action={castVote}>
          <input type="hidden" name="applicationId" value={application.id} />
          <input type="hidden" name="decision" value="yes" />
          <button
            className={`btn vote-btn vote-btn-compact ${decision === "yes" ? "btn-success" : "btn-outline-success"}${decision === "no" ? " vote-btn-dim" : ""}`}
            type="submit"
            aria-label="Ich stimme zu"
          >
            Ja
          </button>
        </form>
        <form action={castVote}>
          <input type="hidden" name="applicationId" value={application.id} />
          <input type="hidden" name="decision" value="no" />
          <button
            className={`btn vote-btn vote-btn-compact ${decision === "no" ? "btn-danger" : "btn-outline-danger"}${decision === "yes" ? " vote-btn-dim" : ""}`}
            type="submit"
            aria-label="Ich stimme nicht zu"
          >
            Nein
          </button>
        </form>
      </span>
    )
  }

  return (
    <div className="d-grid gap-1">
      <form action={castVote}>
        <input type="hidden" name="applicationId" value={application.id} />
        <input type="hidden" name="decision" value="yes" />
        <button
          className={`btn vote-btn ${decision === "yes" ? "btn-success" : "btn-outline-success"}${decision === "no" ? " vote-btn-dim" : ""}`}
          type="submit"
        >
          <VoteLabel text="Ich stimme zu" />
        </button>
      </form>
      <form action={castVote}>
        <input type="hidden" name="applicationId" value={application.id} />
        <input type="hidden" name="decision" value="no" />
        <button
          className={`btn vote-btn ${decision === "no" ? "btn-danger" : "btn-outline-danger"}${decision === "yes" ? " vote-btn-dim" : ""}`}
          type="submit"
        >
          <VoteLabel text="Ich stimme nicht zu" />
        </button>
      </form>
    </div>
  )
}
