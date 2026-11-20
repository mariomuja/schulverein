"use client"

import { useEffect, useState } from "react"

export default function TokenReminder() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const secure = window.location.protocol === "https:" ? "; secure" : ""
    document.cookie = `sv_token_hint=; Max-Age=0; path=/; samesite=lax${secure}`
    const timer = window.setTimeout(() => setVisible(false), 5000)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div className="container-fluid px-3 pb-2">
      <p className="token-reminder mb-0" role="status">
        In der Benutzerverwaltung können Sie ein neues Anmeldetoken erzeugen, damit sich niemand mit einem weitergegebenen Link an Ihrem Konto anmeldet.
      </p>
    </div>
  )
}
