export function givenName(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length < 2) return parts.join(" ")
  return parts.slice(0, -1).join(" ")
}
