import { redirect } from "next/navigation"
import MembershipCharts from "../../components/MembershipCharts"
import SectionTabs from "../../components/SectionTabs"
import { getUser } from "../../lib/auth"
import { listMemberRecords } from "../../lib/members"
import { membershipStats } from "../../lib/membership-stats"
import { givenName } from "../../lib/names"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Statistik · Schulverein Gymnasium Heidberg",
}

function roleLine(user) {
  const parts = []
  if (user.role_label) parts.push(user.role_label)
  parts.push(user.can_write ? "Förderanträge Schreibrecht" : "Förderanträge Leserecht")
  return parts.join(" · ")
}

export default async function StatisticsPage() {
  const user = await getUser()
  if (!user) redirect("/")
  const records = await listMemberRecords()
  const stats = membershipStats(records.map((member) => member.joinedOn))

  return (
    <>
      <SectionTabs active="statistik" />
      <div className="d-flex justify-content-end mb-3">
        <p className="mb-0 text-secondary">
          {givenName(user.name)}
          <span className="d-none d-md-inline"> · </span>
          <span className="d-block d-md-inline">{roleLine(user)}</span>
        </p>
      </div>
      <div className="table-responsive mb-3">
        <table className="table table-sm table-striped bg-white mb-0">
          <caption className="caption-top text-body">Neue Mitglieder nach Zeitraum</caption>
          <thead>
            <tr>
              <th>Zeitraum</th>
              <th>Eintritte</th>
            </tr>
          </thead>
          <tbody>
            {stats.periods.map((period) => (
              <tr key={period.label}>
                <td>{period.label}</td>
                <td>{period.added}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-responsive mb-4">
        <table className="table table-sm table-striped bg-white mb-2">
          <caption className="caption-top text-body">Mitgliederentwicklung nach Eintrittsjahr</caption>
          <thead>
            <tr>
              <th>Jahr</th>
              <th>Neue Mitglieder</th>
              <th>Bestand zum Jahresende</th>
            </tr>
          </thead>
          <tbody>
            {stats.years.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td>{row.added}</td>
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
