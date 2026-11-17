"use client"

import { addReceipts, removeReceipt } from "../app/actions"

export default function Receipts({ application, user }) {
  const files = application.files ?? []
  const canChange = user.can_write && !application.sealed && !application.voting_closed

  return (
    <div className="d-flex flex-column align-items-start gap-1">
      {canChange ? (
        <form action={addReceipts}>
          <input type="hidden" name="applicationId" value={application.id} />
          <label className="btn btn-sm btn-outline-secondary receipt-add">
            <i className="bi bi-camera" aria-hidden="true" />
            <span className="visually-hidden">Beleg hinzufügen</span>
            <input
              className="visually-hidden"
              type="file"
              name="files"
              accept="image/*,.pdf,.heic,.heif"
              multiple
              onChange={(event) => {
                if (event.currentTarget.files?.length) event.currentTarget.form?.requestSubmit()
              }}
            />
          </label>
        </form>
      ) : null}
      {files.map((file) => (
        <div className="d-flex align-items-start gap-1" key={file.id}>
          <a className="small receipt-name" href={`/beleg/${file.id}`}>
            {file.name}
          </a>
          {canChange ? (
            <form action={removeReceipt}>
              <input type="hidden" name="fileId" value={file.id} />
              <button
                className="btn btn-link btn-sm receipt-remove p-0"
                type="submit"
                aria-label={`${file.name} entfernen`}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </form>
          ) : null}
        </div>
      ))}
    </div>
  )
}
