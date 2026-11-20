export function canEditMembers(user) {
  return String(user?.role_label ?? "").trim().toLocaleLowerCase("de") === "mitgliederverwaltung"
}

export function canReadMembers(user) {
  if (canEditMembers(user)) return true
  const access = String(user?.members_access ?? "")
  return access === "read" || access === "write"
}

export function ensureAccess() {
  return Promise.resolve()
}
