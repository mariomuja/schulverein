export function validGermanIban(value) {
  const iban = String(value ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
  if (!/^DE\d{20}$/.test(iban)) return false
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`
  let remainder = 0
  for (const char of rearranged) {
    const digits = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

export function germanIbanParts(value) {
  const iban = cleanIban(value)
  if (!validGermanIban(iban)) return null
  return {
    country: iban.slice(0, 2),
    bankCode: iban.slice(4, 12),
  }
}

export function cleanIban(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
}

export function maskIban(value) {
  const iban = cleanIban(value)
  if (iban.length < 8) return ""
  return `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`
}
