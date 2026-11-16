export function parseEuroToCents(raw) {
  let value = String(raw ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace("€", "")
  if (!value) return null
  if (value.includes(",") && value.includes(".")) {
    value = value.replace(/\./g, "").replace(",", ".")
  } else if (value.includes(",")) {
    value = value.replace(",", ".")
  }
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100)
}

export function formatEuro(cents) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatGermanDate(isoDate) {
  if (!isoDate) return ""
  const [year, month, day] = isoDate.split("-")
  return `${day}.${month}.${year}`
}
