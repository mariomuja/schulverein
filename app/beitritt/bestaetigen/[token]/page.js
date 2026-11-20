import { redirect } from "next/navigation"
import ConfirmJoinButton from "../../../../components/ConfirmJoinButton"
import { confirmJoin } from "../../../actions"
import { mandateHash, readJoinRequest } from "../../../../lib/join"
import { formatEuro } from "../../../../lib/money"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Mandat bestätigen · Schulverein Gymnasium Heidberg",
}

export default async function ConfirmJoinPage({ params, searchParams }) {
  const { token } = await params
  const query = await searchParams
  const hint = Array.isArray(query.hinweis) ? query.hinweis[0] : query.hinweis
  const request = await readJoinRequest(token)
  if (!request) {
    return (
      <div className="row justify-content-center">
        <div className="col-12 col-lg-8 col-xl-7">
          <h1 className="h4">Bestätigung</h1>
          <div className="alert alert-warning" role="alert">
            Dieser Bestätigungslink ist nicht gültig oder abgelaufen.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-8 col-xl-7">
        <h1 className="h4 mb-3">E-Mail-Adresse und Lastschriftmandat bestätigen</h1>
        <p>
          Mit dem Button bestätigst du die E-Mail-Adresse und das Lastschriftmandat. Erst damit wird
          die Mitgliedschaft eingetragen.
        </p>
        {hint === "neu" ? (
          <div className="alert alert-warning" role="alert">
            Der Mandatstext wurde aktualisiert. Bitte lies ihn und bestätige erneut.
          </div>
        ) : null}
        {hint === "ungueltig" ? (
          <div className="alert alert-warning" role="alert">
            Die Bestätigung konnte nicht gespeichert werden. Bitte den Link erneut öffnen.
          </div>
        ) : null}
        <dl className="row mb-3">
          <dt className="col-sm-4">Name</dt>
          <dd className="col-sm-8">{request.givenName} {request.familyName}</dd>
          <dt className="col-sm-4">E-Mail-Adresse</dt>
          <dd className="col-sm-8 text-break">{request.email}</dd>
          <dt className="col-sm-4">Beitrag</dt>
          <dd className="col-sm-8">{formatEuro(request.contributionCents)} € pro Schuljahr</dd>
          <dt className="col-sm-4">Kontoinhaber</dt>
          <dd className="col-sm-8">{request.accountHolder}</dd>
          <dt className="col-sm-4">IBAN</dt>
          <dd className="col-sm-8">{request.ibanMasked}</dd>
        </dl>
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <h2 className="h5">Lastschriftmandat</h2>
            {request.mandate.split("\n\n").map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>
        </div>
        <form action={confirmJoin}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="mandateHash" value={mandateHash(request.mandate)} />
          <ConfirmJoinButton />
        </form>
      </div>
    </div>
  )
}
