export function canEditMembers(user) {
  const name = String(user?.name ?? "").trim().toLowerCase()
  return name === "mario" || name === "mario muja" || name === "steffi"
}

export function ensureAccess() {
  return Promise.resolve()
}
