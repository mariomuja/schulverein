"use client"

import { useState } from "react"

async function writeClipboard(url) {
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    const field = document.createElement("textarea")
    field.value = url
    field.setAttribute("readonly", "")
    field.setAttribute("aria-hidden", "true")
    field.tabIndex = -1
    field.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none"
    document.body.appendChild(field)
    field.select()
    const ok = document.execCommand("copy")
    field.remove()
    return ok
  }
}

export default function CopyTokenButton({ url }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const ok = await writeClipboard(url)
    setCopied(ok)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button className="btn btn-primary btn-sm" type="button" onClick={copy}>
        {copied ? "Kopiert" : "Anmeldelink kopieren"}
      </button>
      <span className="visually-hidden" aria-live="polite">
        {copied ? "Anmeldelink kopiert" : ""}
      </span>
    </>
  )
}
