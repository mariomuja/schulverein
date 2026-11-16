import { headers } from "next/headers"
import Board from "../components/Board"
import { getUser } from "../lib/auth"
import { loadAccounts, loadBoard } from "../lib/board"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }) {
  const params = await searchParams
  const hinweis = Array.isArray(params.hinweis) ? params.hinweis[0] : params.hinweis
  const sort = params.sort === "asc" ? "asc" : "desc"
  const user = await getUser()

  if (!user) {
    return (
      <div className="alert alert-warning" role="status">
        Da stimmt etwas nicht... nutze für die Anmeldung den persönlichen Link,
        der dir zugesendet wurde.
      </div>
    )
  }

  const data = await loadBoard(sort)
  const accounts = user.can_write ? await accountLinks() : []
  return <Board user={user} data={data} accounts={accounts} hinweis={hinweis} sort={sort} />
}

async function accountLinks() {
  const headerStore = await headers()
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  const proto =
    headerStore.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https")
  const origin = `${proto}://${host}`
  const accounts = await loadAccounts()
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    roleLabel: account.role_label,
    canWrite: account.can_write,
    hasVoted: account.has_voted,
    loginUrl: `${origin}/${account.login_token}`,
  }))
}
