export function currentYear(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en", { timeZone: "Europe/Berlin", year: "numeric" }).format(date),
  )
}

export function membershipStats(dates, year = currentYear()) {
  const counts = new Map()
  let undated = 0
  for (const value of dates) {
    const text = String(value ?? "")
    const entryYear = Number(text.slice(0, 4))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || entryYear < 1990) {
      undated += 1
      continue
    }
    counts.set(entryYear, (counts.get(entryYear) ?? 0) + 1)
  }
  const first = counts.size ? Math.min(...counts.keys()) : year
  const last = Math.max(year, ...(counts.size ? counts.keys() : [year]))
  const years = []
  let stock = 0
  for (let entryYear = first; entryYear <= last; entryYear += 1) {
    const added = counts.get(entryYear) ?? 0
    stock += added
    years.push({ year: entryYear, added, stock })
  }
  const sumFrom = (start) =>
    years.filter((row) => row.year >= start && row.year <= year).reduce((total, row) => total + row.added, 0)
  return {
    years,
    undated,
    periods: [
      { label: String(year), added: sumFrom(year) },
      { label: `${year - 4}–${year}`, added: sumFrom(year - 4) },
      { label: `${year - 9}–${year}`, added: sumFrom(year - 9) },
      { label: "Seit Beginn", added: years.reduce((total, row) => total + row.added, 0) },
    ],
  }
}
