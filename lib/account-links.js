import { headers } from "next/headers"
import { loadAccounts } from "./board"

export async function accountLinks() {
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
