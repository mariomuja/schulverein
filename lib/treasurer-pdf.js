import { existsSync, readFileSync } from "fs"
import path from "path"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { formatEuro, formatGermanDate } from "./money.js"

const PAGE_WIDTH = 841.89
const PAGE_HEIGHT = 595.28
const MARGIN = 32

const ink = rgb(0.13, 0.15, 0.16)
const muted = rgb(0.29, 0.33, 0.36)
const line = rgb(0.87, 0.89, 0.9)
const headerFill = rgb(0.945, 0.953, 0.961)

function voteLabel(decision) {
  if (decision === "yes") return "Ja"
  if (decision === "no") return "Nein"
  return "—"
}

function todayBerlin() {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date())
}

function wrap(text, font, size, maxWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]
  const lines = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function columns(writers, width) {
  const date = 62
  const applicant = 90
  const amount = 58
  const approved = 58
  const closed = 72
  const voter = 58
  const purpose = width - (date + applicant + amount + approved + closed + voter * writers.length)
  return [
    { title: "Datum", width: date },
    { title: "Antragsteller", width: applicant },
    { title: "Zweck", width: purpose },
    { title: "Betrag", width: amount, align: "right" },
    ...writers.map((writer) => ({ title: writer.name, width: voter })),
    { title: "Genehmigt", width: approved },
    { title: "Abgeschlossen", width: closed },
  ]
}

function rowValues(application, writers) {
  return [
    formatGermanDate(application.application_date),
    application.applicant,
    application.purpose,
    `${formatEuro(application.amount_cents)} €`,
    ...writers.map((writer) => voteLabel(application.votes[writer.id])),
    application.approved ? "Ja" : "Nein",
    application.voting_closed ? "Ja" : "Nein",
  ]
}

export async function buildTreasurerPdf(data) {
  const since = data.lastAuditDate
    ? data.applications.filter(
        (application) => application.application_date >= data.lastAuditDate,
      )
    : []
  const approvedClosed = since.filter(
    (application) => application.approved && application.voting_closed,
  )
  const approvedSum = approvedClosed.reduce(
    (sum, application) => sum + application.amount_cents,
    0,
  )
  const openCount = since.filter((application) => !application.voting_closed).length

  const pdf = await PDFDocument.create()
  pdf.setTitle("Förderanträge seit der letzten Kassenprüfung")
  pdf.setAuthor("Schulverein des Gymnasiums Heidberg e.V.")
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const logoPath = path.join(process.cwd(), "public", "logo.png")
  const logo = existsSync(logoPath) ? await pdf.embedPng(readFileSync(logoPath)) : null
  const contentWidth = PAGE_WIDTH - MARGIN * 2
  const cols = columns(data.writers, contentWidth)
  const pages = []

  function addPage() {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    pages.push(page)
    return page
  }

  let page = addPage()
  let y = PAGE_HEIGHT - MARGIN

  if (logo) {
    const height = 32
    const logoWidth = (logo.width / logo.height) * height
    page.drawImage(logo, { x: MARGIN, y: y - height, width: logoWidth, height })
  }

  const title = "Grundlage für den Bericht des Schatzmeisters"
  const titleSize = 14
  const titleWidth = bold.widthOfTextAtSize(title, titleSize)
  page.drawText(title, {
    x: PAGE_WIDTH - MARGIN - titleWidth,
    y: y - 16,
    size: titleSize,
    font: bold,
    color: ink,
  })
  const subtitle = "Förderanträge seit der letzten Kassenprüfung"
  const subtitleWidth = font.widthOfTextAtSize(subtitle, 10)
  page.drawText(subtitle, {
    x: PAGE_WIDTH - MARGIN - subtitleWidth,
    y: y - 32,
    size: 10,
    font,
    color: ink,
  })

  y -= 56
  const period = data.lastAuditDate
    ? `Letzte Kassenprüfung: ${formatGermanDate(data.lastAuditDate)}. Enthalten sind alle Anträge ab diesem Datum, chronologisch.`
    : "Es ist noch kein Datum der letzten Kassenprüfung gesetzt."
  for (const textLine of wrap(period, font, 9, contentWidth)) {
    page.drawText(textLine, { x: MARGIN, y, size: 9, font, color: muted })
    y -= 12
  }
  page.drawText(`Erstellt am ${todayBerlin()}.`, {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: muted,
  })
  y -= 22

  function drawHeader(target, top) {
    const height = 28
    target.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: contentWidth,
      height,
      color: headerFill,
      borderColor: line,
      borderWidth: 0.6,
    })
    let x = MARGIN
    for (const column of cols) {
      const lines = wrap(column.title, bold, 7.5, column.width - 6).slice(0, 2)
      lines.forEach((textLine, index) => {
        target.drawText(textLine, {
          x: x + 3,
          y: top - 12 - index * 9,
          size: 7.5,
          font: bold,
          color: ink,
        })
      })
      x += column.width
    }
    return top - height
  }

  function ensure(top, needed) {
    if (top - needed >= 40) return { page, y: top }
    page = addPage()
    return { page, y: drawHeader(page, PAGE_HEIGHT - MARGIN) }
  }

  if (data.lastAuditDate && since.length === 0) {
    page.drawText("Seit diesem Datum gibt es keine Förderanträge.", {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: ink,
    })
  } else if (data.lastAuditDate) {
    y = drawHeader(page, y)
    for (const application of since) {
      const values = rowValues(application, data.writers)
      const wrapped = values.map((value, index) =>
        wrap(value, font, 8, cols[index].width - 6),
      )
      const rowHeight = Math.max(...wrapped.map((lines) => lines.length)) * 11 + 8
      const space = ensure(y, rowHeight)
      page = space.page
      y = space.y
      let x = MARGIN
      wrapped.forEach((lines, index) => {
        page.drawRectangle({
          x,
          y: y - rowHeight,
          width: cols[index].width,
          height: rowHeight,
          borderColor: line,
          borderWidth: 0.4,
        })
        lines.forEach((textLine, lineIndex) => {
          const textWidth = font.widthOfTextAtSize(textLine, 8)
          const alignRight = cols[index].align === "right"
          page.drawText(textLine, {
            x: alignRight ? x + cols[index].width - 3 - textWidth : x + 3,
            y: y - 12 - lineIndex * 11,
            size: 8,
            font,
            color: ink,
          })
        })
        x += cols[index].width
      })
      y -= rowHeight
    }

    y -= 16
    const summary = `Gesamtsumme genehmigter Förderanträge: ${formatEuro(approvedSum)} EUR`
    const counted =
      approvedClosed.length === 1
        ? "Gezählt wird 1 genehmigter Antrag, dessen Abstimmung abgeschlossen ist."
        : `Gezählt werden ${approvedClosed.length} genehmigte Anträge, deren Abstimmung abgeschlossen ist.`
    const open =
      openCount === 1
        ? "1 Antrag in diesem Zeitraum ist noch nicht abgeschlossen."
        : `${openCount} Anträge in diesem Zeitraum sind noch nicht abgeschlossen.`
    const roles = data.writers
      .map((writer) =>
        writer.role_label ? `${writer.name} (${writer.role_label})` : writer.name,
      )
      .join(", ")
    const blocks = [summary, `${counted} ${open}`, `Schreibrecht: ${roles}`]
    for (const block of blocks) {
      const lines = wrap(block, block === summary ? bold : font, block === summary ? 11 : 9, contentWidth)
      const needed = lines.length * 13 + 4
      const space = ensure(y, needed)
      page = space.page
      y = space.y
      for (const textLine of lines) {
        page.drawText(textLine, {
          x: MARGIN,
          y,
          size: block === summary ? 11 : 9,
          font: block === summary ? bold : font,
          color: block === summary ? ink : muted,
        })
        y -= 13
      }
      y -= 4
    }
  }

  const footer =
    "Schulverein des Gymnasiums Heidberg e.V. | Fritz-Schumacher-Allee 200 | 22417 Hamburg  ·  schulverein@gymnasium-heidberg.de"
  for (const target of pages) {
    const footerWidth = font.widthOfTextAtSize(footer, 8)
    target.drawText(footer, {
      x: (PAGE_WIDTH - footerWidth) / 2,
      y: 16,
      size: 8,
      font,
      color: muted,
    })
  }

  return Buffer.from(await pdf.save())
}
