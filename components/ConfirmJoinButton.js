"use client"

import { useFormStatus } from "react-dom"

export default function ConfirmJoinButton() {
  const { pending } = useFormStatus()
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "Wird bestätigt…" : "E-Mail-Adresse und Lastschriftmandat bestätigen"}
    </button>
  )
}
