"use server"

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
