import { logout } from "../app/actions"
import { getUser } from "../lib/auth"

export default async function SiteHeader() {
  const user = await getUser()

  return (
    <header className="bg-white border-bottom">
      <div className="container-fluid px-3 py-2 py-md-3 d-flex align-items-center justify-content-between gap-3">
        <img
          className="logo"
          src="/logo.png"
          alt="Schulverein des Gymnasiums Heidberg"
        />
        {user ? (
          <form action={logout}>
            <button className="btn btn-outline-secondary logout-btn" type="submit">
              Abmelden
            </button>
          </form>
        ) : null}
      </div>
    </header>
  )
}
