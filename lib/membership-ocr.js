function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

function isLabelWord(value) {
  return /^(name|vorname|stra(?:ß|ss)e|hausnummer|plz|ort|datum|e-mail|email|iban|klasse|bank|bic|telefon|kontoinhaber(?:in)?)$/i.test(
    value,
  )
}

function withoutFooter(lines) {
  const cut = lines.findIndex((line) =>
    /bankverbindung|fritz-schumacher|d-22417|kontakt\s*:/i.test(line),
  )
  return cut < 0 ? lines : lines.slice(0, cut)
}

function beforeChildren(lines) {
  const cut = lines.findIndex((line) =>
    /^(?:kind\s*\/\s*kinder|kind(?:er)?(?:\s+am\b|\s*\/))/i.test(line),
  )
  return cut < 0 ? lines : lines.slice(0, cut)
}

function isFieldLabel(line) {
  return /stra(?:ß|ss)|hausnummer|plz\s*[,.]?\s*ort|e-?mail|telefon|beitrag|kind\/|sepa|name der bank|^iban\b|kontoinhaber/i.test(
    line,
  )
}

function stripLabel(line, pattern) {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  )
  return clean(line.replace(global, " ")).replace(/^[:.;,\-\s\[\]]+/, "")
}

function valueAfter(lines, pattern, accept) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!pattern.test(lines[index])) continue
    const same = stripLabel(lines[index], pattern)
    if (accept(same)) return same
    for (let look = index + 1; look < Math.min(lines.length, index + 8); look += 1) {
      if (isFieldLabel(lines[look])) break
      const candidate = stripLabel(lines[look], pattern)
      if (accept(candidate)) return candidate
    }
  }
  return ""
}

function memberName(value) {
  const text = clean(value).replace(/^[:.;,\-\s]+/, "")
  const comma = text.match(
    /^([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\-]{1,})\s*,\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\-]{1,})/,
  )
  if (comma && !isLabelWord(comma[1]) && !isLabelWord(comma[2])) {
    return { familyName: comma[1], givenName: comma[2] }
  }
  const words = text
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 3 &&
        /^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\-]{1,}$/.test(word) &&
        !isLabelWord(word),
    )
  if (words.length >= 2) return { familyName: words[0], givenName: words[1] }
  return { familyName: "", givenName: "" }
}

function splitStreet(value) {
  const text = clean(value).replace(/^[:.;,\-\s]+/, "")
  const match = text.match(/^(.*?)[,\s]+(\d+\s*[A-Za-z]?)$/)
  if (!match) return { street: text, houseNumber: "" }
  return { street: clean(match[1]), houseNumber: clean(match[2]) }
}

function readPlace(value) {
  const text = clean(value)
  const spaced = text.match(/(\d{2})\s(\d{3})(?!\d)/)
  const tight = text.match(/\b(\d{5})\b/)
  let postalCode = ""
  let rest = text
  if (spaced) {
    postalCode = `${spaced[1]}${spaced[2]}`
    rest = text.slice(spaced.index + spaced[0].length)
  } else if (tight) {
    postalCode = tight[1]
    rest = text.slice(tight.index + tight[0].length)
  }
  const city =
    clean(rest)
      .replace(/^[,:\s]+/, "")
      .split(/\s+/)
      .find((word) => /[A-Za-zÄÖÜäöüß]{3,}/.test(word) && !isLabelWord(word)) ?? ""
  return { postalCode, city }
}

function readEmail(text) {
  const compact = String(text ?? "")
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".")
  const match = compact.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
  if (!match || /schulverein@/i.test(match[0])) return ""
  return match[0].toLowerCase()
}

function readIban(lines) {
  const nearLabel = []
  lines.forEach((line, index) => {
    if (/iban/i.test(line) && !/bankverbindung/i.test(line)) {
      nearLabel.push(line, lines[index + 1] ?? "")
    }
  })
  const labelled = nearLabel.join("").replace(/[^A-Za-z0-9]/g, "").toUpperCase().match(/DE\d{20}/)?.[0]
  if (labelled) return labelled
  const body = lines.filter((line) => !/bankverbindung/i.test(line)).join(" ")
  return body.replace(/[^A-Za-z0-9]/g, "").toUpperCase().match(/DE\d{20}/)?.[0] ?? ""
}

function readContribution(text) {
  const compact = String(text ?? "")
    .replace(/\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b/g, " ")
    .replace(/\s+/g, " ")
  const individual = compact.match(/oder\s*[:.]?\s*(\d{1,4})(?:[.,](\d{2}))?(?!\d)/i)
  if (individual) {
    const cents = Number(individual[1]) * 100 + Number(individual[2] ?? 0)
    if (cents >= 1000 && cents !== 2200 && cents !== 2500) return cents
  }
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

function cleanBank(value) {
  return clean(value)
    .replace(/^[:.;,\-\s]+/, "")
    .replace(/^(?:[A-Za-zÄÖÜäöüß]{1,3}\s*[:.]?\s+)+/, "")
    .replace(/\b(?:bic|iban)\b.*$/i, "")
    .replace(/\s+[A-Za-zÄÖÜäöüß]$/, "")
    .trim()
}

function cleanHolder(value) {
  return clean(value)
    .replace(/^[:.;,\-\s]+/, "")
    .replace(/\b(?:ort|datum|unterschrift)\b.*$/i, "")
    .replace(/\(.*$/, "")
    .trim()
}

export function readHandwritingFields(parts) {
  const nameText = String(parts.name ?? "").replace(/[^A-Za-zÄÖÜäöüß,\-\s]/g, " ")
  const name = memberName(nameText)
  const streetText = String(parts.street ?? "")
  const street = /[A-Za-zÄÖÜäöüß]{5,}/.test(streetText) ? splitStreet(streetText) : { street: "", houseNumber: "" }
  const place = readPlace(parts.place ?? "")
  const bankName = cleanBank(parts.bank ?? "")
  return {
    familyName: name.familyName,
    givenName: name.givenName,
    street: street.street,
    houseNumber: street.houseNumber,
    postalCode: place.postalCode,
    city: place.postalCode ? place.city : "",
    email: readEmail(parts.email ?? ""),
    contributionCents: readContribution(parts.amount ?? ""),
    bankName: /[A-Za-zÄÖÜäöüß]{4,}/.test(bankName) ? bankName : "",
    iban: readIban([String(parts.iban ?? "")]),
    accountHolder: cleanHolder(parts.holder ?? ""),
  }
}

export function readMembership(text) {
  const lines = withoutFooter(
    String(text ?? "")
      .replace(/\u00a0/g, " ")
      .split(/\n+/)
      .map((line) => clean(line))
      .filter(Boolean),
  )
  const memberLines = beforeChildren(lines)
  const nameValue = valueAfter(
    memberLines,
    /(?:name\s*[,.]?\s*)?[vy]o[mn]ame\b|name\s*[,.]?\s*vorname\b/i,
    (value) => memberName(value).familyName.length > 1,
  )
  const member = memberName(nameValue)
  const street = splitStreet(
    valueAfter(memberLines, /stra(?:ß|ss)\w{0,8}|hausnummer/i, (value) =>
      /[A-Za-zÄÖÜäöüß]{6,}/.test(value) &&
      !/\d{5}|\d{2}\s\d{3}|\bplz\b|telefon|tolat|e-?mail|@/i.test(value),
    ),
  )
  const placeText =
    valueAfter(lines, /plz\s*[,.]?\s*ort\b/i, (value) => /\d{2}\s?\d{3}/.test(value)) ||
    memberLines.find((line) => /\d{2}\s?\d{3}\s+[A-Za-zÄÖÜäöüß]{3,}/.test(line)) ||
    ""
  const place = readPlace(placeText)
  const emailSource = valueAfter(memberLines, /e-?mail\b/i, (value) => /@/.test(value))
  const bankName = cleanBank(
    valueAfter(lines, /name der bank\b/i, (value) => /[A-Za-zÄÖÜäöüß]{4,}/.test(value)),
  )
  const accountHolder = cleanHolder(
    valueAfter(lines, /kontoinhaber(?:in)?\b/i, (value) => memberName(value).familyName.length > 1),
  )

  return {
    familyName: member.familyName,
    givenName: member.givenName,
    street: street.street,
    houseNumber: street.houseNumber,
    postalCode: place.postalCode,
    city: place.city,
    email: readEmail(emailSource) || readEmail(memberLines.join("\n")),
    contributionCents: readContribution(lines.join("\n")),
    bankName,
    iban: readIban(lines),
    accountHolder,
  }
}

export function mergeMembership(primary, secondary) {
  const individual = [primary, secondary].find(
    (item) =>
      item?.contributionCents &&
      item.contributionCents !== 2200 &&
      item.contributionCents !== 2500,
  )
  const pick = (key) => primary?.[key] || secondary?.[key] || ""
  return {
    familyName: pick("familyName"),
    givenName: pick("givenName"),
    street: pick("street"),
    houseNumber: pick("houseNumber"),
    postalCode: pick("postalCode"),
    city: pick("city"),
    email: pick("email"),
    contributionCents: individual?.contributionCents ?? primary?.contributionCents ?? secondary?.contributionCents ?? null,
    bankName: pick("bankName"),
    iban: pick("iban"),
    accountHolder: pick("accountHolder"),
  }
}
