"use client"

import { useEffect, useRef, useState } from "react"
import { establishSession } from "../app/actions"

export default function EstablishSession({ token }) {
  const started = useRef(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const key = "sv-open-attempt"
    if (sessionStorage.getItem(key) === "1") {
      sessionStorage.removeItem(key)
      setFailed(true)
      return
    }
    sessionStorage.setItem(key, "1")
    establishSession(token)
      .then((result) => {
        if (result?.ok) {
          window.location.reload()
          return
        }
        sessionStorage.removeItem(key)
        setFailed(true)
      })
      .catch(() => {
        sessionStorage.removeItem(key)
        setFailed(true)
      })
  }, [token])

  if (failed) {
    return (
      <div className="alert alert-warning" role="status">
        Da stimmt etwas nicht... nutze für die Anmeldung den persönlichen Link, der dir zugesendet
        wurde.
      </div>
    )
  }

  return <p className="text-secondary mb-0">Anmeldung…</p>
}
