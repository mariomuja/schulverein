"use client"

import { useEffect, useRef } from "react"
import { formatEuro, formatGermanDate } from "../lib/money"
import CloseControl from "./CloseControl"
import DateSort from "./DateSort"
import StatusIcon from "./StatusIcon"
import VoteControl from "./VoteControl"

const MIN_COLUMN = 56

function storageKey(writerCount) {
  return `schulverein-column-widths:${writerCount}`
}

function readWidths(writerCount, columnCount) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(writerCount)) ?? "")
    if (!Array.isArray(saved) || saved.length !== columnCount) return null
    if (!saved.every((value) => typeof value === "number" && value > 0)) return null
    return saved
  } catch {
    return null
  }
}

export default function ApplicationsTable({ applications, writers, user, sort }) {
  const wrapRef = useRef(null)
  const tableRef = useRef(null)
  const lineRefs = useRef([])
  const columnCount = writers.length + 6

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
    else placeLines()

    const observer = new ResizeObserver(() => placeLines())
    observer.observe(table)
    window.addEventListener("resize", placeLines)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", placeLines)
    }
  }, [applications, writers.length, columnCount, sort])

  function startResize(event, index) {
    if (event.button !== 0) return
    const table = tableRef.current
    const wrap = wrapRef.current
    const line = event.currentTarget
    if (!table || !wrap) return

    event.preventDefault()
    line.setPointerCapture(event.pointerId)
    line.classList.add("is-active")
    document.body.classList.add("is-resizing-columns")

    const elements = [...table.querySelectorAll("col")]
    const start = elements.map((col) => col.getBoundingClientRect().width)
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

    function onMove(moveEvent) {
      if (moveEvent.pointerId !== event.pointerId) return
      let left = start[index] + (moveEvent.clientX - startX)
      let right = start[index + 1] - (moveEvent.clientX - startX)
      if (left < MIN_COLUMN) {
        right -= MIN_COLUMN - left
        left = MIN_COLUMN
      }
      if (right < MIN_COLUMN) {
        left -= MIN_COLUMN - right
        right = MIN_COLUMN
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
      line.removeEventListener("pointermove", onMove)
      line.removeEventListener("pointerup", onUp)
      line.removeEventListener("pointercancel", onUp)
      const percents = apply(
        elements.map((col) => col.getBoundingClientRect().width),
      )
      localStorage.setItem(storageKey(writers.length), JSON.stringify(percents))
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
            {writers.map((writer) => (
              <col className="col-voter" key={writer.id} />
            ))}
            <col className="col-approved" />
            <col className="col-closed" />
          </colgroup>
          <thead className="table-light">
            <tr>
              <th>
                <DateSort sort={sort} />
              </th>
              <th>Antragsteller</th>
              <th className="col-purpose">Zweck</th>
              <th className="text-end">Betrag</th>
              {writers.map((writer) => (
                <th key={writer.id}>
                  <div>{writer.name}</div>
                  {writer.role_label ? (
                    <div className="fw-normal text-secondary small">
                      {writer.role_label === "Vorsitzender und Schatzmeister" ? (
                        <>
                          Vorsitzender und
                          <br />
                          Schatzmeister
                        </>
                      ) : (
                        writer.role_label
                      )}
                    </div>
                  ) : null}
                </th>
              ))}
              <th>Genehmigt</th>
              <th>Abstimmung abgeschlossen</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr key={application.id}>
                <td className="text-nowrap">
                  {formatGermanDate(application.application_date)}
                </td>
                <td>{application.applicant}</td>
                <td className="purpose col-purpose">{application.purpose}</td>
                <td className="text-end text-nowrap">
                  {formatEuro(application.amount_cents)} €
                </td>
                {writers.map((writer) => (
                  <td key={writer.id}>
                    <VoteControl
                      application={application}
                      voter={writer}
                      user={user}
                    />
                  </td>
                ))}
                <td className="text-center">
                  <StatusIcon approved={application.approved} />
                </td>
                <td>
                  <CloseControl application={application} user={user} />
                </td>
              </tr>
            ))}
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
            onPointerDown={(event) => startResize(event, index)}
          />
        ))}
      </div>
    </div>
  )
}
