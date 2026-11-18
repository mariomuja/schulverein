const personPattern =
  /([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\-]{1,})\s*,\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\-]{1,})/g

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

function personsIn(line) {
  const found = []
  for (const match of line.matchAll(personPattern)) {
    const familyName = clean(match[1])
    const givenName = clean(match[2])
    const label = /^(name|vorname|stra(?:ß|ss)e|hausnummer|plz|ort|datum|e-mail|email|iban|klasse|bank|kontoinhaber(?:in)?)$/i
    if (label.test(familyName) || label.test(givenName)) continue
    found.push({ familyName, givenName })
  }
  return found
}

function splitStreet(line) {
  const text = clean(line)
    .replace(/^stra(?:ß|ss)e(?:\s*,\s*hausnummer)?\s*/i, "")
    .replace(/^hausnummer\s*/i, "")
  const match = text.match(/^(.*?)[,\s]+(\d+\s*[A-Za-z]?)$/)
  if (!match) return { street: text, houseNumber: "" }
  return { street: clean(match[1]), houseNumber: clean(match[2]) }
}

function readContribution(text) {
  const compact = text
    .replace(/\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b/g, " ")
    .replace(/\s+/g, " ")
  const amounts = [...compact.matchAll(/(\d{1,4})[.,](\d{2})/g)].map((match) => ({
    cents: Number(match[1]) * 100 + Number(match[2]),
    index: match.index,
  }))
  const individual = compact.match(/oder\s*(\d{1,4})(?:[.,](\d{2}))?(?!\d)/i)
  if (individual) {
    const cents = Number(individual[1]) * 100 + Number(individual[2] ?? 0)
    if (cents >= 100 && cents !== 2200 && cents !== 2500) return cents
  }
  const custom = amounts.find((amount) => amount.cents !== 2200 && amount.cents !== 2500 && amount.cents >= 100)
  if (custom) return custom.cents
  const options = [
    { cents: 2200, index: compact.search(/22[,.]00/) },
    { cents: 2500, index: compact.search(/25[,.]00/) },
  ].filter((item) => item.index >= 0)
  let chosen = null
  for (const mark of compact.matchAll(/(?:^|\s)[xX×✓✔](?=\s|$)/g)) {
    const following = options.find((item) => item.index > mark.index)
    if (following) chosen = following.cents
  }
  return chosen
}

function readDate(text) {
  const match = text.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b/)
  if (!match) return ""
  const day = match[1].padStart(2, "0")
  const month = match[2].padStart(2, "0")
  const year = match[3].length === 2 ? `20${match[3]}` : match[3]
  const iso = `${year}-${month}-${day}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return ""
  return iso
}

function lineAfter(lines, pattern) {
  const index = lines.findIndex((line) => pattern.test(line))
  if (index < 0) return ""
  const same = clean(lines[index].replace(pattern, " "))
  if (same.length > 2) return same
  return lines[index + 1] ?? ""
}

export function readMembership(text) {
  const source = String(text ?? "").replace(/\u00a0/g, " ")
  const lines = source
    .split(/\n+/)
    .map((line) => clean(line))
    .filter(Boolean)
  const flat = lines.join("\n")
  const email = flat.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ?? ""
  const iban = flat.replace(/[^A-Za-z0-9]/g, "").match(/DE\d{20}/i)?.[0]?.toUpperCase() ?? ""
  const postalLine =
    lines.find((line) => /\b\d{5}\s+[A-Za-zÄÖÜäöüß]/.test(line)) ??
    lines.find((line) => /\b\d{5}\b/.test(line)) ??
    ""
  const postalCode = postalLine.match(/\b(\d{5})\b/)?.[1] ?? ""
  const city = postalCode
    ? clean(postalLine.replace(/^.*?\d{5}/, "").replace(/^[,:\s]+/, ""))
    : ""
  const postalIndex = lines.indexOf(postalLine)
  const streetLine = postalIndex > 0 ? lines[postalIndex - 1] : ""
  const streetParts = splitStreet(streetLine)
  const sectionEnds = [
    lines.findIndex((line) => /^(?:kind\s*\/\s*kinder|kind(?:er)?(?:\s+am\b|\s*\/))/i.test(line)),
    lines.findIndex((line) => /\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}/.test(line)),
    lines.findIndex((line) => /sepa|name der bank|kontoinhaber/i.test(line)),
  ].filter((index) => index >= 0)
  const applicantEnd = sectionEnds.length ? Math.min(...sectionEnds) : lines.length
  const applicants = lines.slice(0, applicantEnd).flatMap(personsIn)
  const member = applicants[0] ?? { familyName: "", givenName: "" }
  const furtherNames = applicants
    .slice(1)
    .map((person) => `${person.givenName} ${person.familyName}`)
    .join(", ")
  const bankLine = lineAfter(lines, /name der bank\s*:?\s*/i) || lineAfter(lines, /\bbank\s*:?\s*/i)
  const holderLine = lineAfter(lines, /kontoinhaber(?:in)?\s*:?\s*/i)
  const holderPeople = personsIn(holderLine)
  const accountHolder = holderPeople[0]
    ? `${holderPeople[0].givenName} ${holderPeople[0].familyName}`
    : clean(holderLine).replace(/^kontoinhaber(?:in)?\s*:?\s*/i, "")
  const dateLine = lines.find((line) => /\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}/.test(line)) ?? ""
  const signedOn = readDate(dateLine)
  const signedPlace = clean(
    dateLine.replace(/\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}.*$/, "").replace(/[,:\s]+$/, ""),
  ).replace(/^(?:(?:ort|datum|unterschrift)[,\s]*)+/i, "")

  return {
    familyName: member.familyName,
    givenName: member.givenName,
    street: streetParts.street,
    houseNumber: streetParts.houseNumber,
    postalCode,
    city,
    email,
    contributionCents: readContribution(flat),
    signedPlace,
    signedOn,
    furtherNames,
    bankName: clean(bankLine).replace(/^name der bank\s*:?\s*/i, ""),
    iban,
    accountHolder,
  }
}
