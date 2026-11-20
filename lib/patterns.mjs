const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z]{2,})+$/
const bicPattern = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/

export function validEmail(value) {
  const email = String(value ?? "").trim()
  if (email.length < 6 || email.length > 240 || email.includes("..")) return false
  return emailPattern.test(email)
}

export function cleanBic(value) {
  return String(value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
}

export function validBic(value) {
  const bic = cleanBic(value)
  if (!bic) return false
  return bicPattern.test(bic)
}
