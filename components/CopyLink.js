"use client"

import { useRef, useState } from "react"

export default function CopyLink({ href }) {
  const fieldRef = useRef(null)
  const [copied, setCopied] = useState(false)

  async function copy() {
    const field = fieldRef.current
    field?.focus()
    field?.select()
    let ok = false
    try {
      await navigator.clipboard.writeText(href)
      ok = true
    } catch {
      ok = document.execCommand("copy")
    }
    setCopied(ok)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="input-group input-group-sm">
      <input
        ref={fieldRef}
        className="form-control"
        value={href}
        readOnly
        spellCheck={false}
        aria-label="Anmeldelink"
        onFocus={(event) => event.currentTarget.select()}
      />
      <button className="btn btn-outline-secondary" type="button" onClick={copy}>
        {copied ? "Kopiert" : "Kopieren"}
      </button>
      <span className="visually-hidden" aria-live="polite">
        {copied ? "Link kopiert" : ""}
      </span>
    </div>
  )
}
