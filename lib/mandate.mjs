export function mandateText({ amount, accountHolder }) {
  const contribution = String(amount ?? "").trim()
  const holder = String(accountHolder ?? "").trim()
  return [
    `Ich ermächtige den Schulverein des Gymnasiums Heidberg e.V., Gläubiger-Identifikationsnummer DE64ZZZ00000104062, den Mitgliedsbeitrag von ${contribution} pro Schuljahr mittels wiederkehrender Lastschrift von meinem Konto einzuziehen. Kontoinhaber ist ${holder}. Zugleich weise ich mein Kreditinstitut an, die vom Schulverein des Gymnasiums Heidberg e.V. auf mein Konto gezogenen Lastschriften einzulösen.`,
    "Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrags verlangen. Dafür muss ich keinen Grund angeben. Es gelten die mit meinem Kreditinstitut vereinbarten Bedingungen.",
    "Eine Abbuchung ohne gültiges Mandat kann ich bis zu 13 Monate nach der Belastung zurückgeben.",
  ].join("\n\n")
}
