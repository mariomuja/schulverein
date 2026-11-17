"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getUser } from "../lib/auth"
import { query, withTransaction } from "../lib/db"
import { parseEuroToCents } from "../lib/money"
import { boardHref } from "../lib/list-query"
import { givenName } from "../lib/names"
import { appendLog, sealApplication } from "../lib/seal"

function applicationId(formData) {
  const id = Number(formData.get("applicationId"))
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export async function saveAuditDate(formData) {
  const user = await getUser()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const date = String(formData.get("lastAuditDate") ?? "").trim()
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/?hinweis=datum")

  await withTransaction(async (q) => {
    const current = await q(
      `SELECT last_audit_date::text AS last_audit_date FROM settings WHERE id = 1`,
    )
    const previous = current.rows[0]?.last_audit_date ?? ""
    await q(`UPDATE settings SET last_audit_date = $1 WHERE id = 1`, [date || null])
    await appendLog(q, {
      user,
      action: "kassenpruefung",
      detail: `Datum der letzten Kassenprüfung von ${previous || "leer"} auf ${date || "leer"}.`,
    })
  })
  revalidatePath("/")
}

export async function addApplication(formData) {
  const user = await getUser()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const applicationDate = String(formData.get("applicationDate") ?? "").trim()
  const applicant = givenName(cleanName(formData.get("applicant")))
  const purpose = String(formData.get("purpose") ?? "").trim()
  const amountCents = parseEuroToCents(formData.get("amount"))

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(applicationDate) ||
    applicant.length < 1 ||
    applicant.length > 120 ||
    purpose.length < 1 ||
    purpose.length > 500 ||
    amountCents == null
  ) {
    redirect(
      boardHref({
        sort: String(formData.get("sort") ?? ""),
        filter: String(formData.get("filter") ?? ""),
        hinweis: "antrag",
      }),
    )
  }

  await withTransaction(async (q) => {
    const inserted = await q(
      `INSERT INTO applications (application_date, applicant, purpose, amount_cents)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [applicationDate, applicant, purpose, amountCents],
    )
    await appendLog(q, {
      user,
      action: "antrag_angelegt",
      applicationId: inserted.rows[0].id,
      detail: `${applicationDate}, ${applicant}, ${amountCents} Cent.`,
    })
  })
  revalidatePath("/")
}

export async function removeApplication(formData) {
  const user = await getUser()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const id = applicationId(formData)
  if (!id) redirect("/?hinweis=antrag")

  const removed = await withTransaction(async (q) => {
    const result = await q(
      `DELETE FROM applications
       WHERE id = $1
         AND NOT EXISTS (SELECT 1 FROM votes WHERE application_id = $1)
         AND NOT EXISTS (SELECT 1 FROM vote_records WHERE application_id = $1)`,
      [id],
    )
    if (result.rowCount > 0) {
      await appendLog(q, {
        user,
        action: "antrag_entfernt",
        applicationId: id,
        detail: "Förderantrag ohne Stimmen entfernt.",
      })
    }
    return result
  })
  if (removed.rowCount === 0) redirect("/?hinweis=stimmen")
  revalidatePath("/")
}

export async function updateApplication(formData) {
  const user = await getUser()
  if (!user?.can_write) redirect(boardHref({ hinweis: "recht" }))

  const id = applicationId(formData)
  const applicationDate = String(formData.get("applicationDate") ?? "").trim()
  const applicant = givenName(cleanName(formData.get("applicant")))
  const purpose = String(formData.get("purpose") ?? "").trim()
  const amountCents = parseEuroToCents(formData.get("amount"))
  const path = (hinweis) =>
    boardHref({
      sort: String(formData.get("sort") ?? ""),
      filter: String(formData.get("filter") ?? ""),
      hinweis,
    })

  if (
    !id ||
    !/^\d{4}-\d{2}-\d{2}$/.test(applicationDate) ||
    applicant.length < 1 ||
    applicant.length > 120 ||
    purpose.length < 1 ||
    purpose.length > 500 ||
    amountCents == null
  ) {
    redirect(path("antrag"))
  }

  const updated = await withTransaction(async (q) => {
    const result = await q(
      `UPDATE applications
       SET application_date = $2, applicant = $3, purpose = $4, amount_cents = $5
       WHERE id = $1
         AND NOT EXISTS (SELECT 1 FROM votes WHERE application_id = $1)
         AND NOT EXISTS (SELECT 1 FROM vote_records WHERE application_id = $1)`,
      [id, applicationDate, applicant, purpose, amountCents],
    )
    if (result.rowCount > 0) {
      await appendLog(q, {
        user,
        action: "antrag_geaendert",
        applicationId: id,
        detail: `${applicationDate}, ${applicant}, ${amountCents} Cent.`,
      })
    }
    return result
  })
  if (updated.rowCount === 0) redirect(path("geaendert"))
  revalidatePath("/")
}

export async function castVote(formData) {
  const user = await getUser()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const id = applicationId(formData)
  const decision = String(formData.get("decision") ?? "")
  if (!id || (decision !== "yes" && decision !== "no")) redirect("/?hinweis=antrag")

  await withTransaction(async (q) => {
    const existing = await q(
      `SELECT voting_closed FROM applications WHERE id = $1 FOR UPDATE`,
      [id],
    )
    if (!existing.rows[0]) redirect("/?hinweis=antrag")
    const sealed = await q(
      `SELECT 1 FROM vote_records WHERE application_id = $1`,
      [id],
    )
    if (existing.rows[0].voting_closed || sealed.rowCount > 0) {
      redirect("/?hinweis=geschlossen")
    }
    const previousVote = await q(
      `SELECT decision FROM votes WHERE application_id = $1 AND user_id = $2`,
      [id, user.id],
    )
    await q(
      `INSERT INTO votes (application_id, user_id, decision)
       VALUES ($1, $2, $3)
       ON CONFLICT (application_id, user_id)
       DO UPDATE SET decision = EXCLUDED.decision, updated_at = NOW()`,
      [id, user.id, decision],
    )
    const previous = previousVote.rows[0]?.decision
    const label = decision === "yes" ? "Ja" : "Nein"
    const detail = previous
      ? `Von ${previous === "yes" ? "Ja" : "Nein"} auf ${label}.`
      : label
    await appendLog(q, {
      user,
      action: "stimme",
      applicationId: id,
      detail,
    })
  })
  revalidatePath("/")
}

function cleanName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ")
}

export async function addUser(formData) {
  const user = await getUser()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const name = givenName(cleanName(formData.get("name")))
  const roleLabel = cleanName(formData.get("roleLabel"))
  const canWrite = formData.get("canWrite") === "on"
  if (name.length < 1 || name.length > 120 || roleLabel.length > 80) {
    redirect("/?hinweis=benutzer")
  }

  try {
    await query(
      `INSERT INTO users (name, role_label, can_write, is_treasurer, sort_order, login_token)
       VALUES (
         $1, $2, $3, FALSE,
         (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM users),
         $4
       )`,
      [name, roleLabel || null, canWrite, randomBytes(32).toString("base64url")],
    )
  } catch (error) {
    if (error?.code === "23505") redirect("/?hinweis=benutzer")
    throw error
  }
  revalidatePath("/")
}

export async function removeUser(formData) {
  const user = await getUser()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const id = Number(formData.get("userId"))
  if (!Number.isInteger(id) || id <= 0) redirect("/?hinweis=benutzer")

  const found = await query(
    `SELECT (
        EXISTS (SELECT 1 FROM votes WHERE user_id = $1)
        OR EXISTS (SELECT 1 FROM vote_record_ballots WHERE user_id = $1)
      ) AS has_voted
     FROM users
     WHERE id = $1`,
    [id],
  )
  if (!found.rows[0]) redirect("/?hinweis=benutzer")
  if (found.rows[0].has_voted) redirect("/?hinweis=stimme")

  await query(`DELETE FROM sessions WHERE user_id = $1`, [id])
  const removed = await query(
    `DELETE FROM users
     WHERE id = $1
       AND NOT EXISTS (SELECT 1 FROM votes WHERE user_id = $1)
       AND NOT EXISTS (SELECT 1 FROM vote_record_ballots WHERE user_id = $1)
       AND NOT EXISTS (SELECT 1 FROM vote_records WHERE closed_by_user_id = $1)`,
    [id],
  )
  if (removed.rowCount === 0) redirect("/?hinweis=stimme")
  revalidatePath("/")
}

export async function logout() {
  const jar = await cookies()
  const sessionId = jar.get("sv_session")?.value
  if (sessionId) {
    await query(`DELETE FROM sessions WHERE id = $1`, [sessionId])
  }
  jar.set("sv_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  redirect("/")
}

export async function setVotingClosed(formData) {
  const user = await getUser()
  if (!user?.is_treasurer) redirect("/?hinweis=schatzmeister")

  const id = applicationId(formData)
  if (!id) redirect("/?hinweis=antrag")
  const closed = String(formData.get("closed") ?? "") === "true"
  if (!closed) redirect("/?hinweis=versiegelt")

  const result = await withTransaction((q) => sealApplication(q, id, user))
  if (result.error) redirect(`/?hinweis=${result.error}`)
  revalidatePath("/")
}
