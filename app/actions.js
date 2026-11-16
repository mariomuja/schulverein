"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getUser } from "../lib/auth"
import { query } from "../lib/db"
import { parseEuroToCents } from "../lib/money"

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

  await query(`UPDATE settings SET last_audit_date = $1 WHERE id = 1`, [
    date || null,
  ])
  revalidatePath("/")
}

export async function addApplication(formData) {
  const user = await getUser()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const applicationDate = String(formData.get("applicationDate") ?? "").trim()
  const applicant = String(formData.get("applicant") ?? "").trim()
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
    redirect("/?hinweis=antrag")
  }

  await query(
    `INSERT INTO applications (application_date, applicant, purpose, amount_cents)
     VALUES ($1, $2, $3, $4)`,
    [applicationDate, applicant, purpose, amountCents],
  )
  revalidatePath("/")
}

export async function castVote(formData) {
  const user = await getUser()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const id = applicationId(formData)
  const decision = String(formData.get("decision") ?? "")
  if (!id || (decision !== "yes" && decision !== "no")) redirect("/?hinweis=antrag")

  const existing = await query(
    `SELECT voting_closed FROM applications WHERE id = $1`,
    [id],
  )
  if (!existing.rows[0]) redirect("/?hinweis=antrag")
  if (existing.rows[0].voting_closed) redirect("/?hinweis=geschlossen")

  await query(
    `INSERT INTO votes (application_id, user_id, decision)
     VALUES ($1, $2, $3)
     ON CONFLICT (application_id, user_id)
     DO UPDATE SET decision = EXCLUDED.decision, updated_at = NOW()`,
    [id, user.id, decision],
  )
  revalidatePath("/")
}

function cleanName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ")
}

export async function addUser(formData) {
  const user = await getUser()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const name = cleanName(formData.get("name"))
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
    `SELECT EXISTS (SELECT 1 FROM votes WHERE user_id = $1) AS has_voted
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
       AND NOT EXISTS (SELECT 1 FROM votes WHERE user_id = $1)`,
    [id],
  )
  if (removed.rowCount === 0) redirect("/?hinweis=stimme")
  revalidatePath("/")
}

export async function setVotingClosed(formData) {
  const user = await getUser()
  if (!user?.is_treasurer) redirect("/?hinweis=schatzmeister")

  const id = applicationId(formData)
  if (!id) redirect("/?hinweis=antrag")
  const closed = String(formData.get("closed") ?? "") === "true"

  await query(`UPDATE applications SET voting_closed = $1 WHERE id = $2`, [
    closed,
    id,
  ])
  revalidatePath("/")
}
