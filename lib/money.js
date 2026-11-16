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
  const [year, month, day] = String(isoDate).split("T")[0].split("-")
  return `${day}.${month}.${year}`
}

export function formatGermanDateTime(value) {
  if (!value) return ""
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
