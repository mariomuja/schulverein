"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { formatEuro } from "../lib/money"

const columns = [
  { key: "name", label: "Name", className: "col-name" },
  { key: "joined", label: "Eintritt", className: "col-joined" },
  { key: "email", label: "E-Mail", className: "col-email" },
  { key: "contribution", label: "Beitrag", className: "col-contribution" },
  { key: "bic", label: "BIC", className: "col-bic" },
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
    amount,
    amount.replace(/\./g, ""),
    member.bicStored ? "••••" : "",
  ].join(" ")
}

function joinedValue(member) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(member.joinedOn ?? "")) ? member.joinedOn : ""
}

function compareRows(left, right, sort) {
  if (left.unreadable || right.unreadable) return Number(Boolean(left.unreadable)) - Number(Boolean(right.unreadable))
  let result = 0
  if (sort.key === "joined") {
    const leftDate = joinedValue(left)
    const rightDate = joinedValue(right)
    if (!leftDate || !rightDate) return leftDate ? -1 : rightDate ? 1 : 0
    result = leftDate.localeCompare(rightDate)
  } else if (sort.key === "email") {
    result = fold(left.email).localeCompare(fold(right.email), "de")
  } else if (sort.key === "contribution") {
    result = (left.contributionCents ?? 0) - (right.contributionCents ?? 0)
  } else if (sort.key === "bic") {
    result = Number(Boolean(left.bicStored)) - Number(Boolean(right.bicStored))
  } else {
    result = fold(left.familyName).localeCompare(fold(right.familyName), "de")
    if (!result) result = fold(left.givenName).localeCompare(fold(right.givenName), "de")
  }
  if (sort.key === "joined") return sort.dir === "asc" ? result : -result
  return sort.dir === "asc" ? result : -result
}

function openEdit(event, router, href) {
  if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return
  if (event.key === " ") event.preventDefault()
  router.push(href, { scroll: false })
}

function readWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "")
    if (!Array.isArray(saved) || saved.length !== columns.length) return null
    if (!saved.every((value) => typeof value === "number" && value > 0)) return null
    return saved
  } catch {
    return null
  }
}

function headerFloor(header) {
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

export default function MembersList({ members, letter }) {
  const router = useRouter()
  const wrapRef = useRef(null)
  const tableRef = useRef(null)
  const lineRefs = useRef([])
  const resizingRef = useRef(false)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState(null)

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

    const saved = readWidths()
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
  }, [rows])

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
      localStorage.setItem(storageKey, JSON.stringify(percents))
    }

    line.addEventListener("pointermove", onMove)
    line.addEventListener("pointerup", onUp)
    line.addEventListener("pointercancel", onUp)
  }

  return (
    <>
      <div className="mb-3">
        <label className="form-label" htmlFor="member-search">
          Suchen
        </label>
        <input
          id="member-search"
          className="form-control"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, Nummer, E-Mail, Beitrag oder Eintritt"
          autoComplete="off"
        />
      </div>
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
                      className="card h-100 member-row"
                      role="button"
                      tabIndex={member.unreadable ? -1 : 0}
                      aria-label={`${person(member)} ändern`}
                      aria-disabled={member.unreadable || undefined}
                      onClick={(event) => {
                        if (!member.unreadable) openEdit(event, router, href)
                      }}
                      onKeyDown={(event) => {
                        if (!member.unreadable) openEdit(event, router, href)
                      }}
                    >
                      <div className="card-body">
                        <h2 className="h6 mb-3">
                          {person(member)}
                          {member.memberNumber ? (
                            <span className="fw-normal text-secondary"> · Nr. {member.memberNumber}</span>
                          ) : null}
                        </h2>
                        <dl className="row mb-0 small">
                          <dt className="col-5">Eintritt</dt>
                          <dd className="col-7">{entryDate(member.joinedOn)}</dd>
                          <dt className="col-5">E-Mail</dt>
                          <dd className="col-7 text-break">{member.email || "—"}</dd>
                          <dt className="col-5">Beitrag</dt>
                          <dd className="col-7">
                            {member.contributionCents ? `${formatEuro(member.contributionCents)} €` : "—"}
                          </dd>
                          <dt className="col-5">BIC</dt>
                          <dd className="col-7 mb-0">{member.bicStored ? "••••" : "—"}</dd>
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
                  </tr>
                </thead>
                <tbody>
                  {rows.map((member) => {
                    const href = editHref(letter, member.id)
                    return (
                      <tr
                        key={member.id}
                        className="member-row"
                        role="button"
                        tabIndex={member.unreadable ? -1 : 0}
                        aria-label={`${person(member)} ändern`}
                        aria-disabled={member.unreadable || undefined}
                        onClick={(event) => {
                          if (!member.unreadable) openEdit(event, router, href)
                        }}
                        onKeyDown={(event) => {
                          if (!member.unreadable) openEdit(event, router, href)
                        }}
                      >
                        <td>
                          <div className="fw-semibold">{person(member)}</div>
                          {member.memberNumber ? <div className="small text-secondary">Nr. {member.memberNumber}</div> : null}
                        </td>
                        <td>{entryDate(member.joinedOn)}</td>
                        <td>{member.email || "—"}</td>
                        <td>{member.contributionCents ? `${formatEuro(member.contributionCents)} €` : "—"}</td>
                        <td>{member.bicStored ? "••••" : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {columns.slice(0, -1).map((column, index) => (
                <div
                  key={column.key}
                  className="col-line"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Breite zwischen ${column.label} und ${columns[index + 1].label} ändern`}
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
    </>
  )
}
