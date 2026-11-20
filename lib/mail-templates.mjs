export const clubName = "Schulverein des Gymnasiums Heidberg e.V."

export const mailPlaceholders = ["Vorname", "Name", "Link", "Verein"]

export const templateDefaults = [
  {
    id: "beitritt",
    name: "Mitgliedschaft bestätigen",
    sortOrder: 1,
    subject: "Bitte Mitgliedschaft und Lastschrift bestätigen",
    body: [
      "Guten Tag {Vorname},",
      "",
      "für die Mitgliedschaft im {Verein} muss diese E-Mail-Adresse bestätigt werden.",
      "",
      "Öffne den Link. Dort stehen das Lastschriftmandat und deine Rechte. Mit dem Button bestätigst du die E-Mail-Adresse und das Mandat.",
      "",
      "{Link}",
      "",
      "Der Link gilt 48 Stunden und nur einmal.",
      "",
      "Eine berechtigte Basislastschrift kannst du innerhalb von acht Wochen nach der Belastung ohne Begründung zurückgeben. Eine Abbuchung ohne gültiges Mandat kannst du bis zu 13 Monate nach der Belastung zurückgeben.",
      "",
      "Wenn du das Formular nicht selbst ausgefüllt hast, ignoriere diese E-Mail.",
      "",
      "{Verein}",
    ].join("\n"),
  },
  {
    id: "versammlung",
    name: "Einladung zur Mitgliederversammlung",
    sortOrder: 3,
    subject: "Einladung zur Mitgliederversammlung",
    body: [
      "Guten Tag {Vorname} {Name},",
      "",
      "wir laden dich zur Mitgliederversammlung des {Verein} ein.",
      "",
      "Ort:",
      "Zeit:",
      "",
      "Die Tagesordnung ist dieser E-Mail angehängt.",
      "",
      "{Verein}",
    ].join("\n"),
  },
]

export function renderMail(text, values) {
  return String(text ?? "").replace(/\{(Vorname|Name|Link|Verein)\}/g, (_, key) => {
    const value = values?.[key]
    return value == null ? "" : String(value).replace(/[\r\n]+/g, " ").trim()
  })
}
