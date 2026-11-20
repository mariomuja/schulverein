import { redirect } from "next/navigation"
import MailTemplates from "../../components/MailTemplates"
import SectionTabs from "../../components/SectionTabs"
import { canEditMembers, canReadMembers } from "../../lib/access"
import { boardUser } from "../../lib/auth"
import { listMailTemplates } from "../../lib/outgoing-mail"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "eMail Vorlagen · Schulverein Gymnasium Heidberg",
}

export default async function MailTemplatesPage({ searchParams }) {
  const user = await boardUser()
  if (!user) redirect("/")
  if (!canReadMembers(user)) redirect("/statistik")
  const params = await searchParams
  const hinweis = Array.isArray(params.hinweis) ? params.hinweis[0] : params.hinweis
  const requested = Array.isArray(params.vorlage) ? params.vorlage[0] : params.vorlage
  const templates = await listMailTemplates()
  const initialId = templates.some((template) => template.id === requested) ? requested : templates[0]?.id

  return (
    <>
      <SectionTabs active="vorlagen" />
      {hinweis === "gespeichert" ? (
        <div className="alert alert-success" role="status">
          Die Vorlage ist gespeichert.
        </div>
      ) : null}
      {hinweis === "vorlage" ? (
        <div className="alert alert-warning" role="status">
          Betreff und Text werden zum Speichern benötigt.
        </div>
      ) : null}
      <MailTemplates
        templates={templates.map((template) => ({
          id: template.id,
          name: template.name,
          subject: template.subject,
          body: template.body,
        }))}
        canEdit={canEditMembers(user)}
        initialId={initialId ?? ""}
      />
    </>
  )
}
