"use client"

import { useRef } from "react"
import { saveAuditDate } from "../app/actions"

export default function AuditDateForm({ canWrite, defaultValue }) {
  const formRef = useRef(null)

  return (
    <form action={saveAuditDate} ref={formRef}>
      <label className="audit-note-label" htmlFor="lastAuditDate">
        Datum der letzten Kassenprüfung
      </label>
      <input
        id="lastAuditDate"
        className="form-control audit-date"
        type="date"
        name="lastAuditDate"
        defaultValue={defaultValue}
        disabled={!canWrite}
        onChange={() => formRef.current?.requestSubmit()}
      />
    </form>
  )
}
