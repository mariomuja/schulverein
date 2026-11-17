"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { addReceipts, removeReceipt } from "../app/actions"

function isPdf(name) {
  return String(name).toLowerCase().endsWith(".pdf")
}

const LOUPE_SIZE = 240
const LOUPE_ZOOM = 3

function moveLoupe(event, url, lens) {
  if (!lens) return
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
    lens.hidden = true
    return
  }
  lens.hidden = false
  lens.style.left = `${event.clientX}px`
  lens.style.top = `${event.clientY}px`
  lens.style.backgroundImage = `url("${url}")`
  lens.style.backgroundSize = `${rect.width * LOUPE_ZOOM}px ${rect.height * LOUPE_ZOOM}px`
  lens.style.backgroundPosition = `${LOUPE_SIZE / 2 - x * LOUPE_ZOOM}px ${LOUPE_SIZE / 2 - y * LOUPE_ZOOM}px`
}

function ReceiptPreview({ file, onClose }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const lensRef = useRef(null)
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
                <div className="receipt-preview-stage">
                  <img
                    className="receipt-preview-image"
                    src={url}
                    alt={file.name}
                    onError={() => setFailed(true)}
                    onPointerMove={(event) => {
                      if (event.pointerType === "touch") return
                      moveLoupe(event, url, lensRef.current)
                    }}
                    onPointerLeave={() => {
                      if (lensRef.current) lensRef.current.hidden = true
                    }}
                  />
                  <p className="receipt-loupe-hint text-secondary small text-center mt-2 mb-0">
                    Zum Vergrößern mit der Maus über den Beleg fahren.
                  </p>
                </div>
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
      {url && !pdf && !failed ? <div ref={lensRef} className="receipt-loupe" hidden /> : null}
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
