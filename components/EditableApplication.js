"use client"

import { useEffect, useState } from "react"
import EditApplication from "./EditApplication"

export default function EditableApplication({
  as: Tag = "div",
  className,
  enabled,
  editOnLoad = false,
  wideLayout = false,
  application,
  sort,
  filter,
  children,
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!enabled || !editOnLoad) return undefined
    const wide = window.matchMedia("(min-width: 1200px)").matches
    if (wide === wideLayout) setOpen(true)
    return undefined
  }, [enabled, editOnLoad, wideLayout])

  function onClick(event) {
    if (!enabled) return
    if (event.target.closest("button, a, input, textarea, select, label")) return
    setOpen(true)
  }

  return (
    <>
      <Tag
        className={className}
        onClick={enabled ? onClick : undefined}
        title={enabled ? "Förderantrag korrigieren" : undefined}
      >
        {typeof children === "function" ? children(() => setOpen(true)) : children}
      </Tag>
      {open ? (
        <EditApplication
          application={application}
          sort={sort}
          filter={filter}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
