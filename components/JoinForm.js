"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { lookupBank, submitJoin } from "../app/actions"
import { germanIbanParts, validGermanIban } from "../lib/iban.mjs"
import { parseEuroToCents } from "../lib/money"
import { validEmail } from "../lib/patterns.mjs"

const messages = {
  angaben: "Bitte Name, Vorname, E-Mail-Adresse, Beitrag und IBAN prüfen.",
  email: "Bitte eine gültige E-Mail-Adresse eingeben.",
  iban: "Die IBAN ist keine gültige deutsche IBAN. Sie beginnt mit DE und hat danach 20 Ziffern.",
  bank: "Zu dieser IBAN ist keine Bank im Verzeichnis hinterlegt.",
  warte: "Bitte lies den Hinweis zur IBAN und sende das Formular danach erneut.",
  alt: "Das Formular war zu lange offen. Bitte lade die Seite neu.",
  mail: "Die Bestätigungsmail konnte nicht gesendet werden. Bitte versuche es später erneut.",
  rate: "Es wurden zu viele Anfragen gesendet. Bitte versuche es später erneut.",
}

function SubmitButton({ ready }) {
  const { pending } = useFormStatus()
  return (
    <button className="btn btn-primary" type="submit" disabled={!ready || pending}>
      {pending ? "Wird gesendet…" : "Angaben senden"}
    </button>
  )
}

function FieldHelp({ label, text }) {
  const tipId = useId()
  const [open, setOpen] = useState(false)
  return (
    <span className={`join-help${open ? " is-open" : ""}`}>
      <button
        className="join-help-button"
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={tipId}
        onClick={(event) => {
          event.preventDefault()
          setOpen((current) => !current)
        }}
      >
        ?
      </button>
      <span className="join-help-bubble" id={tipId} role="tooltip">
        {text}
      </span>
    </span>
  )
}

export default function JoinForm({ ticket }) {
  const router = useRouter()
  const titleId = useId()
  const lookupSeq = useRef(0)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState("")
  const [emailInvalid, setEmailInvalid] = useState(false)
  const [ibanInvalid, setIbanInvalid] = useState(false)
  const [bankMissing, setBankMissing] = useState(false)
  const [looking, setLooking] = useState(false)
  const [givenName, setGivenName] = useState("")
  const [familyName, setFamilyName] = useState("")
  const [email, setEmail] = useState("")
  const [amount, setAmount] = useState("")
  const [iban, setIban] = useState("")
  const [bank, setBank] = useState(null)
  const [choice, setChoice] = useState("")
  const [seal, setSeal] = useState(ticket)

  useEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    setSeal(ticket)
  }, [ticket])

  const contributionOk = choice === "22" || (choice === "custom" && parseEuroToCents(amount) != null && parseEuroToCents(amount) <= 100000)
  const complete = givenName.trim() !== ""
    && familyName.trim() !== ""
    && validEmail(email)
    && contributionOk
    && validGermanIban(iban)
    && Boolean(bank?.bic)
    && Boolean(bank?.name)
    && !looking

  async function resolveBank(value) {
    const seq = ++lookupSeq.current
    const parts = germanIbanParts(value)
    if (!parts || parts.country !== "DE") {
      setBank(null)
      setBankMissing(false)
      setLooking(false)
      return
    }
    setLooking(true)
    setBank(null)
    setBankMissing(false)
    try {
      const found = await lookupBank(parts.bankCode)
      if (seq !== lookupSeq.current) return
      setBank(found)
      setBankMissing(!found)
    } catch {
      if (seq !== lookupSeq.current) return
      setBank(null)
      setBankMissing(true)
    } finally {
      if (seq === lookupSeq.current) setLooking(false)
    }
  }

  function checkFields(formData) {
    const emailBad = !validEmail(formData.get("email"))
    const ibanBad = !validGermanIban(formData.get("iban"))
    const bankBad = !ibanBad && (!bank?.bic || !bank?.name)
    setEmailInvalid(emailBad)
    setIbanInvalid(ibanBad)
    setBankMissing(bankBad)
    if (!emailBad && !ibanBad && !bankBad) return ""
    if (emailBad) return messages.email
    if (ibanBad) return messages.iban
    return messages.bank
  }

  function guard(event) {
    const problem = checkFields(new FormData(event.currentTarget))
    if (!problem) return
    event.preventDefault()
    setMessage(problem)
  }

  async function send(formData) {
    setMessage("")
    const problem = checkFields(formData)
    if (problem) {
      setMessage(problem)
      return
    }
    const result = await submitJoin(formData)
    if (result?.ok) {
      router.replace("/beitritt?hinweis=gesendet")
      return
    }
    if (result?.reload) router.refresh()
    if (result?.error === "email") setEmailInvalid(true)
    if (result?.error === "iban") setIbanInvalid(true)
    if (result?.error === "bank") setBankMissing(true)
    setMessage(messages[result?.error] ?? messages.angaben)
  }

  return (
    <form action={send} className="card shadow-sm position-relative" autoComplete="on" onSubmit={guard}>
      <div className="card-body">
        <div className="join-honeypot" aria-hidden="true">
          <label htmlFor={`${titleId}-fax`}>Fax</label>
          <input id={`${titleId}-fax`} name="fax" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <input type="hidden" name="issued" value={seal.issued} />
        <input type="hidden" name="nonce" value={seal.nonce} />
        <input type="hidden" name="seal" value={seal.seal} />
        {ready ? <input type="hidden" name="client" value="1" /> : null}
        {message ? (
          <div className="alert alert-warning" role="alert">
            {message}
          </div>
        ) : null}
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor={`${titleId}-given`}>
              Vorname
            </label>
            <input
              id={`${titleId}-given`}
              className="form-control"
              name="givenName"
              required
              maxLength={80}
              autoComplete="given-name"
              value={givenName}
              onChange={(event) => setGivenName(event.target.value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor={`${titleId}-family`}>
              Name
            </label>
            <input
              id={`${titleId}-family`}
              className="form-control"
              name="familyName"
              required
              maxLength={80}
              autoComplete="family-name"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor={`${titleId}-email`}>
              E-Mail-Adresse
            </label>
            <input
              id={`${titleId}-email`}
              className={`form-control${emailInvalid ? " is-invalid" : ""}`}
              name="email"
              type="email"
              required
              maxLength={240}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="email"
              aria-invalid={emailInvalid}
              aria-describedby={`${titleId}-email-hint`}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setEmailInvalid(false)
              }}
              onBlur={(event) => setEmailInvalid(event.target.value.trim() !== "" && !validEmail(event.target.value))}
            />
            <div className="form-text" id={`${titleId}-email-hint`}>
              An diese Adresse schicken wir den Link zur Bestätigung.
            </div>
            {emailInvalid ? <div className="invalid-feedback d-block">{messages.email}</div> : null}
          </div>
          <div className="col-12">
            <span className="form-label d-block">Beitrag pro Schuljahr</span>
            <div className="d-flex flex-wrap align-items-center gap-3">
              <div className="form-check mb-0">
                <input
                  className="form-check-input"
                  type="radio"
                  name="contributionChoice"
                  id={`${titleId}-choice-22`}
                  checked={choice === "22"}
                  onChange={() => setChoice("22")}
                  required
                />
                <label className="form-check-label" htmlFor={`${titleId}-choice-22`}>
                  22 €
                </label>
              </div>
              <div className="d-flex align-items-center gap-2">
                <div className="form-check mb-0">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="contributionChoice"
                    id={`${titleId}-choice-custom`}
                    checked={choice === "custom"}
                    onChange={() => setChoice("custom")}
                    required
                  />
                  <label className="form-check-label" htmlFor={`${titleId}-choice-custom`}>
                    Anderer Betrag
                  </label>
                </div>
                {choice === "custom" ? (
                  <input
                    id={`${titleId}-amount`}
                    className="form-control"
                    style={{ width: "8rem" }}
                    name="contribution"
                    aria-label="Betrag in Euro"
                    inputMode="decimal"
                    required
                    maxLength={12}
                    autoComplete="off"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                ) : (
                  <input type="hidden" name="contribution" value={choice === "22" ? "22" : ""} />
                )}
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="d-flex align-items-center gap-2 mb-1 join-field-label">
              <label className="form-label mb-0" htmlFor={`${titleId}-holder`}>
                Kontoinhaber
              </label>
            </div>
            <input id={`${titleId}-holder`} className="form-control" name="accountHolder" maxLength={120} autoComplete="name" />
            <div className="form-text">Nur ausfüllen, wenn das Konto einer anderen Person gehört.</div>
          </div>
          <div className="col-12 col-md-6">
            <div className="d-flex align-items-center gap-2 mb-1 join-field-label">
              <label className="form-label mb-0" htmlFor={`${titleId}-iban`}>
                IBAN
              </label>
              <FieldHelp
                label="Erklärung der IBAN"
                text="Die IBAN ist die internationale Kontonummer. In Deutschland beginnt sie mit DE. Sie steht auf der Bankkarte, auf dem Kontoauszug und im Online-Banking."
              />
            </div>
            <input
              id={`${titleId}-iban`}
              className={`form-control${ibanInvalid ? " is-invalid" : ""}`}
              name="iban"
              required
              maxLength={42}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={ibanInvalid}
              aria-describedby={`${titleId}-iban-hint`}
              value={iban}
              onChange={(event) => {
                const next = event.target.value
                setIban(next)
                setIbanInvalid(false)
                resolveBank(next)
              }}
              onBlur={(event) => setIbanInvalid(event.target.value.trim() !== "" && !validGermanIban(event.target.value))}
            />
            <div className="form-text" id={`${titleId}-iban-hint`}>
              Bitte Zeichen für Zeichen mit der Bankkarte vergleichen. Eine deutsche IBAN beginnt mit DE und hat danach 20 Ziffern.
            </div>
            {ibanInvalid ? <div className="invalid-feedback d-block">{messages.iban}</div> : null}
          </div>
          <div className="col-12 col-md-6">
            <div className="d-flex align-items-center gap-2 mb-1 join-field-label">
              <label className="form-label mb-0" htmlFor={`${titleId}-bank`}>
                Bank
              </label>
            </div>
            <input
              id={`${titleId}-bank`}
              className="form-control join-readonly"
              name="bankName"
              value={bank?.name ?? ""}
              readOnly
              required
            />
          </div>
          <div className="col-12 col-md-6">
            <div className="d-flex align-items-center gap-2 mb-1 join-field-label">
              <label className="form-label mb-0" htmlFor={`${titleId}-bic`}>
                BIC
              </label>
              <FieldHelp
                label="Erklärung der BIC"
                text="Die BIC ist die Kennung der Bank. Sie wird aus der IBAN ermittelt und steht auch auf der Bankkarte neben der IBAN."
              />
            </div>
            <input
              id={`${titleId}-bic`}
              className="form-control join-readonly"
              name="bic"
              value={bank?.bic ?? ""}
              readOnly
              required
            />
          </div>
          <div className="col-12">
            {looking ? <div className="form-text">Bank wird ermittelt…</div> : null}
            {bankMissing ? <div className="invalid-feedback d-block">{messages.bank}</div> : null}
            {!looking && !bankMissing ? (
              <div className="form-text">Bank und BIC werden aus der IBAN ermittelt.</div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="card-footer bg-white d-flex flex-wrap gap-2">
        <SubmitButton ready={ready && complete} />
      </div>
    </form>
  )
}
