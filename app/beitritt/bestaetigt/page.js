import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Mitgliedschaft bestätigt · Schulverein Gymnasium Heidberg",
}

export default async function JoinDonePage() {
  const jar = await cookies()
  const done = jar.get("sv_join_done")?.value === "1"

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-8 col-xl-7">
        <h1 className="h4 mb-3">Mitgliedschaft</h1>
        {done ? (
          <div className="alert alert-success" role="status">
            Die E-Mail-Adresse ist bestätigt. Die Mitgliedschaft ist eingetragen und das
            Lastschriftmandat ist erteilt. Der Verein kündigt den Einzug vor der Abbuchung an. Eine
            berechtigte Basislastschrift kannst du innerhalb von acht Wochen nach der Belastung ohne
            Begründung zurückgeben.
          </div>
        ) : (
          <div className="alert alert-warning" role="alert">
            Es liegt keine offene Bestätigung vor.
          </div>
        )}
      </div>
    </div>
  )
}
