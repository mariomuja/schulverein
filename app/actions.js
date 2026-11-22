"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { requestOrigin } from "../lib/account-links"
import { getUser } from "../lib/auth"
import { query, withTransaction } from "../lib/db"
import { parseEuroToCents } from "../lib/money"
import { boardHref } from "../lib/list-query"
import { givenName, hasGivenAndFamilyName } from "../lib/names"
import { archivePeriod } from "../lib/archive"
import { appendLog, sealApplication } from "../lib/seal"
import { acceptReceipt, maxReceipts } from "../lib/receipts"
import { canAdministerUsers, canEditMembers, canReadMembers, ensureAccess, isJoinAccount } from "../lib/access"
import { getMember, insertMember, markMemberDeleted, memberEmailExists, memberFromFields, memberIbanExists, memberNameExists, preserveBankData, replaceDraftConfirmation, restoreMember as restoreMemberRecord, splitEmails, updateMember as replaceMember } from "../lib/members"
import { confirmJoinRequest, sendConfirmationMail, submitJoinRequest } from "../lib/join"
import { findBankByBlz } from "../lib/banks.mjs"
import { createLoginSession } from "../lib/login"
import { hashSecret } from "../lib/secret"
import { sendTemplateMail, updateMailTemplate } from "../lib/outgoing-mail"
import { deliverInvitation, readAgenda } from "../lib/invitation"

async function boardActor() {
  const user = await getUser()
  if (isJoinAccount(user)) redirect("/beitritt")
  return user
}

function applicationId(formData) {
  const id = Number(formData.get("applicationId"))
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export async function saveAuditDate(formData) {
  const user = await boardActor()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const date = String(formData.get("lastAuditDate") ?? "").trim()
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/?hinweis=datum")

  const result = await withTransaction(async (q) => {
    const current = await q(
      `SELECT last_audit_date::text AS last_audit_date FROM settings WHERE id = 1`,
    )
    const previous = current.rows[0]?.last_audit_date ?? ""
    if (date === previous) return { ok: true }
    if (previous && (!date || date < previous)) return { error: "zeitraum" }
    if (previous && date > previous) await archivePeriod(q, user, previous, date)
    await q(`UPDATE settings SET last_audit_date = $1 WHERE id = 1`, [date || null])
    await appendLog(q, {
      user,
      action: "kassenpruefung",
      detail: `Datum der letzten Kassenprüfung von ${previous || "leer"} auf ${date || "leer"}.`,
    })
    return { ok: true }
  })
  if (result.error) redirect(`/?hinweis=${result.error}`)
  revalidatePath("/")
}

export async function addApplication(formData) {
  const user = await boardActor()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const applicationDate = String(formData.get("applicationDate") ?? "").trim()
  const applicant = cleanName(formData.get("applicant"))
  const purpose = String(formData.get("purpose") ?? "").trim()
  const amountCents = parseEuroToCents(formData.get("amount"))

  if (applicant.length > 0 && applicant.length <= 120 && !hasGivenAndFamilyName(applicant)) {
    redirect(
      boardHref({
        sort: String(formData.get("sort") ?? ""),
        filter: String(formData.get("filter") ?? ""),
        hinweis: "nachname",
      }),
    )
  }

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

  const saved = await withTransaction(async (q) => {
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
    return { ok: true }
  })
  if (saved.error) {
    redirect(
      boardHref({
        sort: String(formData.get("sort") ?? ""),
        filter: String(formData.get("filter") ?? ""),
        hinweis: saved.error,
      }),
    )
  }
  revalidatePath("/")
}

export async function removeApplication(formData) {
  const user = await boardActor()
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
  const user = await boardActor()
  if (!user?.can_write) redirect(boardHref({ hinweis: "recht" }))

  const id = applicationId(formData)
  const applicationDate = String(formData.get("applicationDate") ?? "").trim()
  const applicant = cleanName(formData.get("applicant"))
  const purpose = String(formData.get("purpose") ?? "").trim()
  const amountCents = parseEuroToCents(formData.get("amount"))
  const path = (hinweis) =>
    boardHref({
      sort: String(formData.get("sort") ?? ""),
      filter: String(formData.get("filter") ?? ""),
      hinweis,
      edit: id || "",
    })

  if (applicant.length > 0 && applicant.length <= 120 && !hasGivenAndFamilyName(applicant)) {
    redirect(path("nachname"))
  }

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
         AND voting_closed = FALSE
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
  if (updated?.error) redirect(path(updated.error))
  if (updated.rowCount === 0) redirect(path("geaendert"))
  revalidatePath("/")
}

export async function addReceipts(formData) {
  const user = await boardActor()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const id = applicationId(formData)
  const incoming = formData
    .getAll("files")
    .filter((file) => file && typeof file.arrayBuffer === "function" && file.size > 0)
  if (!id || incoming.length === 0) redirect("/?hinweis=beleg")

  const prepared = []
  for (const file of incoming) {
    const accepted = acceptReceipt(file)
    if (!accepted) redirect("/?hinweis=beleg")
    prepared.push({ ...accepted, bytes: Buffer.from(await file.arrayBuffer()) })
  }

  await withTransaction(async (q) => {
    const open = await q(
      `SELECT 1
       FROM applications a
       WHERE a.id = $1
         AND a.voting_closed = FALSE
         AND NOT EXISTS (SELECT 1 FROM vote_records r WHERE r.application_id = a.id)
       FOR UPDATE`,
      [id],
    )
    if (open.rowCount === 0) redirect("/?hinweis=geaendert")
    const count = await q(
      `SELECT count(*)::int AS n FROM application_files WHERE application_id = $1`,
      [id],
    )
    if (count.rows[0].n + prepared.length > maxReceipts) redirect("/?hinweis=beleg")
    for (const file of prepared) {
      await q(
        `INSERT INTO application_files (application_id, file_name, content_type, content, uploaded_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, file.name, file.type, file.bytes, user.id],
      )
      await appendLog(q, {
        user,
        action: "beleg_hinzugefuegt",
        applicationId: id,
        detail: file.name,
      })
    }
  })
  revalidatePath("/")
}

export async function removeReceipt(formData) {
  const user = await boardActor()
  if (!user?.can_write) redirect("/?hinweis=recht")

  const id = Number(formData.get("fileId"))
  if (!Number.isInteger(id) || id <= 0) redirect("/?hinweis=beleg")

  const removed = await withTransaction(async (q) => {
    const result = await q(
      `DELETE FROM application_files f
       USING applications a
       WHERE f.id = $1
         AND f.application_id = a.id
         AND a.voting_closed = FALSE
         AND NOT EXISTS (SELECT 1 FROM vote_records r WHERE r.application_id = a.id)
       RETURNING f.application_id, f.file_name`,
      [id],
    )
    if (result.rowCount === 0) return result
    await appendLog(q, {
      user,
      action: "beleg_entfernt",
      applicationId: result.rows[0].application_id,
      detail: result.rows[0].file_name,
    })
    return result
  })
  if (removed.rowCount === 0) redirect("/?hinweis=geaendert")
  revalidatePath("/")
}

export async function castVote(formData) {
  const user = await boardActor()
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
  const user = await boardActor()
  if (!canAdministerUsers(user)) redirect("/?hinweis=recht")

  const name = givenName(cleanName(formData.get("name")))
  const roleLabel = cleanName(formData.get("roleLabel"))
  const canWrite = formData.get("applicationsAccess") === "write" || formData.get("canWrite") === "on"
  const membersAccess = ["read", "write"].includes(String(formData.get("membersAccess")))
    ? String(formData.get("membersAccess"))
    : "none"
  if (name.length < 1 || name.length > 120 || roleLabel.length > 80) {
    redirect("/?hinweis=benutzer")
  }

  const token = randomBytes(32).toString("base64url")
  let created
  try {
    await ensureAccess()
    created = await withTransaction(async (q) => {
      const inserted = await q(
        `INSERT INTO users (name, role_label, can_write, members_access, is_treasurer, sort_order, login_token)
         VALUES (
           $1, $2, $3, $4, FALSE,
           (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM users),
           $5
         )
         RETURNING id`,
        [name, roleLabel || null, canWrite, membersAccess, hashSecret(token)],
      )
      await appendLog(q, {
        user,
        action: "benutzer_angelegt",
        detail: `${name}, Förderanträge ${canWrite ? "Schreibrecht" : "Leserecht"}, Mitglieder ${membersAccess}.`,
      })
      return inserted.rows[0]
    })
  } catch (error) {
    if (error?.code === "23505") redirect("/?hinweis=benutzer")
    throw error
  }
  revalidatePath("/")
  return { id: created.id, name, loginUrl: `${await requestOrigin()}/${token}` }
}

function userId(formData) {
  const id = Number(formData.get("userId"))
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export async function deactivateUserToken(formData) {
  const user = await boardActor()
  if (!canAdministerUsers(user)) redirect("/?hinweis=recht")

  const id = userId(formData)
  if (!id) redirect("/?hinweis=benutzer")
  const target = await query(`SELECT join_link FROM users WHERE id = $1`, [id])
  if (!target.rows[0]) redirect("/?hinweis=benutzer")
  if (target.rows[0].join_link) redirect("/?hinweis=recht")

  const updated = await withTransaction(async (q) => {
    const result = await q(
      `UPDATE users
       SET login_token = NULL
       WHERE id = $1 AND login_token IS NOT NULL
       RETURNING name`,
      [id],
    )
    if (result.rowCount === 0) return result
    await q(`DELETE FROM sessions WHERE user_id = $1`, [id])
    await appendLog(q, {
      user,
      action: "token_deaktiviert",
      detail: `Anmeldetoken für ${result.rows[0].name} deaktiviert.`,
    })
    return result
  })
  if (updated.rowCount === 0) {
    const exists = await query(`SELECT id FROM users WHERE id = $1`, [id])
    redirect(exists.rows[0] ? "/?hinweis=recht" : "/?hinweis=benutzer")
  }
  revalidatePath("/")
}

export async function renewUserToken(formData) {
  const actor = await boardActor()
  if (!actor) redirect("/")
  const id = userId(formData)
  if (!id) redirect("/?hinweis=benutzer")
  if (!canAdministerUsers(actor) && id !== actor.id) redirect("/?hinweis=recht")
  const target = await query(`SELECT join_link FROM users WHERE id = $1`, [id])
  if (!target.rows[0]) redirect("/?hinweis=benutzer")
  if (target.rows[0].join_link && !canAdministerUsers(actor)) redirect("/?hinweis=recht")
  const user = actor

  const token = randomBytes(32).toString("base64url")
  const sessionId = hashSecret((await cookies()).get("sv_session")?.value ?? "")
  const updated = await withTransaction(async (q) => {
    const result = await q(
      `UPDATE users
       SET login_token = $2
       WHERE id = $1
       RETURNING name, join_link`,
      [id, hashSecret(token)],
    )
    if (result.rowCount === 0) return result
    await q(`DELETE FROM sessions WHERE user_id = $1 AND id IS DISTINCT FROM $2`, [id, sessionId])
    await appendLog(q, {
      user,
      action: "token_erneuert",
      detail: `Neues Anmeldetoken für ${result.rows[0].name} erstellt.`,
    })
    return result
  })
  if (updated.rowCount === 0) {
    const exists = await query(`SELECT id FROM users WHERE id = $1`, [id])
    redirect(exists.rows[0] ? "/?hinweis=recht" : "/?hinweis=benutzer")
  }
  revalidatePath("/")
  return {
    id,
    name: updated.rows[0].name,
    joinLink: updated.rows[0].join_link === true,
    loginUrl: `${await requestOrigin()}/${token}`,
  }
}

export async function removeUser(formData) {
  const user = await boardActor()
  if (!canAdministerUsers(user)) redirect("/?hinweis=recht")

  const id = Number(formData.get("userId"))
  if (!Number.isInteger(id) || id <= 0) redirect("/?hinweis=benutzer")

  const found = await query(
    `SELECT join_link, (
        EXISTS (SELECT 1 FROM votes WHERE user_id = $1)
        OR EXISTS (SELECT 1 FROM vote_record_ballots WHERE user_id = $1)
      ) AS has_voted
     FROM users
     WHERE id = $1`,
    [id],
  )
  if (!found.rows[0]) redirect("/?hinweis=benutzer")
  if (found.rows[0].join_link) redirect("/?hinweis=recht")
  if (found.rows[0].has_voted) redirect("/?hinweis=stimme")

  let removed
  try {
    removed = await withTransaction(async (q) => {
      await q(`DELETE FROM sessions WHERE user_id = $1`, [id])
      const result = await q(
        `DELETE FROM users
         WHERE id = $1
           AND join_link = FALSE
           AND NOT EXISTS (SELECT 1 FROM votes WHERE user_id = $1)
           AND NOT EXISTS (SELECT 1 FROM vote_record_ballots WHERE user_id = $1)
           AND NOT EXISTS (SELECT 1 FROM vote_records WHERE closed_by_user_id = $1)
         RETURNING name`,
        [id],
      )
      if (result.rowCount === 0) throw new Error("KEEP")
      await appendLog(q, {
        user,
        action: "benutzer_entfernt",
        detail: `${result.rows[0].name} entfernt.`,
      })
      return result
    })
  } catch (error) {
    if (error?.message !== "KEEP") throw error
    redirect("/?hinweis=stimme")
  }
  revalidatePath("/")
}

function limited(value, max) {
  return String(value ?? "").trim().slice(0, max)
}

export async function updateUserAccess(formData) {
  const user = await boardActor()
  if (!canAdministerUsers(user)) redirect("/?hinweis=recht")
  const id = userId(formData)
  const applicationsWrite = formData.get("applicationsAccess") === "write"
  const membersAccess = String(formData.get("membersAccess") ?? "none")
  if (!id || !["none", "read", "write"].includes(membersAccess)) redirect("/?hinweis=benutzer")
  const target = await query(`SELECT join_link FROM users WHERE id = $1`, [id])
  if (!target.rows[0] || target.rows[0].join_link) redirect("/?hinweis=recht")
  await ensureAccess()
  const updated = await query(
    `UPDATE users SET can_write = $2, members_access = $3 WHERE id = $1 RETURNING name`,
    [id, applicationsWrite, membersAccess],
  )
  if (!updated.rows[0]) redirect("/?hinweis=benutzer")
  await query(
    `INSERT INTO audit_log (actor_user_id, actor_name, action, detail)
     VALUES ($1, $2, 'rechte', $3)`,
    [
      user.id,
      user.name,
      `${updated.rows[0].name}: Förderanträge ${applicationsWrite ? "Schreibrecht" : "Leserecht"}, Mitglieder ${membersAccess}.`,
    ],
  )
  revalidatePath("/", "layout")
}

function memberRedirect(letter, notice, editId) {
  const params = new URLSearchParams()
  if (letter) params.set("buchstabe", letter)
  if (notice) params.set("hinweis", notice)
  if (editId) params.set("bearbeiten", String(editId))
  const query = params.toString()
  return query ? `/mitglieder?${query}` : "/mitglieder"
}

function memberFields(formData) {
  return memberFromFields({
    memberNumber: formData.get("memberNumber"),
    familyName: formData.get("familyName"),
    givenName: formData.get("givenName"),
    email: formData.get("email"),
    contribution: formData.get("contribution"),
    joinedOn: formData.get("joinedOn"),
    mandateId: formData.get("mandateId"),
    bic: formData.get("bic"),
    bankName: formData.get("bankName"),
    iban: formData.get("iban"),
    accountHolder: formData.get("accountHolder"),
  })
}

export async function saveMember(formData) {
  const user = await boardActor()
  const letter = String(formData.get("letter") ?? "")
  if (!canEditMembers(user)) redirect("/mitglieder")
  const data = memberFields(formData)
  if (!data) redirect(memberRedirect(letter, "mitglied"))
  const addresses = splitEmails(data.email)
  let notice = ""
  try {
    if (addresses.length === 0) {
      await insertMember(user.id, data)
    } else {
      const token = randomBytes(32).toString("base64url")
      const id = await insertMember(user.id, data, {
        draft: true,
        confirmHash: hashSecret(token),
      })
      const mailing = await sendConfirmationMail({
        token,
        addresses,
        givenName: data.givenName,
        familyName: data.familyName,
      })
      if (mailing.note) {
        await replaceDraftConfirmation(id, data, hashSecret(token), mailing.note)
        notice = "zustellung"
      }
    }
  } catch {
    redirect(memberRedirect(letter, "schluessel"))
  }
  revalidatePath("/mitglieder")
  revalidatePath("/statistik")
  redirect(memberRedirect(letter, notice))
}

export async function resendMemberConfirmation(formData) {
  const user = await boardActor()
  const letter = String(formData.get("letter") ?? "")
  const id = Number(formData.get("memberId"))
  if (!canEditMembers(user) || !Number.isInteger(id) || id <= 0) redirect("/mitglieder")
  const existing = await getMember(id)
  if (!existing?.draft) redirect(memberRedirect(letter, "mitglied", id))
  const email = String(formData.get("email") ?? "").trim()
  const addresses = splitEmails(email)
  if (addresses.length === 0 || addresses.some((part) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part))) {
    redirect(memberRedirect(letter, "mitglied", id))
  }
  const data = { ...existing, email }
  delete data.id
  delete data.draft
  delete data.confirmationNote
  const token = randomBytes(32).toString("base64url")
  const mailing = await sendConfirmationMail({
    token,
    addresses,
    givenName: data.givenName,
    familyName: data.familyName,
  })
  const saved = await replaceDraftConfirmation(id, data, hashSecret(token), mailing.note)
  if (!saved) redirect(memberRedirect(letter, "mitglied"))
  revalidatePath("/mitglieder")
  redirect(memberRedirect(letter, mailing.note ? "zustellung" : "", id))
}

export async function updateMember(formData) {
  const user = await boardActor()
  const letter = String(formData.get("letter") ?? "")
  const id = Number(formData.get("memberId"))
  if (!canEditMembers(user) || !Number.isInteger(id) || id <= 0) redirect("/mitglieder")
  const data = memberFields(formData)
  if (!data) redirect(`${memberRedirect(letter, "mitglied")}&bearbeiten=${id}`)
  const existing = await getMember(id)
  if (!existing) redirect(memberRedirect(letter, "mitglied"))
  try {
    const saved = await replaceMember(id, preserveBankData(data, existing))
    if (!saved) redirect(memberRedirect(letter, "mitglied"))
  } catch {
    redirect(memberRedirect(letter, "schluessel"))
  }
  revalidatePath("/mitglieder")
  revalidatePath("/statistik")
  redirect(memberRedirect(letter))
}

export async function deleteMember(formData) {
  const user = await boardActor()
  const letter = String(formData.get("letter") ?? "")
  const id = Number(formData.get("memberId"))
  if (!canEditMembers(user) || !Number.isInteger(id) || id <= 0) redirect("/mitglieder")
  const member = await getMember(id)
  const removed = await markMemberDeleted(id)
  if (!removed) redirect(memberRedirect(letter))
  let notice = ""
  if (formData.get("sendExitMail") === "1") {
    const addresses = splitEmails(member?.email)
    if (addresses.length === 0) {
      notice = "keine-mail"
    } else {
      let sent = false
      try {
        sent = await sendTemplateMail({
          templateId: "austritt",
          addresses,
          values: {
            Vorname: member?.givenName ?? "",
            Name: member?.familyName ?? "",
          },
        })
      } catch {
        sent = false
      }
      if (sent !== true) notice = "austritt-mail"
    }
  }
  revalidatePath("/mitglieder")
  revalidatePath("/statistik")
  redirect(memberRedirect(letter, notice))
}

export async function saveMailTemplate(formData) {
  const user = await boardActor()
  if (!canReadMembers(user)) redirect("/statistik")
  const id = String(formData.get("templateId") ?? "")
  if (!canEditMembers(user)) redirect(`/vorlagen?vorlage=${encodeURIComponent(id)}`)
  const subject = String(formData.get("subject") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200)
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").slice(0, 8000)
  if (!subject || !body.trim() || !(await updateMailTemplate(id, subject, body))) {
    redirect(`/vorlagen?vorlage=${encodeURIComponent(id)}&hinweis=vorlage`)
  }
  revalidatePath("/vorlagen")
  redirect(`/vorlagen?vorlage=${encodeURIComponent(id)}&hinweis=gespeichert`)
}

export async function sendAssemblyInvitation(_previous, formData) {
  const user = await boardActor()
  if (!canEditMembers(user)) redirect("/mitglieder")
  const mode = formData.get("mode") === "all" ? "all" : formData.get("mode") === "test" ? "test" : ""
  if (!mode) return { error: "Der Versand konnte nicht gestartet werden." }
  try {
    return await deliverInvitation({
      user,
      mode,
      subject: formData.get("subject"),
      body: formData.get("body"),
      agenda: readAgenda(formData.get("agenda")),
    })
  } catch {
    return { error: "Die Einladung konnte nicht gesendet werden." }
  }
}

export async function restoreMember(formData) {
  const user = await boardActor()
  const letter = String(formData.get("letter") ?? "")
  const id = Number(formData.get("memberId"))
  if (!canEditMembers(user) || !Number.isInteger(id) || id <= 0) redirect("/mitglieder")
  await restoreMemberRecord(id)
  revalidatePath("/mitglieder")
  revalidatePath("/statistik")
  redirect(memberRedirect(letter))
}

export async function logout() {
  const jar = await cookies()
  const sessionId = jar.get("sv_session")?.value
  if (sessionId) {
    await query(`DELETE FROM sessions WHERE id = $1`, [hashSecret(sessionId)])
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
  const user = await boardActor()
  if (!user?.is_treasurer) redirect("/?hinweis=schatzmeister")

  const id = applicationId(formData)
  if (!id) redirect("/?hinweis=antrag")
  const closed = String(formData.get("closed") ?? "") === "true"
  if (!closed) redirect("/?hinweis=versiegelt")

  const result = await withTransaction((q) => sealApplication(q, id, user))
  if (result.error) redirect(`/?hinweis=${result.error}`)
  revalidatePath("/")
}

export async function establishSession(token) {
  const opened = await createLoginSession(token)
  if (!opened) return { ok: false }
  const jar = await cookies()
  const secure = process.env.NODE_ENV === "production"
  jar.set("sv_session", opened.sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * opened.sessionDays,
  })
  if (!opened.join && opened.showTokenHint) {
    jar.set("sv_token_hint", "1", {
      httpOnly: false,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 120,
    })
  }
  return { ok: true }
}

export async function lookupMemberName(givenName, familyName) {
  const user = await getUser()
  if (!isJoinAccount(user)) return false
  return memberNameExists(givenName, familyName)
}

export async function lookupMemberEmail(email) {
  const user = await getUser()
  if (!isJoinAccount(user)) return false
  return memberEmailExists(email)
}

export async function lookupMemberIban(iban) {
  const user = await getUser()
  if (!isJoinAccount(user)) return false
  return memberIbanExists(iban)
}

export async function lookupBank(blz) {
  const user = await getUser()
  if (!isJoinAccount(user)) return null
  return findBankByBlz(blz)
}

export async function submitJoin(formData) {
  const user = await getUser()
  if (!isJoinAccount(user)) redirect("/")
  const result = await submitJoinRequest(user, formData)
  if (result?.ok) return { ok: true }
  return result
}

export async function confirmJoin(formData) {
  const token = String(formData.get("token") ?? "")
  const result = await confirmJoinRequest(token, String(formData.get("mandateHash") ?? ""))
  if (result?.ok) {
    const jar = await cookies()
    jar.set("sv_join_done", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    })
    revalidatePath("/mitglieder")
    revalidatePath("/statistik")
    redirect("/beitritt/bestaetigt")
  }
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) redirect("/beitritt/bestaetigt")
  const notice = result?.error === "neu" ? "neu" : "ungueltig"
  redirect(`/beitritt/bestaetigen/${token}?hinweis=${notice}`)
}

