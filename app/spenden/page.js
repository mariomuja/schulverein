import PotDialogs from "../../components/PotDialogs"
import PotSelect from "../../components/PotSelect"
import SectionTabs from "../../components/SectionTabs"
import { canWritePots } from "../../lib/access"
import { boardUser } from "../../lib/auth"
import { listPotEntries, listPots } from "../../lib/pots"
import { formatEuro, formatGermanDateTime } from "../../lib/money"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Spendentöpfe · Schulverein Gymnasium Heidberg",
}

const hints = {
  recht: "Dafür fehlt die Berechtigung.",
  name: "Der Spendentopf konnte nicht angelegt werden. Der Name fehlt oder ist schon vergeben.",
  spende: "Die Spende konnte nicht gebucht werden. Bitte Betrag und Verwendungszweck prüfen.",
}

export default async function PotsPage({ searchParams }) {
  const user = await boardUser()
  if (!user) {
    return (
      <div className="alert alert-warning" role="status">
        Da stimmt etwas nicht... nutze für die Anmeldung den persönlichen Link, der dir zugesendet wurde.
      </div>
    )
  }

  const params = await searchParams
  const hinweis = Array.isArray(params.hinweis) ? params.hinweis[0] : params.hinweis
  const requested = Number(Array.isArray(params.topf) ? params.topf[0] : params.topf)
  const pots = await listPots()
  const selected = pots.find((pot) => pot.id === requested) ?? null
  const entries = selected ? await listPotEntries(selected.id) : []
  const writer = canWritePots(user)

  return (
    <>
      <SectionTabs active="spenden" />
      {hints[hinweis] ? (
        <div className="alert alert-warning" role="status">
          {hints[hinweis]}
        </div>
      ) : null}
      <div className="row g-2 align-items-center mb-3">
        <div className="col-12 col-sm-6 col-lg-4">
          <PotSelect pots={pots} selectedId={selected?.id ?? null} />
        </div>
        {writer ? (
          <div className="col-auto d-flex flex-wrap gap-2">
            <PotDialogs potId={selected?.id ?? null} openName={hinweis === "name"} openDonation={hinweis === "spende"} />
          </div>
        ) : null}
      </div>
      {selected ? (
        <>
          <div className="d-flex justify-content-between align-items-start gap-3 d-xl-none mb-3">
            <div className="fw-semibold">{selected.name}</div>
            <div className="text-end">
              <div className="small text-secondary">Betrag</div>
              <div className="fs-5 fw-semibold text-nowrap">{formatEuro(selected.balance_cents)} €</div>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-striped bg-white mb-0">
              <caption className="caption-top text-body">{selected.name}</caption>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Bewegung</th>
                  <th>Verwendungszweck</th>
                  <th className="text-end">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-secondary">
                      Noch keine Buchung.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="text-nowrap">{formatGermanDateTime(entry.created_at)}</td>
                      <td>{entry.direction === "in" ? "Zugang" : "Abgang"}</td>
                      <td>{entry.purpose}</td>
                      <td className="text-end text-nowrap">
                        {entry.direction === "in" ? "+" : "−"} {formatEuro(entry.amount_cents)} €
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="d-none d-xl-table-row-group">
                <tr>
                  <th colSpan={3}>Bestand</th>
                  <th className="text-end text-nowrap">{formatEuro(selected.balance_cents)} €</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
