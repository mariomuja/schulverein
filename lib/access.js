function membersAccess(user) {
  const access = String(user?.members_access ?? "")
  return access === "read" || access === "write" ? access : "none"
}

export function canEditMembers(user) {
  return membersAccess(user) === "write"
}

export function canReadMembers(user) {
  const access = membersAccess(user)
  return access === "read" || access === "write"
}

export function canWritePots(user) {
  return user?.pots_access === "write" && !isJoinAccount(user)
}

export function canAdministerUsers(user) {
  const role = String(user?.role_label ?? "").trim().toLocaleLowerCase("de")
  return role.includes("vorsitz")
}

export function isJoinAccount(user) {
  return user?.join_link === true
}

export function ensureAccess() {
  return Promise.resolve()
}
