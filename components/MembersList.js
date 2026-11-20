"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { deleteMember, restoreMember } from "../app/actions"
import { formatEuro } from "../lib/money"

const columns = [
  { key: "number", label: "Nr.", className: "col-number" },
  { key: "name", label: "Name", className: "col-name" },
  { key: "joined", label: "Eintritt", className: "col-joined" },
  { key: "email", label: "E-Mail", className: "col-email" },
  { key: "contribution", label: "Beitrag", className: "col-contribution" },
]

const storageKey = "schulverein-member-column-widths"
const minColumn = 72

function editHref(letter, id) {
  const params = new URLSearchParams()
  if (letter) params.set("buchstabe", letter)
  params.set("bearbeiten", String(id))
  return `/mitglieder?${params}`
}

function entryDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return "—"
  const [year, month, day] = value.split("-")
  return `${day}.${month}.${year}`
}

function person(member) {
  if (member.unreadable) return "Nicht lesbar"
  return [member.familyName, member.givenName].filter(Boolean).join(", ")
}

function fold(value) {
  return String(value ?? "")
    .toLocaleLowerCase("de")
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ß", "ss")
}

function searchText(member) {
  const amount = member.contributionCents ? formatEuro(member.contributionCents) : ""
  return [
    person(member),
    member.memberNumber,
    entryDate(member.joinedOn),
    member.joinedOn,
    member.email,
    member.draft ? "Entwurf" : "",
    member.confirmationNote,
    amount,
    amount.replace(/\./g, ""),
  ].join(" ")
}

function joinedValue(member) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(member.joinedOn ?? "")) ? member.joinedOn : ""
}

function compareRows(left, right, sort) {
  if (left.unreadable || right.unreadable) return Number(Boolean(left.unreadable)) - Number(Boolean(right.unreadable))
  let result = 0
  if (sort.key === "number") {
    const leftNumber = Number(String(left.memberNumber ?? "").trim())
    const rightNumber = Number(String(right.memberNumber ?? "").trim())
    const leftOk = String(left.memberNumber ?? "").trim() !== "" && Number.isFinite(leftNumber)
    const rightOk = String(right.memberNumber ?? "").trim() !== "" && Number.isFinite(rightNumber)
    if (!leftOk || !rightOk) return leftOk ? -1 : rightOk ? 1 : 0
    result = leftNumber - rightNumber
  } else if (sort.key === "joined") {
    const leftDate = joinedValue(left)
    const rightDate = joinedValue(right)
    if (!leftDate || !rightDate) return leftDate ? -1 : rightDate ? 1 : 0
    result = leftDate.localeCompare(rightDate)
  } else if (sort.key === "email") {
    result = fold(left.email).localeCompare(fold(right.email), "de")
  } else if (sort.key === "contribution") {
    result = (left.contributionCents ?? 0) - (right.contributionCents ?? 0)
  } else {
    result = fold(left.familyName).localeCompare(fold(right.familyName), "de")
    if (!result) result = fold(left.givenName).localeCompare(fold(right.givenName), "de")
  }
  if (sort.key === "joined") return sort.dir === "asc" ? result : -result
  return sort.dir === "asc" ? result : -result
}

function openEdit(event, router, href) {
  if (event.target.closest(".member-delete")) return
  if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return
  if (event.key === " ") event.preventDefault()
  router.push(href, { scroll: false })
}

function DeleteButton({ member, onAsk }) {
  return (
    <button
      type="button"
      className="member-delete"
      aria-label={`${person(member)} löschen`}
      onClick={(event) => {
        event.stopPropagation()
        onAsk(member)
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <i className="bi bi-x-lg" aria-hidden="true" />
    </button>
  )
}

function readWidths(key, count) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "")
    if (!Array.isArray(saved) || saved.length !== count) return null
    if (!saved.every((value) => typeof value === "number" && value > 0)) return null
    return saved
  } catch {
    return null
  }
}

function headerFloor(header) {
  const marked = Number(header.dataset.floor)
  if (marked) return marked
  const style = getComputedStyle(header)
  const extra =
    parseFloat(style.paddingLeft) +
    parseFloat(style.paddingRight) +
    parseFloat(style.borderLeftWidth) +
    parseFloat(style.borderRightWidth)
  const label = header.querySelector(".member-sort-label")
  const widest = label ? label.getBoundingClientRect().width : 0
  return Math.max(minColumn, Math.ceil(widest + extra + 18))
}

function deletedLabel(member) {
  if (member.unreadable) return "Nicht lesbar"
  return [member.familyName, member.givenName].filter(Boolean).join(", ") || "Ohne Namen"
}

export default function MembersList({ members, deletedMembers = [], letter, canEdit = false }) {
  const router = useRouter()
  const wrapRef = useRef(null)
  const tableRef = useRef(null)
  const lineRefs = useRef([])
  const resizingRef = useRef(false)
  const confirmTitleId = useId()
  const sendExitId = useId()
  const confirmRef = useRef(null)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [selectedDeleted, setSelectedDeleted] = useState("")
  const [pendingRestore, setPendingRestore] = useState(null)
  const widthCount = columns.length + (canEdit ? 1 : 0)
  const widthKey = canEdit ? storageKey : `${storageKey}-read`

  const rows = useMemo(() => {
    const tokens = fold(query).split(/\s+/).filter(Boolean)
    const matched = members.filter((member) => {
      if (tokens.length === 0) return true
      const haystack = fold(searchText(member))
      return tokens.every((token) => haystack.includes(token))
    })
    if (!sort) return matched
    return matched.slice().sort((left, right) => compareRows(left, right, sort))
  }, [members, query, sort])

  useEffect(() => {
    const table = tableRef.current
    const wrap = wrapRef.current
    if (!table || !wrap) return

    function placeLines() {
      const wrapLeft = wrap.getBoundingClientRect().left
      const height = table.getBoundingClientRect().height
      const headers = [...table.querySelectorAll("thead th")]
      headers.slice(0, -1).forEach((header, index) => {
        const line = lineRefs.current[index]
        if (!line) return
        line.style.left = `${header.getBoundingClientRect().right - wrapLeft - 4}px`
        line.style.height = `${height}px`
      })
    }

    function applyPercents(percents) {
      const elements = [...table.querySelectorAll("col")]
      percents.forEach((percent, index) => {
        if (elements[index]) elements[index].style.width = `${percent}%`
      })
      placeLines()
    }

    const saved = readWidths(widthKey, widthCount)
    if (saved) applyPercents(saved)
    placeLines()

    const observer = new ResizeObserver(() => {
      if (resizingRef.current) return
      placeLines()
    })
    observer.observe(table)
    window.addEventListener("resize", placeLines)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", placeLines)
    }
  }, [rows, canEdit, widthKey, widthCount])

  useEffect(() => {
    if (!pendingDelete && !pendingRestore) return undefined
    confirmRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setPendingDelete(null)
        setPendingRestore(null)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [pendingDelete, pendingRestore])

  const chosenDeleted = deletedMembers.find((member) => String(member.id) === selectedDeleted) ?? null

  function toggleSort(key) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: "asc" }
      return { key, dir: current.dir === "asc" ? "desc" : "asc" }
    })
  }

  function startResize(event, index) {
    if (event.button !== 0) return
    const table = tableRef.current
    const wrap = wrapRef.current
    const line = event.currentTarget
    if (!table || !wrap) return

    event.preventDefault()
    try {
      line.setPointerCapture(event.pointerId)
    } catch {
      // Manche Browser verweigern die Pointer-Capture für dieses Ereignis.
    }
    line.classList.add("is-active")
    document.body.classList.add("is-resizing-columns")
    resizingRef.current = true

    const elements = [...table.querySelectorAll("col")]
    const headers = [...table.querySelectorAll("thead th")]
    const start = headers.map((header) => header.getBoundingClientRect().width)
    const startX = event.clientX
    const floors = headers.map((header) => headerFloor(header))

    function apply(widths) {
      const total = widths.reduce((sum, width) => sum + width, 0)
      const percents = widths.map((width) => (width / total) * 100)
      percents.forEach((percent, column) => {
        elements[column].style.width = `${percent}%`
      })
      const wrapLeft = wrap.getBoundingClientRect().left
      const height = table.getBoundingClientRect().height
      const nextHeaders = [...table.querySelectorAll("thead th")]
      nextHeaders.slice(0, -1).forEach((header, lineIndex) => {
        const handle = lineRefs.current[lineIndex]
        if (!handle) return
        handle.style.left = `${header.getBoundingClientRect().right - wrapLeft - 4}px`
        handle.style.height = `${height}px`
      })
      return percents
    }

    function onMove(moveEvent) {
      if (moveEvent.pointerId !== event.pointerId) return
      let left = start[index] + (moveEvent.clientX - startX)
      let right = start[index + 1] - (moveEvent.clientX - startX)
      if (left < floors[index]) {
        right -= floors[index] - left
        left = floors[index]
      }
      if (right < floors[index + 1]) {
        left -= floors[index + 1] - right
        right = floors[index + 1]
      }
      const next = start.slice()
      next[index] = left
      next[index + 1] = right
      apply(next)
    }

    function onUp(upEvent) {
      if (upEvent.pointerId !== event.pointerId) return
      line.classList.remove("is-active")
      document.body.classList.remove("is-resizing-columns")
      resizingRef.current = false
      line.removeEventListener("pointermove", onMove)
      line.removeEventListener("pointerup", onUp)
      line.removeEventListener("pointercancel", onUp)
      const percents = apply(headers.map((header) => header.getBoundingClientRect().width))
      localStorage.setItem(widthKey, JSON.stringify(percents))
    }

    line.addEventListener("pointermove", onMove)
    line.addEventListener("pointerup", onUp)
    line.addEventListener("pointercancel", onUp)
  }

  return (
    <>
      <div className="mb-3">
        <label className="visually-hidden" htmlFor="member-search">
          Suchen
        </label>
        <input
          id="member-search"
          className="form-control member-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Suchen"
          autoComplete="off"
        />
      </div>
      {canEdit ? (
      <div className="deleted-members-bar d-flex flex-column flex-xl-row align-items-xl-center gap-2 mb-3">
        <label className="form-label small mb-0 text-nowrap" htmlFor="deleted-members">
          Gelöschte Mitglieder
        </label>
        <select
          id="deleted-members"
          className="form-select form-select-sm deleted-members-select"
          value={deletedMembers.some((member) => String(member.id) === selectedDeleted) ? selectedDeleted : ""}
          onChange={(event) => setSelectedDeleted(event.target.value)}
          disabled={deletedMembers.length === 0}
        >
          <option value="">{deletedMembers.length === 0 ? "Keine gelöschten Mitglieder" : "Bitte wählen"}</option>
          {deletedMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {deletedLabel(member)}
            </option>
          ))}
        </select>
        {deletedMembers.length > 0 ? (
          <button
            className="btn btn-outline-primary btn-sm text-nowrap"
            type="button"
            disabled={!chosenDeleted}
            onClick={() => setPendingRestore(chosenDeleted)}
          >
            Löschen rückgängig
          </button>
        ) : null}
      </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-secondary mb-0">
          {query.trim() ? "Keine Mitglieder für diese Suche." : "Keine Mitglieder für diesen Anfangsbuchstaben."}
        </p>
      ) : (
        <>
          <div className="d-xl-none">
            <div className="row g-3">
              {rows.map((member) => {
                const href = editHref(letter, member.id)
                return (
                  <div className="col-12 col-md-6" key={member.id}>
                    <article
                      className={`card h-100${canEdit ? " member-row" : ""}`}
                      role={canEdit ? "button" : undefined}
                      tabIndex={canEdit && !member.unreadable ? 0 : undefined}
                      aria-label={canEdit ? `${person(member)} ändern` : undefined}
                      aria-disabled={canEdit && member.unreadable ? true : undefined}
                      onClick={(event) => {
                        if (canEdit && !member.unreadable) openEdit(event, router, href)
                      }}
                      onKeyDown={(event) => {
                        if (canEdit && !member.unreadable) openEdit(event, router, href)
                      }}
                    >
                      <div className="card-body member-card-body">
                        {canEdit ? <DeleteButton member={member} onAsk={setPendingDelete} /> : null}
                        <h2 className="h6 mb-3">
                          {person(member)}
                          {member.draft ? <span className="badge text-bg-warning ms-2">Entwurf</span> : null}
                        </h2>
                        <dl className="row mb-0 small">
                          <dt className="col-5">Nr.</dt>
                          <dd className="col-7">{member.memberNumber || "—"}</dd>
                          <dt className="col-5">Eintritt</dt>
                          <dd className="col-7">{entryDate(member.joinedOn)}</dd>
                          <dt className="col-5">E-Mail</dt>
                          <dd className="col-7 text-break">
                            {member.email || "—"}
                            {member.confirmationNote ? (
                              <div className="text-warning">{member.confirmationNote}</div>
                            ) : null}
                          </dd>
                          <dt className="col-5">Beitrag</dt>
                          <dd className="col-7 mb-0">
                            {member.contributionCents ? `${formatEuro(member.contributionCents)} €` : "—"}
                          </dd>
                        </dl>
                      </div>
                    </article>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="d-none d-xl-block table-responsive">
            <div className="table-resize-wrap" ref={wrapRef}>
              <table
                className="table table-striped table-hover align-middle bg-white member-table mb-0"
                ref={tableRef}
              >
                <colgroup>
                  {columns.map((column) => (
                    <col className={column.className} key={column.key} />
                  ))}
                  {canEdit ? <col className="col-delete" /> : null}
                </colgroup>
                <thead>
                  <tr>
                    {columns.map((column) => {
                      const active = sort?.key === column.key
                      const dir = active ? sort.dir : "asc"
                      return (
                        <th key={column.key} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className="member-sort"
                            onClick={() => toggleSort(column.key)}
                            aria-label={
                              active && dir === "asc"
                                ? `${column.label} absteigend sortieren`
                                : `${column.label} aufsteigend sortieren`
                            }
                          >
                            <span className="member-sort-label">{column.label}</span>
                            {active ? <span aria-hidden="true">{dir === "asc" ? "↑" : "↓"}</span> : null}
                          </button>
                        </th>
                      )
                    })}
                    {canEdit ? <th className="member-delete-col" data-floor="44" aria-label="Löschen" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((member) => {
                    const href = editHref(letter, member.id)
                    return (
                      <tr
                        key={member.id}
                        className={canEdit ? "member-row" : undefined}
                        role={canEdit ? "button" : undefined}
                        tabIndex={canEdit && !member.unreadable ? 0 : undefined}
                        aria-label={canEdit ? `${person(member)} ändern` : undefined}
                        aria-disabled={canEdit && member.unreadable ? true : undefined}
                        onClick={(event) => {
                          if (canEdit && !member.unreadable) openEdit(event, router, href)
                        }}
                        onKeyDown={(event) => {
                          if (canEdit && !member.unreadable) openEdit(event, router, href)
                        }}
                      >
                        <td>{member.memberNumber || "—"}</td>
                        <td className="fw-semibold">
                          {person(member)}
                          {member.draft ? <span className="badge text-bg-warning ms-2">Entwurf</span> : null}
                        </td>
                        <td>{entryDate(member.joinedOn)}</td>
                        <td>
                          {member.email || "—"}
                          {member.confirmationNote ? (
                            <div className="small text-warning">{member.confirmationNote}</div>
                          ) : null}
                        </td>
                        <td>{member.contributionCents ? `${formatEuro(member.contributionCents)} €` : "—"}</td>
                        {canEdit ? (
                          <td className="member-delete-col">
                            <DeleteButton member={member} onAsk={setPendingDelete} />
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {(canEdit ? columns : columns.slice(0, -1)).map((column, index) => (
                <div
                  key={column.key}
                  className="col-line"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={
                    columns[index + 1]
                      ? `Breite zwischen ${column.label} und ${columns[index + 1].label} ändern`
                      : "Breite der letzten Spalte ändern"
                  }
                  ref={(node) => {
                    lineRefs.current[index] = node
                  }}
                  onPointerDown={(event) => startResize(event, index)}
                />
              ))}
            </div>
          </div>
        </>
      )}
      {pendingDelete
        ? createPortal(
            <>
              <div className="modal-backdrop fade show member-delete-backdrop" onClick={() => setPendingDelete(null)} />
              <div
                className="modal fade show d-block member-delete-modal"
                role="presentation"
                onClick={() => setPendingDelete(null)}
              >
                <div
                  ref={confirmRef}
                  className="modal-dialog modal-dialog-centered"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={confirmTitleId}
                  tabIndex={-1}
                  onClick={(event) => event.stopPropagation()}
                >
                  <form action={deleteMember} className="modal-content">
                    <input type="hidden" name="memberId" value={pendingDelete.id} />
                    <input type="hidden" name="letter" value={letter} />
                    <div className="modal-header">
                      <h2 className="modal-title h5" id={confirmTitleId}>
                        Mitglied löschen
                      </h2>
                      <button
                        className="btn-close"
                        type="button"
                        aria-label="Schließen"
                        onClick={() => setPendingDelete(null)}
                      />
                    </div>
                    <div className="modal-body">
                      <p>
                        {person(pendingDelete)} wirklich löschen? Das Mitglied verschwindet aus der Liste und
                        aus den Exporten.
                      </p>
                      <div className="form-check form-switch mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id={sendExitId}
                          name="sendExitMail"
                          value="1"
                          defaultChecked={Boolean(String(pendingDelete.email ?? "").trim())}
                          disabled={!String(pendingDelete.email ?? "").trim()}
                        />
                        <label className="form-check-label" htmlFor={sendExitId}>
                          Bestätigung an das Mitglied senden.
                        </label>
                      </div>
                      {String(pendingDelete.email ?? "").trim() ? null : (
                        <div className="form-text">Für dieses Mitglied ist keine E-Mail-Adresse gespeichert.</div>
                      )}
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-outline-secondary" type="button" onClick={() => setPendingDelete(null)}>
                        Abbrechen
                      </button>
                      <button className="btn btn-danger" type="submit">
                        Löschen
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
      {pendingRestore
        ? createPortal(
            <>
              <div className="modal-backdrop fade show member-delete-backdrop" onClick={() => setPendingRestore(null)} />
              <div
                className="modal fade show d-block member-delete-modal"
                role="presentation"
                onClick={() => setPendingRestore(null)}
              >
                <div
                  ref={confirmRef}
                  className="modal-dialog modal-dialog-centered"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={confirmTitleId}
                  tabIndex={-1}
                  onClick={(event) => event.stopPropagation()}
                >
                  <form action={restoreMember} className="modal-content">
                    <input type="hidden" name="memberId" value={pendingRestore.id} />
                    <input type="hidden" name="letter" value={letter} />
                    <div className="modal-header">
                      <h2 className="modal-title h5" id={confirmTitleId}>
                        Löschen rückgängig
                      </h2>
                      <button
                        className="btn-close"
                        type="button"
                        aria-label="Schließen"
                        onClick={() => setPendingRestore(null)}
                      />
                    </div>
                    <div className="modal-body">
                      <p className="mb-0">{deletedLabel(pendingRestore)} wieder in die Liste aufnehmen?</p>
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-outline-secondary" type="button" onClick={() => setPendingRestore(null)}>
                        Abbrechen
                      </button>
                      <button className="btn btn-primary" type="submit">
                        Löschen rückgängig
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  )
}
