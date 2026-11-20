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

const legalBasis = [
  "§ 675j Abs. 1 BGB: Eine Zahlung ist nur wirksam, wenn der Zahler zugestimmt hat.",
  "§ 675f Abs. 3 Satz 2 BGB: Diese Zustimmung kann gegenüber der eigenen Bank oder gegenüber dem Zahlungsempfänger erklärt werden. Beim SEPA-Lastschriftverfahren wird sie dem Verein erteilt. Der Verein gibt den Einzug danach an seine Bank weiter.",
  "Artikel 5 der Verordnung (EU) Nr. 260/2012: Der Zahler muss dem Zahlungsempfänger die Erlaubnis zur Abbuchung erteilen. Der Verein bewahrt das Mandat auf, solange es gebraucht wird, und danach noch so lange, wie Rückgaben möglich sind.",
]

export async function JoinScreen({ searchParams }) {
  const params = await searchParams
  const hint = Array.isArray(params.hinweis) ? params.hinweis[0] : params.hinweis
  const sent = hint === "gesendet"
  const ticket = sent ? null : await issueJoinForm()

  const showForm = !sent && ticket && !ticket.limited

  return (
    <>
      <h1 className="h4 mb-3">Ich möchte Mitglied im Schulverein des Gymnasiums Heidberg e.V. werden.</h1>
      <p>
        Fülle das Formular aus. Danach schicken wir eine E-Mail an die angegebene Adresse. Mit dem
        Link in der Mail bestätigst du deine Mail-Adresse und erlaubst uns, den Mitgliedsbetrag vom
        angegebenen Konto einzuziehen.
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
      {showForm ? (
        <div className="row g-4 align-items-start">
          <div className="col-12 col-xl-7">
            <noscript>
              <div className="alert alert-warning" role="alert">
                Bitte JavaScript aktivieren, damit das Formular gesendet werden kann.
              </div>
            </noscript>
            <JoinForm ticket={ticket} />
          </div>
          <div className="col-12 col-xl-5">
            <aside className="alert alert-warning mb-0" role="note">
              <h2 className="alert-heading h6">Rechtliche Grundlagen</h2>
              {legalBasis.map((text, index) => (
                <p className={index === legalBasis.length - 1 ? "mb-0" : "mb-2"} key={text}>
                  {text}
                </p>
              ))}
            </aside>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default async function JoinPage({ searchParams }) {
  const user = await getUser()
  if (!isJoinAccount(user)) redirect("/")
  return <JoinScreen searchParams={searchParams} />
}
