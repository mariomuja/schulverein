"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { saveMember } from "../app/actions"
import { readHandwritingFields } from "../lib/membership-ocr"

const empty = {
  familyName: "",
  givenName: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  email: "",
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

const fieldsOnPaper = [
  ["name", 0.3, 0.206, 0.66, 0.234],
  ["street", 0.3, 0.24, 0.68, 0.27],
  ["place", 0.2, 0.272, 0.62, 0.298],
  ["email", 0.12, 0.298, 0.66, 0.334],
  ["amount", 0.54, 0.358, 0.78, 0.4],
  ["bank", 0.24, 0.736, 0.76, 0.758],
  ["iban", 0.16, 0.754, 0.7, 0.778],
  ["holder", 0.24, 0.778, 0.68, 0.816],
]

function paperBounds(image) {
  const { data, width, height } = image
  const bright = new Uint8Array(width * height)
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    bright[index] = Math.min(red, green, blue) > 150 && red + green + blue > 480 ? 1 : 0
  }
  const seen = new Uint8Array(width * height)
  let best = 0
  let box = null
  for (let start = 0; start < bright.length; start += 1) {
    if (!bright[start] || seen[start]) continue
    const stack = [start]
    seen[start] = 1
    let count = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    while (stack.length) {
      const current = stack.pop()
      count += 1
      const x = current % width
      const y = (current - x) / width
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      const neighbors = [current - 1, current + 1, current - width, current + width]
      for (const next of neighbors) {
        if (next < 0 || next >= bright.length || seen[next] || !bright[next]) continue
        if ((next === current - 1 || next === current + 1) && Math.floor(next / width) !== y) continue
        seen[next] = 1
        stack.push(next)
      }
    }
    if (count > best) {
      best = count
      box = { minX, minY, maxX, maxY }
    }
  }
  if (!box || best < 40) return null
  return box
}

function blurredSheet(source) {
  const width = Math.max(1, Math.round(source.width / 8))
  const height = Math.max(1, Math.round(source.height / 8))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  context.drawImage(source, 0, 0, width, height)
  const image = context.getImageData(0, 0, width, height)
  const radius = 4
  const temporary = new Uint8ClampedArray(image.data.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0
      let green = 0
      let blue = 0
      let count = 0
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sample = Math.min(width - 1, Math.max(0, x + offset))
        const index = (y * width + sample) * 4
        red += image.data[index]
        green += image.data[index + 1]
        blue += image.data[index + 2]
        count += 1
      }
      const target = (y * width + x) * 4
      temporary[target] = red / count
      temporary[target + 1] = green / count
      temporary[target + 2] = blue / count
    }
  }
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      let red = 0
      let green = 0
      let blue = 0
      let count = 0
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sample = Math.min(height - 1, Math.max(0, y + offset))
        const index = (sample * width + x) * 4
        red += temporary[index]
        green += temporary[index + 1]
        blue += temporary[index + 2]
        count += 1
      }
      const target = (y * width + x) * 4
      image.data[target] = red / count
      image.data[target + 1] = green / count
      image.data[target + 2] = blue / count
      image.data[target + 3] = 255
    }
  }
  return image
}

async function canvasFromFile(file) {
  const bitmap = await createImageBitmap(file)
  const landscape = bitmap.width > bitmap.height * 1.05
  const oriented = document.createElement("canvas")
  oriented.width = landscape ? bitmap.height : bitmap.width
  oriented.height = landscape ? bitmap.width : bitmap.height
  const orientedContext = oriented.getContext("2d", { willReadFrequently: true })
  if (landscape) {
    orientedContext.translate(oriented.width, 0)
    orientedContext.rotate(Math.PI / 2)
  }
  orientedContext.drawImage(bitmap, 0, 0)
  bitmap.close?.()
  const sheet = paperBounds(blurredSheet(oriented))
  const source = sheet
    ? {
        x: sheet.minX * 8,
        y: sheet.minY * 8,
        width: Math.max(1, (sheet.maxX - sheet.minX) * 8),
        height: Math.max(1, (sheet.maxY - sheet.minY) * 8),
      }
    : { x: 0, y: 0, width: oriented.width, height: oriented.height }
  const canvas = document.createElement("canvas")
  canvas.width = source.width
  canvas.height = source.height
  canvas.getContext("2d").drawImage(oriented, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height)
  return canvas
}

function handwritingLine(page, box) {
  const [, x0, y0, x1, y1] = box
  const width = Math.max(1, Math.round((x1 - x0) * page.width))
  const height = Math.max(1, Math.round((y1 - y0) * page.height))
  const crop = document.createElement("canvas")
  crop.width = width
  crop.height = height
  const context = crop.getContext("2d", { willReadFrequently: true })
  context.drawImage(page, x0 * page.width, y0 * page.height, width, height, 0, 0, width, height)
  const image = context.getImageData(0, 0, width, height)
  const gray = new Uint8ClampedArray(width * height)
  let darkest = 255
  let lightest = 0
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4
    const value = Math.min(image.data[offset], image.data[offset + 1], image.data[offset + 2])
    gray[index] = value
    darkest = Math.min(darkest, value)
    lightest = Math.max(lightest, value)
  }
  const span = Math.max(1, lightest - darkest)
  for (let index = 0; index < gray.length; index += 1) {
    gray[index] = Math.min(255, Math.max(0, ((gray[index] - darkest) / span) * 255))
  }
  const ruleRows = new Uint8Array(height)
  for (let y = 0; y < height; y += 1) {
    let dark = 0
    for (let x = 0; x < width; x += 1) if (gray[y * width + x] < 170) dark += 1
    if (dark > width * 0.22) {
      for (let offset = -2; offset <= 2; offset += 1) {
        if (y + offset >= 0 && y + offset < height) ruleRows[y + offset] = 1
      }
    }
  }
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < height; y += 1) {
    if (ruleRows[y]) continue
    for (let x = 0; x < width; x += 1) {
      if (gray[y * width + x] >= 120) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX <= minX) {
    minX = 0
    minY = 0
    maxX = width - 1
    maxY = height - 1
  }
  const line = document.createElement("canvas")
  const sourceWidth = Math.max(1, maxX - minX + 20)
  const sourceHeight = Math.max(1, maxY - minY + 16)
  const scale = Math.max(1, 220 / sourceHeight)
  line.width = Math.round(sourceWidth * scale) + 48
  line.height = Math.round(sourceHeight * scale) + 48
  const lineContext = line.getContext("2d")
  lineContext.fillStyle = "#fff"
  lineContext.fillRect(0, 0, line.width, line.height)
  const cropX = Math.max(0, minX - 10)
  const cropY = Math.max(0, minY - 8)
  const source = context.getImageData(
    cropX,
    cropY,
    Math.max(1, Math.min(width - cropX, sourceWidth)),
    Math.max(1, Math.min(height - cropY, sourceHeight)),
  )
  const ink = document.createElement("canvas")
  ink.width = source.width
  ink.height = source.height
  const inkContext = ink.getContext("2d")
  const inkImage = inkContext.createImageData(source.width, source.height)
  for (let index = 0; index < source.width * source.height; index += 1) {
    const offset = index * 4
    const value = Math.min(source.data[offset], source.data[offset + 1], source.data[offset + 2])
    const stretched = Math.min(255, Math.max(0, ((value - darkest) / span) * 255))
    inkImage.data[offset] = stretched
    inkImage.data[offset + 1] = stretched
    inkImage.data[offset + 2] = stretched
    inkImage.data[offset + 3] = 255
  }
  inkContext.putImageData(inkImage, 0, 0)
  lineContext.drawImage(ink, 24, 24, Math.round(source.width * scale), Math.round(source.height * scale))
  return line
}

let readerPromise

function handwritingReader() {
  if (!readerPromise) {
    readerPromise = import("@huggingface/transformers")
      .then(({ pipeline, env }) => {
        env.allowLocalModels = false
        return pipeline("image-to-text", "Xenova/trocr-small-handwritten")
      })
      .catch((error) => {
        readerPromise = null
        throw error
      })
  }
  return readerPromise
}

function lineText(result) {
  if (Array.isArray(result)) return result.map((item) => item.generated_text ?? "").join(" ")
  return String(result?.generated_text ?? "")
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
      street: reading.street ?? "",
      houseNumber: reading.houseNumber ?? "",
      postalCode: reading.postalCode ?? "",
      city: reading.city ?? "",
      email: reading.email ?? "",
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
    setStatus("Das Handschriftmodell wird geladen. Das Foto bleibt in diesem Browser.")
    try {
      if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
        throw new Error("datei")
      }
      const page = await canvasFromFile(file)
      const reader = await handwritingReader()
      const parts = {}
      for (let index = 0; index < fieldsOnPaper.length; index += 1) {
        const field = fieldsOnPaper[index]
        setStatus(`Die Handschrift wird gelesen … ${index + 1} von ${fieldsOnPaper.length}`)
        const line = handwritingLine(page, field)
        parts[field[0]] = lineText(await reader(line))
      }
      applyReading(readHandwritingFields(parts))
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
        <label className="btn btn-sm btn-outline-secondary receipt-add mb-0">
          <i className="bi bi-image" aria-hidden="true" />
          <span className="visually-hidden">Vorhandenes Foto auswählen</span>
          <input className="visually-hidden" type="file" accept="image/*" onChange={onFile} />
        </label>
        <span className="small text-secondary">Aufnehmen oder vorhandenes Foto wählen</span>
      </div>
      {dialog}
    </>
  )
}
