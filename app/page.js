import Board from "../components/Board"
import { boardUser } from "../lib/auth"
import { loadBoard } from "../lib/board"
import { cleanFilter } from "../lib/list-query"

export const dynamic = "force-dynamic"

export async function HomeScreen({ searchParams }) {
  const params = await searchParams
  const hinweis = Array.isArray(params.hinweis) ? params.hinweis[0] : params.hinweis
  const sort = params.sort === "asc" ? "asc" : "desc"
  const filter = cleanFilter(Array.isArray(params.filter) ? params.filter[0] : params.filter)
  const edit = Number(Array.isArray(params.edit) ? params.edit[0] : params.edit)
  const editId = Number.isInteger(edit) && edit > 0 ? edit : null
  const user = await boardUser()

  if (!user) {
    return (
      <div className="alert alert-warning" role="status">
        Da stimmt etwas nicht... nutze für die Anmeldung den persönlichen Link,
        der dir zugesendet wurde.
      </div>
    )
  }

  const data = await loadBoard(sort)
  return <Board user={user} data={data} hinweis={hinweis} sort={sort} filter={filter} editId={editId} />
}

export default function Page({ searchParams }) {
  return <HomeScreen searchParams={searchParams} />
}
