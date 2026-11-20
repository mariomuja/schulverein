export function canEditMembers(user) {
  return String(user?.role_label ?? "").trim().toLocaleLowerCase("de") === "mitgliederverwaltung"
}

export function ensureAccess() {
  return Promise.resolve()
}
