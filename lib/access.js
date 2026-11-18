export function membersAccess(user) {
  const value = String(user?.members_access ?? "none")
  if (value === "read" || value === "write") return value
  return "none"
}

export function canSeeMembers(user) {
  return membersAccess(user) !== "none"
}

export function canWriteMembers(user) {
  return membersAccess(user) === "write"
}

export function ensureAccess() {
  return Promise.resolve()
}
