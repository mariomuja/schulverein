import { redirect } from "next/navigation"
import JoinForm from "../../components/JoinForm"
import { isJoinAccount } from "../../lib/access"
import { getUser } from "../../lib/auth"
import { issueJoinForm } from "../../lib/join"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Mitglied werden · Schulverein Gymnasium Heidberg",
}

const sentText =
  "Wir haben eine E-Mail an die angegebene Adresse geschickt. Öffne den Link darin. Dort bestätigst du die Adresse und das Lastschriftmandat und siehst deine Rechte. Der Link gilt 48 Stunden. Schau auch im Spam-Ordner nach."

export default async function JoinPage({ searchParams }) {
  const user = await getUser()
  if (!isJoinAccount(user)) redirect("/")
  const params = await searchParams
  const hint = Array.isArray(params.hinweis) ? params.hinweis[0] : params.hinweis
  const sent = hint === "gesendet"
  const ticket = sent ? null : await issueJoinForm()

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-8 col-xl-7">
        <h1 className="h4 mb-3">Ich möchte Mitglied im Schulverein des Gymnasiums Heidberg e.V. werden.</h1>
        <p>
          Fülle das Formular aus. Danach schicken wir eine E-Mail an die angegebene Adresse. Erst der
          Link in dieser E-Mail bestätigt die Adresse und das Lastschriftmandat.
        </p>
        {sent ? (
          <div className="alert alert-success" role="status">
            {sentText}
          </div>
        ) : null}
        {!sent && ticket?.limited ? (
          <div className="alert alert-warning" role="alert">
            Es wurden zu viele Anfragen gesendet. Bitte versuche es später erneut.
          </div>
        ) : null}
        {!sent && ticket && !ticket.limited ? (
          <>
            <noscript>
              <div className="alert alert-warning" role="alert">
                Bitte JavaScript aktivieren, damit das Formular gesendet werden kann.
              </div>
            </noscript>
            <JoinForm ticket={ticket} />
          </>
        ) : null}
      </div>
    </div>
  )
}
