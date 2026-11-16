import { existsSync, readFileSync } from "fs"
import path from "path"
import PDFDocument from "pdfkit"
import { formatEuro, formatGermanDate } from "./money.js"

const MARGIN = 32
const FOOTER = 36

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

function columns(writers, width) {
  const date = 62
  const applicant = 88
  const amount = 58
  const approved = 52
  const closed = 62
  const voter = Math.min(58, Math.max(44, writers.length ? 220 / writers.length : 44))
  const used = date + applicant + amount + approved + closed + voter * writers.length
  const purpose = Math.max(120, width - used)
  return [
    { title: "Datum", width: date, key: "date" },
    { title: "Antragsteller", width: applicant, key: "applicant" },
    { title: "Zweck", width: purpose, key: "purpose" },
    { title: "Betrag", width: amount, key: "amount" },
    ...writers.map((writer) => ({
      title: writer.name,
      width: voter,
      key: `vote-${writer.id}`,
    })),
    { title: "Genehmigt", width: approved, key: "approved" },
    { title: "Abgeschlossen", width: closed, key: "closed" },
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

function cellHeight(doc, text, width) {
  return doc.heightOfString(String(text), { width: width - 6, align: "left" })
}

export function buildTreasurerPdf(data) {
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

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: { top: MARGIN, right: MARGIN, bottom: 12, left: MARGIN },
      bufferPages: true,
      info: {
        Title: "Förderanträge seit der letzten Kassenprüfung",
        Author: "Schulverein des Gymnasiums Heidberg e.V.",
      },
    })
    const chunks = []
    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const width = doc.page.width - MARGIN * 2
    const logoPath = path.join(process.cwd(), "public", "logo.png")
    if (existsSync(logoPath)) {
      doc.image(readFileSync(logoPath), MARGIN, MARGIN, { height: 34 })
    }

    doc
      .fillColor("#212529")
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Grundlage für den Bericht des Schatzmeisters", MARGIN + 230, MARGIN, {
        width: width - 230,
        align: "right",
      })
    doc
      .font("Helvetica")
      .fontSize(10)
      .text("Förderanträge seit der letzten Kassenprüfung", {
        width: width - 230,
        align: "right",
      })
    doc.moveDown(0.4)
    doc
      .fontSize(9)
      .fillColor("#495057")
      .text(
        data.lastAuditDate
          ? `Letzte Kassenprüfung: ${formatGermanDate(data.lastAuditDate)}. Enthalten sind alle Anträge ab diesem Datum, chronologisch.`
          : "Es ist noch kein Datum der letzten Kassenprüfung gesetzt.",
        MARGIN,
        MARGIN + 48,
        { width },
      )
    doc.text(`Erstellt am ${todayBerlin()}.`, { width })

    let y = doc.y + 12
    const cols = columns(data.writers, width)

    function pageBottom() {
      return doc.page.height - FOOTER - 8
    }

    function drawHeader(top) {
      let x = MARGIN
      const height = 26
      doc.save()
      doc.rect(MARGIN, top, width, height).fill("#f1f3f5")
      doc.fillColor("#212529").font("Helvetica-Bold").fontSize(7.5)
      for (const column of cols) {
        doc.text(column.title, x + 3, top + 4, {
          width: column.width - 6,
          height: height - 6,
        })
        x += column.width
      }
      doc.restore()
      doc.rect(MARGIN, top, width, height).strokeColor("#dee2e6").stroke()
      return top + height
    }

    function drawRow(application, top) {
      const values = rowValues(application, data.writers)
      doc.font("Helvetica").fontSize(8)
      const height =
        Math.max(
          16,
          ...values.map((value, index) => cellHeight(doc, value, cols[index].width)),
        ) + 8
      if (top + height > pageBottom()) {
        doc.addPage()
        top = drawHeader(MARGIN)
      }
      let x = MARGIN
      doc.save()
      doc.rect(MARGIN, top, width, height).fill("#ffffff")
      doc.fillColor("#212529").font("Helvetica").fontSize(8)
      values.forEach((value, index) => {
        const align = index === 3 ? "right" : "left"
        doc.text(String(value), x + 3, top + 4, {
          width: cols[index].width - 6,
          height: height - 6,
          align,
        })
        doc
          .rect(x, top, cols[index].width, height)
          .strokeColor("#dee2e6")
          .stroke()
        x += cols[index].width
      })
      doc.restore()
      return top + height
    }

    if (!data.lastAuditDate) {
      finish()
      return
    }

    if (since.length === 0) {
      doc.fillColor("#212529").font("Helvetica").fontSize(10).text(
        "Seit diesem Datum gibt es keine Förderanträge.",
        MARGIN,
        y,
      )
    } else {
      y = drawHeader(y)
      for (const application of since) {
        y = drawRow(application, y)
      }
      y += 14
      if (y + 48 > pageBottom()) {
        doc.addPage()
        y = MARGIN
      }
      doc.fillColor("#212529").font("Helvetica-Bold").fontSize(11).text(
        `Gesamtsumme genehmigter Förderanträge: ${formatEuro(approvedSum)} EUR`,
        MARGIN,
        y,
        { width },
      )
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#495057")
        .text(
          `${approvedClosed.length === 1 ? "Gezählt wird 1 genehmigter Antrag, dessen Abstimmung abgeschlossen ist." : `Gezählt werden ${approvedClosed.length} genehmigte Anträge, deren Abstimmung abgeschlossen ist.`} ${openCount === 1 ? "1 Antrag in diesem Zeitraum ist noch nicht abgeschlossen." : `${openCount} Anträge in diesem Zeitraum sind noch nicht abgeschlossen.`}`,
          { width },
        )
      const roles = data.writers
        .map((writer) =>
          writer.role_label ? `${writer.name} (${writer.role_label})` : writer.name,
        )
        .join(", ")
      doc.moveDown(0.4)
      doc.text(`Schreibrecht: ${roles}`, { width })
    }

    finish()

    function finish() {
      const range = doc.bufferedPageRange()
      for (let page = 0; page < range.count; page += 1) {
        doc.switchToPage(page)
        doc.page.margins.bottom = 0
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#6c757d")
          .text(
            "Schulverein des Gymnasiums Heidberg e.V. | Fritz-Schumacher-Allee 200 | 22417 Hamburg  ·  schulverein@gymnasium-heidberg.de",
            MARGIN,
            doc.page.height - 22,
            { width, align: "center", lineBreak: false },
          )
      }
      doc.end()
    }
  })
}
