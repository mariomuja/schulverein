import { Suspense } from "react"
import { cookies } from "next/headers"
import { logout } from "../app/actions"
import { canAdministerUsers, isJoinAccount } from "../lib/access"
import { getUser } from "../lib/auth"
import { accountLinks } from "../lib/account-links"
import TokenReminder from "./TokenReminder"
import UserAdmin from "./UserAdmin"

export default async function SiteHeader() {
  const user = await getUser()
  if (isJoinAccount(user)) {
    return (
      <header className="bg-white border-bottom">
        <div className="container-fluid px-3 py-2 py-md-3">
          <img className="logo" src="/logo.png" alt="Schulverein des Gymnasiums Heidberg" />
        </div>
      </header>
    )
  }
  const jar = await cookies()
  const showTokenHint = jar.get("sv_token_hint")?.value === "1"
  const accounts = user ? await accountLinks() : []
  const canAdminister = canAdministerUsers(user)
  const visibleAccounts = canAdminister
    ? accounts
    : accounts.filter((account) => account.id === user.id)

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
            <Suspense fallback={null}>
              <UserAdmin
                accounts={visibleAccounts}
                canAdminister={canAdminister}
                currentUserId={user.id}
              />
            </Suspense>
          </div>
        ) : null}
      </div>
      {showTokenHint ? <TokenReminder /> : null}
    </header>
  )
}
