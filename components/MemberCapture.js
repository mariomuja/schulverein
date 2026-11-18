"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { saveMember } from "../app/actions"
import { readMembership } from "../lib/membership-ocr"

const empty = {
  familyName: "",
  givenName: "",
  furtherNames: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  email: "",
  signedPlace: "",
  signedOn: "",
  bankName: "",
  iban: "",
  accountHolder: "",
}

function Field({ id, label, name, value, onChange, type = "text", required = false, hint = "" }) {
  return (
    <div className="col-12 col-md-6">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="form-control"
        name={name}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <div className="form-text">{hint}</div> : null}
    </div>
  )
}

async function canvasFromFile(file) {
  const bitmap = await createImageBitmap(file)
  const landscape = bitmap.width > bitmap.height * 1.05
  const sourceWidth = landscape ? bitmap.height : bitmap.width
  const sourceHeight = landscape ? bitmap.width : bitmap.height
  const scale = Math.min(2, 2200 / Math.max(sourceWidth, 1))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(sourceWidth * Math.max(scale, 1))
  canvas.height = Math.round(sourceHeight * Math.max(scale, 1))
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (landscape) {
    context.translate(canvas.width, 0)
    context.rotate(Math.PI / 2)
    context.drawImage(bitmap, 0, 0, canvas.height, canvas.width)
  } else {
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  }
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = image.data
  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.3 + data[index + 1] * 0.59 + data[index + 2] * 0.11
    const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.35 + 128))
    data[index] = contrast
    data[index + 1] = contrast
    data[index + 2] = contrast
  }
  context.putImageData(image, 0, 0)
  bitmap.close?.()
  return canvas
}

export default function MemberCapture() {
  const titleId = useId()
  const dialogRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState(empty)
  const [choice, setChoice] = useState("")
  const [customAmount, setCustomAmount] = useState("")
  const [status, setStatus] = useState("")
  const [reading, setReading] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    dialogRef.current?.focus()
    document.body.classList.add("modal-open")
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.classList.remove("modal-open")
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function setField(key, value) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  function applyReading(reading) {
    setFields({
      familyName: reading.familyName ?? "",
      givenName: reading.givenName ?? "",
      furtherNames: reading.furtherNames ?? "",
      street: reading.street ?? "",
      houseNumber: reading.houseNumber ?? "",
      postalCode: reading.postalCode ?? "",
      city: reading.city ?? "",
      email: reading.email ?? "",
      signedPlace: reading.signedPlace ?? "",
      signedOn: reading.signedOn ?? "",
      bankName: reading.bankName ?? "",
      iban: reading.iban ?? "",
      accountHolder: reading.accountHolder ?? "",
    })
    if (reading.contributionCents === 2200) {
      setChoice("22")
      setCustomAmount("")
    } else if (reading.contributionCents === 2500) {
      setChoice("25")
      setCustomAmount("")
    } else if (reading.contributionCents) {
      setChoice("custom")
      setCustomAmount((reading.contributionCents / 100).toFixed(2).replace(".", ","))
    } else {
      setChoice("")
      setCustomAmount("")
    }
  }

  async function onFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setOpen(true)
    setReading(true)
    setFields(empty)
    setChoice("")
    setCustomAmount("")
    setStatus("Die Handschrift wird gelesen. Das Foto bleibt in diesem Browser.")
    try {
      if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
        throw new Error("datei")
      }
      const canvas = await canvasFromFile(file)
      const { createWorker } = await import("tesseract.js")
      const worker = await createWorker("deu", 1, {
        logger: (message) => {
          if (message.status === "recognizing text" && typeof message.progress === "number") {
            setStatus(`Die Handschrift wird gelesen … ${Math.round(message.progress * 100)} %`)
          }
        },
      })
      const result = await worker.recognize(canvas)
      await worker.terminate()
      applyReading(readMembership(result.data.text))
      setStatus("Bitte die erkannten Felder prüfen. Die IBAN ist nur in diesem Dialog sichtbar.")
    } catch {
      setStatus("Die Erkennung ist fehlgeschlagen. Die Felder können von Hand ausgefüllt werden.")
    } finally {
      setReading(false)
    }
  }

  const dialog = open
    ? createPortal(
        <>
          <div className="modal-backdrop fade show" onClick={() => setOpen(false)} />
          <div className="modal fade show d-block" role="presentation" onClick={() => setOpen(false)}>
            <div
              ref={dialogRef}
              className="modal-dialog modal-lg modal-dialog-scrollable"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
            >
              <form action={saveMember} className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title h5" id={titleId}>
                    Mitglied aus Beitrittserklärung
                  </h2>
                  <button className="btn-close" type="button" aria-label="Schließen" onClick={() => setOpen(false)} />
                </div>
                <div className="modal-body">
                  {status ? (
                    <div className="alert alert-info" role="status">
                      {status}
                    </div>
                  ) : null}
                  <div className="row g-3">
                    <Field id="familyName" label="Name" name="familyName" value={fields.familyName} onChange={(value) => setField("familyName", value)} required />
                    <Field id="givenName" label="Vorname" name="givenName" value={fields.givenName} onChange={(value) => setField("givenName", value)} required />
                    <Field id="furtherNames" label="Weitere Antragsteller" name="furtherNames" value={fields.furtherNames} onChange={(value) => setField("furtherNames", value)} />
                    <Field id="street" label="Straße" name="street" value={fields.street} onChange={(value) => setField("street", value)} />
                    <Field id="houseNumber" label="Hausnummer" name="houseNumber" value={fields.houseNumber} onChange={(value) => setField("houseNumber", value)} />
                    <Field id="postalCode" label="PLZ" name="postalCode" value={fields.postalCode} onChange={(value) => setField("postalCode", value)} />
                    <Field id="city" label="Ort" name="city" value={fields.city} onChange={(value) => setField("city", value)} />
                    <Field id="email" label="E-Mail-Adresse" name="email" type="email" value={fields.email} onChange={(value) => setField("email", value)} />
                    <div className="col-12">
                      <div className="form-label">Beitrag pro Schuljahr</div>
                      <div className="d-flex flex-wrap align-items-center gap-3">
                        <div className="form-check">
                          <input className="form-check-input" type="radio" name="contributionChoice" id="fee22" value="22" checked={choice === "22"} onChange={() => setChoice("22")} required />
                          <label className="form-check-label" htmlFor="fee22">22,00 €</label>
                        </div>
                        <div className="form-check">
                          <input className="form-check-input" type="radio" name="contributionChoice" id="fee25" value="25" checked={choice === "25"} onChange={() => setChoice("25")} />
                          <label className="form-check-label" htmlFor="fee25">25,00 €</label>
                        </div>
                        <div className="form-check d-flex align-items-center gap-2">
                          <input className="form-check-input mt-0" type="radio" name="contributionChoice" id="feeCustom" value="custom" checked={choice === "custom"} onChange={() => setChoice("custom")} />
                          <label className="form-check-label" htmlFor="feeCustom">Eigener Betrag</label>
                          <input className="form-control form-control-sm" style={{ width: "7rem" }} name="contributionCustom" inputMode="decimal" value={customAmount} aria-label="Eigener Beitrag in Euro" onChange={(event) => { setCustomAmount(event.target.value); setChoice("custom") }} />
                        </div>
                      </div>
                    </div>
                    <Field id="signedPlace" label="Ort der Unterschrift" name="signedPlace" value={fields.signedPlace} onChange={(value) => setField("signedPlace", value)} />
                    <Field id="signedOn" label="Datum" name="signedOn" type="date" value={fields.signedOn} onChange={(value) => setField("signedOn", value)} />
                    <Field id="bankName" label="Name der Bank" name="bankName" value={fields.bankName} onChange={(value) => setField("bankName", value)} />
                    <Field id="iban" label="IBAN" name="iban" value={fields.iban} onChange={(value) => setField("iban", value)} hint="Nur hier sichtbar. Nach dem Speichern steht in der Liste ein Platzhalter." />
                    <Field id="accountHolder" label="Kontoinhaber" name="accountHolder" value={fields.accountHolder} onChange={(value) => setField("accountHolder", value)} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" type="button" onClick={() => setOpen(false)}>
                    Abbrechen
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={reading}>
                    Mitglied speichern
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>,
        document.body,
      )
    : null

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3">
        <label className="btn btn-sm btn-outline-secondary receipt-add mb-0">
          <i className="bi bi-camera" aria-hidden="true" />
          <span className="visually-hidden">Beitrittserklärung fotografieren</span>
          <input className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={onFile} />
        </label>
        <span className="small text-secondary">Foto der Beitrittserklärung lesen</span>
      </div>
      {dialog}
    </>
  )
}
