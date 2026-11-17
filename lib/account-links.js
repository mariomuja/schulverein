import { headers } from "next/headers"
import { loadAccounts } from "./board"

export async function requestOrigin() {
  const headerStore = await headers()
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  const proto =
    headerStore.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

export async function accountLinks() {
  const accounts = await loadAccounts()
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    roleLabel: account.role_label,
    canWrite: account.can_write,
    hasVoted: account.has_voted,
    tokenActive: account.token_active,
  }))
}
