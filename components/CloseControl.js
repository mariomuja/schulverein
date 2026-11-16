import { setVotingClosed } from "../app/actions"

export default function CloseControl({ application, user }) {
  if (!user.is_treasurer) {
    return (
      <span className="fw-semibold">
        {application.voting_closed ? "Ja" : "Nein"}
      </span>
    )
  }

  return (
    <form action={setVotingClosed}>
      <input type="hidden" name="applicationId" value={application.id} />
      <input
        type="hidden"
        name="closed"
        value={application.voting_closed ? "false" : "true"}
      />
      <button
        className={`btn close-btn ${application.voting_closed ? "btn-outline-secondary" : "btn-primary"}`}
        type="submit"
      >
        {application.voting_closed ? "Wieder öffnen" : "Abschließen"}
      </button>
    </form>
  )
}
