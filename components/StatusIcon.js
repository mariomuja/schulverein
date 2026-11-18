import { statusSentence } from "../lib/decision"

export default function StatusIcon({ application }) {
  const approved = Boolean(application.approved)
  return (
    <span className="status-mark">
      <span className="status-mark-text">{statusSentence(application)}</span>
      <span className={approved ? "text-success" : "text-danger"} aria-hidden="true">
        <i
          className={`bi ${approved ? "bi-check-circle-fill" : "bi-x-circle-fill"} fs-4`}
        />
      </span>
    </span>
  )
}
