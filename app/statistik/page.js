import { redirect } from "next/navigation"
import MembershipCharts from "../../components/MembershipCharts"
import SectionTabs from "../../components/SectionTabs"
import { boardUser } from "../../lib/auth"
import { listMembershipEvents } from "../../lib/members"
import { membershipStats } from "../../lib/membership-stats"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Statistik · Schulverein Gymnasium Heidberg",
}

export default async function StatisticsPage() {
  const user = await boardUser()
  if (!user) redirect("/")
  const stats = membershipStats(await listMembershipEvents())

  return (
    <>
      <SectionTabs active="statistik" />
      <div className="table-responsive mb-3">
        <table className="table table-sm table-striped bg-white mb-0">
          <caption className="caption-top text-body">Eintritte und Austritte nach Zeitraum</caption>
          <thead>
            <tr>
              <th>Zeitraum</th>
              <th>Eintritte</th>
              <th>Austritte</th>
            </tr>
          </thead>
          <tbody>
            {stats.periods.map((period) => (
              <tr key={period.label}>
                <td>{period.label}</td>
                <td>{period.added}</td>
                <td>{period.left}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-responsive mb-4">
        <table className="table table-sm table-striped bg-white mb-2">
          <caption className="caption-top text-body">Mitgliederentwicklung nach Jahr</caption>
          <thead>
            <tr>
              <th>Jahr</th>
              <th>Neue Mitglieder</th>
              <th>Austritte</th>
              <th>Bestand zum Jahresende</th>
            </tr>
          </thead>
          <tbody>
            {stats.years.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td>{row.added}</td>
                <td>{row.left}</td>
                <td>{row.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {stats.undated ? (
          <p className="small text-secondary mb-0">
            {stats.undated} {stats.undated === 1 ? "Mitglied hat" : "Mitglieder haben"} kein verwendbares Eintrittsdatum und {stats.undated === 1 ? "ist" : "sind"} in der Entwicklung nicht enthalten.
          </p>
        ) : null}
      </div>
      <MembershipCharts years={stats.years} />
    </>
  )
}
