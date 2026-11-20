export function currentYear(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en", { timeZone: "Europe/Berlin", year: "numeric" }).format(date),
  )
}

function datedYear(value) {
  const text = String(value ?? "")
  const entryYear = Number(text.slice(0, 4))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || entryYear < 1990) return null
  return entryYear
}

export function membershipStats(events, year = currentYear()) {
  const entries = new Map()
  const exits = new Map()
  const stockExits = new Map()
  let undated = 0
  for (const event of events) {
    const entryYear = datedYear(event.joinedOn)
    const exitYear = datedYear(event.leftOn)
    if (entryYear == null) undated += 1
    else entries.set(entryYear, (entries.get(entryYear) ?? 0) + 1)
    if (exitYear == null) continue
    exits.set(exitYear, (exits.get(exitYear) ?? 0) + 1)
    if (entryYear != null && exitYear >= entryYear) {
      stockExits.set(exitYear, (stockExits.get(exitYear) ?? 0) + 1)
    }
  }
  const knownYears = [...entries.keys(), ...exits.keys()]
  const first = knownYears.length ? Math.min(...knownYears) : year
  const last = Math.max(year, ...(knownYears.length ? knownYears : [year]))
  const years = []
  let stock = 0
  for (let entryYear = first; entryYear <= last; entryYear += 1) {
    const added = entries.get(entryYear) ?? 0
    const left = exits.get(entryYear) ?? 0
    stock += added - (stockExits.get(entryYear) ?? 0)
    years.push({ year: entryYear, added, left, stock })
  }
  const sum = (field, start) =>
    years.filter((row) => row.year >= start && row.year <= year).reduce((total, row) => total + row[field], 0)
  return {
    years,
    undated,
    periods: [
      { label: String(year), added: sum("added", year), left: sum("left", year) },
      { label: `${year - 4}–${year}`, added: sum("added", year - 4), left: sum("left", year - 4) },
      { label: `${year - 9}–${year}`, added: sum("added", year - 9), left: sum("left", year - 9) },
      {
        label: "Seit Beginn",
        added: years.reduce((total, row) => total + row.added, 0),
        left: years.reduce((total, row) => total + row.left, 0),
      },
    ],
  }
}
