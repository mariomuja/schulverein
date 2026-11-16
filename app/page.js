import Board from "../components/Board"
import { getUser } from "../lib/auth"
import { loadBoard } from "../lib/board"

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
  return <Board user={user} data={data} hinweis={hinweis} sort={sort} />
}
