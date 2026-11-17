"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { addReceipts, removeReceipt } from "../app/actions"

function isPdf(name) {
  return String(name).toLowerCase().endsWith(".pdf")
}

function ReceiptPreview({ file, onClose }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  onCloseRef.current = onClose
  const pdf = isPdf(file.name)

  useEffect(() => {
    dialogRef.current?.focus()
    document.body.classList.add("modal-open")

    function onKeyDown(event) {
      if (event.key === "Escape") onCloseRef.current()
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.classList.remove("modal-open")
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ""

    async function load() {
      try {
        const response = await fetch(`/beleg/${file.id}`, { signal: controller.signal })
        const type = response.headers.get("content-type") ?? ""
        if (!response.ok || type.includes("text/html")) throw new Error("vorschau")
        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      } catch (error) {
        if (error?.name === "AbortError") return
        setFailed(true)
      }
    }

    load()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file.id])

  return createPortal(
    <>
      <div className="modal-backdrop fade show" onClick={() => onCloseRef.current()} />
      <div
        className="modal fade show d-block"
        role="presentation"
        onClick={() => onCloseRef.current()}
      >
        <div
          ref={dialogRef}
          className="modal-dialog modal-xl modal-dialog-scrollable"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5 text-break" id={titleId}>
                {file.name}
              </h2>
              <button
                className="btn-close"
                type="button"
                aria-label="Schließen"
                onClick={() => onCloseRef.current()}
              />
            </div>
            <div className="modal-body">
              {failed ? (
                <p className="mb-0">Die Vorschau konnte nicht geladen werden.</p>
              ) : null}
              {!failed && !url ? <p className="mb-0">Vorschau wird geladen.</p> : null}
              {url && pdf ? (
                <iframe className="receipt-preview-frame" src={url} title={file.name} />
              ) : null}
              {url && !pdf && !failed ? (
                <img
                  className="receipt-preview-image"
                  src={url}
                  alt={file.name}
                  onError={() => setFailed(true)}
                />
              ) : null}
            </div>
            <div className="modal-footer">
              <a className="btn btn-primary" href={`/beleg/${file.id}`}>
                Herunterladen
              </a>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}

export default function Receipts({ application, user }) {
  const files = application.files ?? []
  const canChange = user.can_write && !application.sealed && !application.voting_closed
  const [preview, setPreview] = useState(null)

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
          <button
            className="btn btn-link btn-sm receipt-name p-0 text-start"
            type="button"
            onClick={() => setPreview(file)}
          >
            {file.name}
          </button>
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
      {preview ? <ReceiptPreview file={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  )
}
