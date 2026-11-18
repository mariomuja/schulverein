import { Suspense } from "react"
import { logout } from "../app/actions"
import { getUser } from "../lib/auth"
import { accountLinks } from "../lib/account-links"
import UserAdmin from "./UserAdmin"

export default async function SiteHeader() {
  const user = await getUser()
  const accounts = user?.can_write ? await accountLinks() : []

  return (
    <header className="bg-white border-bottom">
      <div className="container-fluid px-3 py-2 py-md-3 d-flex align-items-center justify-content-between gap-3">
        <img
          className="logo"
          src="/logo.png"
          alt="Schulverein des Gymnasiums Heidberg"
        />
        {user ? (
          <div className="d-flex align-items-center gap-2">
            <form action={logout}>
              <button className="btn btn-outline-secondary logout-btn" type="submit">
                Abmelden
              </button>
            </form>
            {user.can_write ? (
              <Suspense fallback={null}>
                <UserAdmin accounts={accounts} canManage={user.can_write} />
              </Suspense>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}
