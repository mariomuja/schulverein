"use client"

import { useEffect, useId, useState } from "react"
import { createPortal } from "react-dom"
import { saveMember, updateMember } from "../app/actions"
import { formatEuro } from "../lib/money"

const empty = {
  memberNumber: "",
  familyName: "",
  givenName: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  email: "",
  contribution: "",
  joinedOn: "",
  mandateId: "",
  bic: "",
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

function fromMember(member) {
  if (!member) return empty
  return {
    memberNumber: member.memberNumber ?? "",
    familyName: member.familyName ?? "",
    givenName: member.givenName ?? "",
    street: member.street ?? "",
    houseNumber: member.houseNumber ?? "",
    postalCode: member.postalCode ?? "",
    city: member.city ?? "",
    email: member.email ?? "",
    contribution:
      member.contributionCents === 2200
        ? "22"
        : member.contributionCents === 2500
          ? "25"
          : member.contributionCents
            ? formatEuro(member.contributionCents)
            : "",
    joinedOn: member.joinedOn ?? "",
    mandateId: member.mandateId ?? "",
    bic: member.bic ?? "",
    bankName: member.bankName ?? "",
    iban: member.iban ?? "",
    accountHolder: member.accountHolder ?? "",
  }
}

export default function MemberForm({ member = null, letter = "", startOpen = false }) {
  const titleId = useId()
  const [open, setOpen] = useState(Boolean(member) || startOpen)
  const [mounted, setMounted] = useState(false)
  const [fields, setFields] = useState(() => fromMember(member))

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return undefined
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

  const dialog =
    open && mounted
      ? createPortal(
        <>
          <div className="modal-backdrop fade show" onClick={() => setOpen(false)} />
          <div className="modal fade show d-block" role="presentation" onClick={() => setOpen(false)}>
            <div
              className="modal-dialog modal-lg modal-dialog-scrollable"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={(event) => event.stopPropagation()}
            >
              <form action={member ? updateMember : saveMember} className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title h5" id={titleId}>
                    {member ? "Mitglied ändern" : "Mitglied hinzufügen"}
                  </h2>
                  <button className="btn-close" type="button" aria-label="Schließen" onClick={() => setOpen(false)} />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    {member ? <input type="hidden" name="memberId" value={member.id} /> : null}
                    <input type="hidden" name="letter" value={letter} />
                    <Field id={`${titleId}-number`} label="Nr." name="memberNumber" value={fields.memberNumber} onChange={(value) => setField("memberNumber", value)} />
                    <Field id={`${titleId}-joined`} label="Eintritt" name="joinedOn" type="date" value={fields.joinedOn} onChange={(value) => setField("joinedOn", value)} />
                    <Field id={`${titleId}-family`} label="Name" name="familyName" value={fields.familyName} onChange={(value) => setField("familyName", value)} required />
                    <Field id={`${titleId}-given`} label="Vorname" name="givenName" value={fields.givenName} onChange={(value) => setField("givenName", value)} required />
                    <Field id={`${titleId}-street`} label="Straße" name="street" value={fields.street} onChange={(value) => setField("street", value)} />
                    <Field id={`${titleId}-house`} label="Hausnummer" name="houseNumber" value={fields.houseNumber} onChange={(value) => setField("houseNumber", value)} />
                    <Field id={`${titleId}-postal`} label="PLZ" name="postalCode" value={fields.postalCode} onChange={(value) => setField("postalCode", value)} />
                    <Field id={`${titleId}-city`} label="Ort" name="city" value={fields.city} onChange={(value) => setField("city", value)} />
                    <Field id={`${titleId}-email`} label="E-Mail-Adresse" name="email" value={fields.email} onChange={(value) => setField("email", value)} />
                    <div className="col-12">
                      <span className="form-label d-block">Beitrag pro Schuljahr</span>
                      <div className="d-flex flex-wrap gap-3">
                        {[
                          ["22", "22 €"],
                          ["25", "25 €"],
                          ["custom", "Anderer Betrag"],
                        ].map(([choice, label]) => (
                          <div className="form-check" key={choice}>
                            <input
                              className="form-check-input"
                              type="radio"
                              name="contributionChoice"
                              id={`${titleId}-choice-${choice}`}
                              checked={(fields.contribution === "22" ? "22" : fields.contribution === "25" ? "25" : "custom") === choice}
                              onChange={() => {
                                if (choice === "22" || choice === "25") setField("contribution", choice)
                                else if (fields.contribution === "22" || fields.contribution === "25") setField("contribution", "")
                              }}
                            />
                            <label className="form-check-label" htmlFor={`${titleId}-choice-${choice}`}>
                              {label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    {fields.contribution !== "22" && fields.contribution !== "25" ? (
                      <Field id={`${titleId}-amount`} label="Betrag in Euro" name="contribution" value={fields.contribution} onChange={(value) => setField("contribution", value)} required />
                    ) : (
                      <input type="hidden" name="contribution" value={fields.contribution} />
                    )}
                    <Field id={`${titleId}-mandate`} label="Mandatsreferenz" name="mandateId" value={fields.mandateId} onChange={(value) => setField("mandateId", value)} />
                    <Field id={`${titleId}-bic`} label="BIC" name="bic" value={fields.bic} onChange={(value) => setField("bic", value)} hint="Nur in diesem Formular sichtbar. Die Liste zeigt die BIC nicht." />
                    <Field id={`${titleId}-bank`} label="Name der Bank" name="bankName" value={fields.bankName} onChange={(value) => setField("bankName", value)} />
                    <Field id={`${titleId}-iban`} label="IBAN" name="iban" value={fields.iban} onChange={(value) => setField("iban", value)} hint="Nur in diesem Formular sichtbar. Die Liste zeigt die IBAN nicht." />
                    <Field id={`${titleId}-holder`} label="Kontoinhaber" name="accountHolder" value={fields.accountHolder} onChange={(value) => setField("accountHolder", value)} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" type="button" onClick={() => setOpen(false)}>
                    Abbrechen
                  </button>
                  <button className="btn btn-primary" type="submit">
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

  if (member) return dialog

  return (
    <>
      <button className="btn btn-sm btn-primary" type="button" onClick={() => setOpen(true)}>
        Mitglied hinzufügen
      </button>
      {dialog}
    </>
  )
}
