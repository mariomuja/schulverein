export default function StatusIcon({ approved }) {
  if (approved) {
    return (
      <span className="text-success" role="img" aria-label="genehmigt">
        <i className="bi bi-check-circle-fill fs-4" aria-hidden="true" />
      </span>
    )
  }
  return (
    <span className="text-danger" role="img" aria-label="nicht genehmigt">
      <i className="bi bi-x-circle-fill fs-4" aria-hidden="true" />
    </span>
  )
}
