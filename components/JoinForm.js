"use client"

import { useEffect, useId, useState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { submitJoin } from "../app/actions"

const messages = {
  angaben: "Bitte Name, Vorname, E-Mail-Adresse, Beitrag und IBAN prüfen.",
  iban: "Die IBAN ist keine gültige deutsche IBAN. Bitte prüfe die Eingabe Zeichen für Zeichen.",
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

export default function JoinForm({ ticket }) {
  const router = useRouter()
  const titleId = useId()
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState("")
  const [ibanInvalid, setIbanInvalid] = useState(false)
  const [choice, setChoice] = useState("")
  const [seal, setSeal] = useState(ticket)

  useEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    setSeal(ticket)
  }, [ticket])

  async function send(formData) {
    setMessage("")
    setIbanInvalid(false)
    const result = await submitJoin(formData)
    if (result?.ok) {
      router.replace("/beitritt?hinweis=gesendet")
      return
    }
    if (result?.reload) router.refresh()
    if (result?.error === "iban") setIbanInvalid(true)
    setMessage(messages[result?.error] ?? messages.angaben)
  }

  return (
    <form action={send} className="card shadow-sm position-relative" autoComplete="on">
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
          <div className="col-12">
            <label className="form-label" htmlFor={`${titleId}-given`}>
              Vorname
            </label>
            <input id={`${titleId}-given`} className="form-control" name="givenName" required maxLength={80} autoComplete="given-name" />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor={`${titleId}-family`}>
              Name
            </label>
            <input id={`${titleId}-family`} className="form-control" name="familyName" required maxLength={80} autoComplete="family-name" />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor={`${titleId}-email`}>
              E-Mail-Adresse
            </label>
            <input
              id={`${titleId}-email`}
              className="form-control"
              name="email"
              type="email"
              required
              maxLength={240}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
            />
            <div className="form-text">An diese Adresse schicken wir den Link zur Bestätigung.</div>
          </div>
          <div className="col-12">
            <span className="form-label d-block">Beitrag pro Schuljahr</span>
            <div className="d-flex flex-wrap gap-3">
              {[
                ["22", "22 €"],
                ["25", "25 €"],
                ["custom", "Anderer Betrag"],
              ].map(([value, label]) => (
                <div className="form-check" key={value}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="contributionChoice"
                    id={`${titleId}-choice-${value}`}
                    checked={choice === value}
                    onChange={() => setChoice(value)}
                    required
                  />
                  <label className="form-check-label" htmlFor={`${titleId}-choice-${value}`}>
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          {choice === "custom" ? (
            <div className="col-12">
              <label className="form-label" htmlFor={`${titleId}-amount`}>
                Betrag in Euro
              </label>
              <input
                id={`${titleId}-amount`}
                className="form-control"
                name="contribution"
                inputMode="decimal"
                required
                maxLength={12}
                autoComplete="off"
              />
            </div>
          ) : (
            <input type="hidden" name="contribution" value={choice === "22" || choice === "25" ? choice : ""} />
          )}
          <div className="col-12">
            <label className="form-label" htmlFor={`${titleId}-holder`}>
              Kontoinhaber
            </label>
            <input id={`${titleId}-holder`} className="form-control" name="accountHolder" maxLength={120} autoComplete="name" />
            <div className="form-text">Nur ausfüllen, wenn das Konto einer anderen Person gehört.</div>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor={`${titleId}-iban`}>
              IBAN
            </label>
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
            />
            <div className="form-text" id={`${titleId}-iban-hint`}>
              Bitte Zeichen für Zeichen mit der Bankkarte vergleichen.
            </div>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor={`${titleId}-bic`}>
              BIC
            </label>
            <input
              id={`${titleId}-bic`}
              className="form-control"
              name="bic"
              maxLength={11}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <div className="form-text">Bei einem deutschen Konto kann das Feld leer bleiben.</div>
          </div>
        </div>
      </div>
      <div className="card-footer bg-white d-flex flex-wrap gap-2">
        <SubmitButton ready={ready} />
      </div>
    </form>
  )
}
