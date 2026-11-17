"use client"

import { useEffect, useRef } from "react"
import { formatEuro, formatGermanDate } from "../lib/money"
import { givenName } from "../lib/names"
import { isVoteParticipant, voterColumns } from "../lib/voters"
import CloseControl from "./CloseControl"
import DateSort from "./DateSort"
import EditableApplication from "./EditableApplication"
import RemoveApplication from "./RemoveApplication"
import Receipts from "./Receipts"
import StatusIcon from "./StatusIcon"
import VoteControl from "./VoteControl"

const MIN_COLUMN = 56
const PURPOSE_INDEX = 2
const COLUMN_PARTS = [8, 12, 32, 8, 9]
const VOTER_PART = 5.5
const TAIL_PARTS = [8, 10]

function ColumnHeading({ text }) {
  const words = String(text).split(/\s+/).filter(Boolean)
  return words.map((word, index) => (
    <span key={`${index}-${word}`}>
      {index > 0 ? " " : null}
      <span className="col-head-word">{word}</span>
    </span>
  ))
}

function storageKey(writerCount, columnCount) {
  if (columnCount === writerCount + 7) return `schulverein-column-widths:${writerCount}`
  return `schulverein-column-widths:${writerCount}:${columnCount}`
}

function headerFloor(header) {
  const style = getComputedStyle(header)
  const extra =
    parseFloat(style.paddingLeft) +
    parseFloat(style.paddingRight) +
    parseFloat(style.borderLeftWidth) +
    parseFloat(style.borderRightWidth)
  const chunks = [...header.querySelectorAll(".col-head-word, .date-sort")]
  const widest = chunks.reduce(
    (max, node) => Math.max(max, node.getBoundingClientRect().width),
    0,
  )
  return Math.max(MIN_COLUMN, Math.ceil(widest + extra))
}

function voteButtonWidth(table) {
  let widest = 0
  for (const word of ["Ich", "stimme", "nicht", "zu"]) {
    const probe = document.createElement("button")
    probe.className = "btn vote-btn btn-outline-success"
    probe.type = "button"
    probe.textContent = word
    probe.style.cssText =
      "position:absolute;left:-9999px;top:0;width:max-content;white-space:nowrap;"
    table.appendChild(probe)
    widest = Math.max(widest, probe.getBoundingClientRect().width)
    probe.remove()
  }
  return widest
}

function columnFloor(header, table, userId) {
  let floor = headerFloor(header)
  if (header.dataset.userId && String(header.dataset.userId) === String(userId)) {
    const index = [...header.parentElement.children].indexOf(header)
    const cell = table.querySelector("tbody tr")?.children[index]
    const style = cell ? getComputedStyle(cell) : null
    const extra = style
      ? parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight) +
        parseFloat(style.borderLeftWidth) +
        parseFloat(style.borderRightWidth)
      : 0
    floor = Math.max(floor, Math.ceil(voteButtonWidth(table) + extra + 4))
  }
  return floor
}

function partWidths(containerWidth, columnCount) {
  const voterCount = columnCount - COLUMN_PARTS.length - TAIL_PARTS.length
  const parts = [
    ...COLUMN_PARTS,
    ...Array.from({ length: voterCount }, () => VOTER_PART),
    ...TAIL_PARTS,
  ]
  const total = parts.reduce((sum, part) => sum + part, 0)
  return parts.map((part) => (containerWidth * part) / total)
}

function spreadToFloors(widths, floors) {
  const next = widths.map((width, index) => Math.max(width, floors[index]))
  let remaining =
    next.reduce((sum, width) => sum + width, 0) - widths.reduce((sum, width) => sum + width, 0)
  const donors = next
    .map((width, index) => ({ index, slack: width - floors[index] }))
    .filter((donor) => donor.slack > 1)
    .sort((a, b) => {
      if (a.index === PURPOSE_INDEX) return -1
      if (b.index === PURPOSE_INDEX) return 1
      return b.slack - a.slack
    })
  for (const donor of donors) {
    if (remaining <= 0) break
    const give = Math.min(donor.slack, remaining)
    next[donor.index] -= give
    remaining -= give
  }
  return next
}

function layoutFloors(table, userId) {
  const headers = [...table.querySelectorAll("thead th")]
  const floors = headers.map((header) => columnFloor(header, table, userId))
  const container = table.closest(".table-responsive")?.clientWidth ?? 0
  if (container < 1 || headers.length < COLUMN_PARTS.length + TAIL_PARTS.length) return floors
  const baseline = spreadToFloors(partWidths(container, headers.length), floors)
  const others = floors.reduce(
    (sum, width, index) => (index === PURPOSE_INDEX ? sum : sum + width),
    0,
  )
  const doubled = Math.max(floors[PURPOSE_INDEX], baseline[PURPOSE_INDEX] * 2)
  const room = Math.max(floors[PURPOSE_INDEX], container - others)
  const next = floors.slice()
  next[PURPOSE_INDEX] = Math.min(doubled, room)
  return next
}

function fitHeaderWords(table, userId) {
  const headers = [...table.querySelectorAll("thead th")]
  const elements = [...table.querySelectorAll("col")]
  if (headers.length === 0 || headers.length !== elements.length) return false
  const container = table.closest(".table-responsive")?.clientWidth ?? 0
  if (container < 1) return false
  const rendered = headers.map((header) => header.getBoundingClientRect().width)
  if (rendered.some((width) => width < 1)) return false
  let next = spreadToFloors(rendered, layoutFloors(table, userId))
  let total = next.reduce((sum, width) => sum + width, 0)
  if (total > container) {
    const spare = Math.max(0, next[PURPOSE_INDEX] - columnFloor(headers[PURPOSE_INDEX], table, userId))
    const cut = Math.min(spare, total - container)
    next = next.slice()
    next[PURPOSE_INDEX] -= cut
    total -= cut
  }
  if (total > container + 1) {
    const scale = container / total
    next = next.map((width) => width * scale)
    total = container
  }
  const stable = next.every((width, index) => Math.abs(width - rendered[index]) < 2)
  const tableWidth = table.getBoundingClientRect().width
  if (stable && tableWidth <= container + 2) return false
  table.style.width = "100%"
  next.forEach((width, index) => {
    elements[index].style.width = `${(width / Math.max(total, 1)) * 100}%`
  })
  return true
}

function readWidths(writerCount, columnCount) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(writerCount, columnCount)) ?? "")
    if (!Array.isArray(saved) || saved.length !== columnCount) return null
    if (!saved.every((value) => typeof value === "number" && value > 0)) return null
    return saved
  } catch {
    return null
  }
}

export default function ApplicationsTable({
  applications,
  writers,
  user,
  sort,
  filter = "",
  editId = null,
}) {
  const wrapRef = useRef(null)
  const tableRef = useRef(null)
  const lineRefs = useRef([])
  const resizingRef = useRef(false)
  const columns = voterColumns(applications, writers)
  const columnCount = columns.length + 7

  useEffect(() => {
    const table = tableRef.current
    const wrap = wrapRef.current
    if (!table || !wrap) return

    const cols = () => [...table.querySelectorAll("col")]

    function placeLines() {
      const wrapLeft = wrap.getBoundingClientRect().left
      const height = table.getBoundingClientRect().height
      const headers = [...table.querySelectorAll("thead th")]
      headers.slice(0, -1).forEach((header, index) => {
        const line = lineRefs.current[index]
        if (!line) return
        const right = header.getBoundingClientRect().right - wrapLeft
        line.style.left = `${right - 4}px`
        line.style.height = `${height}px`
      })
    }

    function applyPercents(percents) {
      const elements = cols()
      percents.forEach((percent, index) => {
        if (elements[index]) elements[index].style.width = `${percent}%`
      })
      placeLines()
    }

    const saved = readWidths(writers.length, columnCount)
    if (saved) applyPercents(saved)
    fitHeaderWords(table, user.id)
    placeLines()

    const observer = new ResizeObserver(() => {
      if (resizingRef.current) return
      fitHeaderWords(table, user.id)
      placeLines()
    })
    observer.observe(table)
    window.addEventListener("resize", placeLines)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", placeLines)
    }
  }, [applications, writers.length, columnCount, sort, user.id])

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

    function apply(widths) {
      const total = widths.reduce((sum, width) => sum + width, 0)
      const percents = widths.map((width) => (width / total) * 100)
      percents.forEach((percent, column) => {
        elements[column].style.width = `${percent}%`
      })
      const wrapLeft = wrap.getBoundingClientRect().left
      const height = table.getBoundingClientRect().height
      const headers = [...table.querySelectorAll("thead th")]
      headers.slice(0, -1).forEach((header, lineIndex) => {
        const handle = lineRefs.current[lineIndex]
        if (!handle) return
        handle.style.left = `${header.getBoundingClientRect().right - wrapLeft - 4}px`
        handle.style.height = `${height}px`
      })
      return percents
    }

    const floors = layoutFloors(table, user.id)

    function onMove(moveEvent) {
      if (moveEvent.pointerId !== event.pointerId) return
      const leftFloor = floors[index]
      const rightFloor = floors[index + 1]
      let left = start[index] + (moveEvent.clientX - startX)
      let right = start[index + 1] - (moveEvent.clientX - startX)
      if (left < leftFloor) {
        right -= leftFloor - left
        left = leftFloor
      }
      if (right < rightFloor) {
        left -= rightFloor - right
        right = rightFloor
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
      const percents = apply(
        [...table.querySelectorAll("thead th")].map(
          (header) => header.getBoundingClientRect().width,
        ),
      )
      localStorage.setItem(storageKey(writers.length, columnCount), JSON.stringify(percents))
    }

    line.addEventListener("pointermove", onMove)
    line.addEventListener("pointerup", onUp)
    line.addEventListener("pointercancel", onUp)
  }

  return (
    <div className="table-responsive card shadow-sm">
      <div className="table-resize-wrap" ref={wrapRef}>
        <table
          className="table table-bordered table-hover align-middle mb-0 applications-table"
          ref={tableRef}
        >
          <colgroup>
            <col className="col-date" />
            <col className="col-applicant" />
            <col className="col-purpose" />
            <col className="col-amount" />
            <col className="col-receipt" />
            {columns.map((writer) => (
              <col className="col-voter" key={writer.id} />
            ))}
            <col className="col-approved" />
            <col className="col-closed" />
          </colgroup>
          <thead className="table-light">
            <tr>
              <th>
                <DateSort sort={sort} filter={filter} />
              </th>
              <th>
                <ColumnHeading text="Antragsteller" />
              </th>
              <th>
                <ColumnHeading text="Zweck" />
              </th>
              <th className="text-end">
                <span className="col-head-word">Höchst-</span>
                <br />
                <span className="col-head-word">betrag</span>
              </th>
              <th>
                <ColumnHeading text="Beleg" />
              </th>
              {columns.map((writer) => (
                <th key={writer.id} data-user-id={writer.id}>
                  <div>
                    <ColumnHeading text={givenName(writer.name)} />
                  </div>
                  {writer.role_label ? (
                    <div className="fw-normal text-secondary small">
                      {writer.role_label === "Vorsitzender und Schatzmeister" ? (
                        <>
                          <span className="col-head-word">Vorsitzender und</span>
                          <br />
                          <span className="col-head-word">Schatzmeister</span>
                        </>
                      ) : (
                        <ColumnHeading text={writer.role_label} />
                      )}
                    </div>
                  ) : null}
                </th>
              ))}
              <th>
                <ColumnHeading text="Genehmigt" />
              </th>
              <th>
                <ColumnHeading text="Abstimmung abgeschlossen" />
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => {
              const editable = user.can_write && !application.sealed && !application.voting_closed
              return (
                <EditableApplication
                  key={application.id}
                  as="tr"
                  className={editable ? "application-editable" : undefined}
                  enabled={editable}
                  editOnLoad={editId === application.id}
                  wideLayout
                  application={application}
                  sort={sort}
                  filter={filter}
                >
                  <>
                    <td className="text-nowrap">
                      {formatGermanDate(application.application_date)}
                    </td>
                    <td>{application.applicant}</td>
                    <td className="purpose">{application.purpose}</td>
                    <td className="text-end text-nowrap">
                      {formatEuro(application.amount_cents)} €
                    </td>
                    <td>
                      <Receipts application={application} user={user} />
                    </td>
                    {columns.map((writer) => {
                      const participant = isVoteParticipant(application, writer.id)
                      return (
                        <td
                          className={participant ? "vote-cell" : "vote-cell vote-outside"}
                          key={writer.id}
                        >
                          {participant ? (
                            <VoteControl
                              application={application}
                              voter={writer}
                              user={user}
                            />
                          ) : null}
                        </td>
                      )
                    })}
                    <td className="text-center">
                      <StatusIcon approved={application.approved} />
                    </td>
                    <td>
                      <CloseControl application={application} user={user} />
                      {user.can_write && !application.hasVotes ? (
                        <RemoveApplication applicationId={application.id} />
                      ) : null}
                    </td>
                  </>
                </EditableApplication>
              )
            })}
          </tbody>
        </table>
        {Array.from({ length: columnCount - 1 }, (_, index) => (
          <span
            key={index}
            ref={(node) => {
              lineRefs.current[index] = node
            }}
            className="col-line"
            role="separator"
            aria-orientation="vertical"
            aria-label="Spaltenbreite ändern"
            tabIndex={0}
            onPointerDown={(event) => startResize(event, index)}
          />
        ))}
      </div>
    </div>
  )
}
