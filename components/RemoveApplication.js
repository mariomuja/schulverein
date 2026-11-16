import { removeApplication } from "../app/actions"

export default function RemoveApplication({ applicationId }) {
  return (
    <form action={removeApplication} className="mt-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <button className="btn btn-outline-danger btn-sm remove-application" type="submit">
        Entfernen
      </button>
    </form>
  )
}
