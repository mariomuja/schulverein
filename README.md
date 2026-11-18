# Schulverein – Förderanträge

Web-App für die Abstimmung über Förderanträge des Schulvereins des Gymnasiums Heidberg e.V.

Produktion: [schulverein.vercel.app](https://schulverein.vercel.app)

Die Seite ist nicht für Suchmaschinen bestimmt. Ohne persönliche Anmeldung erscheint nur der Hinweis, den zugesendeten Zugangslink zu nutzen.

## Funktionen

- Förderanträge mit Datum, Antragsteller, Zweck und Höchstbetrag anlegen, ändern und entfernen, solange die Abstimmung offen ist.
- Mit Ja oder Nein abstimmen. Genehmigt ist ein Antrag, wenn mehr als die Hälfte der Stimmberechtigten mit Ja stimmt.
- Belege an offenen Anträgen hinterlegen (JPEG, PNG, WebP, GIF, HEIC, HEIF, PDF; höchstens 12 Dateien, je 4 MB) und in der Vorschau mit Lupe ansehen.
- Die Abstimmung abschließen, sobald ein Beleg hinterlegt ist. Das kann nur der Schatzmeister. Danach sind Antrag, Stimmen und Belege festgeschrieben. Der Höchstbetrag darf über dem Betrag auf dem Beleg liegen.
- Alle Anträge als CSV und als PDF exportieren. Kontodaten werden nicht gespeichert.
- Benutzer mit Schreib- oder Leserecht anlegen, den persönlichen Zugangslink erneuern und Konten ohne abgegebene Stimme entfernen.

Auf dem Notebook (ab 1200 px Breite) stehen die Anträge in einer Tabelle. Darunter erscheinen sie als Karten.

## Rechte

Personen mit Schreibrecht legen Anträge an, stimmen ab, pflegen Belege und Benutzer. Personen mit Leserecht sehen die Anträge und können CSV und PDF herunterladen. Abschließen bleibt dem Schatzmeister vorbehalten.

Neue Konten entstehen in der Benutzerverwaltung. Der Schatzmeister wird dort nicht neu vergeben.

## Anmeldung

Jede Person hat einen dauerhaften persönlichen Link. Der Link wird nur als SHA-256-Hash gespeichert. Ein Aufruf legt eine Sitzung von 30 Tagen im Cookie `sv_session` an; auch die Sitzung liegt nur gehasht in der Datenbank. Der Link selbst bleibt gültig und wird nicht in Referrer-Headern weitergegeben.

## Revision

Beim Abschließen schreibt die App eine Niederschrift mit Stimmen, Betrag und Prüfcode. Trigger in PostgreSQL verhindern danach Änderungen an Antrag, Stimmen, Belegen und Niederschrift.

## Technik

- Next.js 15 (App Router) und React 19
- Bootstrap 5.3 und Bootstrap Icons
- PostgreSQL auf Neon, Zugriff über `pg`
- PDF mit `pdf-lib`
- Betrieb auf Vercel

## Lokal starten

```bash
npm install
npm run setup-db
npm run dev
```

Die App läuft danach unter [http://localhost:3000](http://localhost:3000).

In `.env.local` werden erwartet, ohne die Datei einzuchecken:

- `DATABASE_URL` für die App
- `DIRECT_URL` für das Anlegen der Datenbank
- `DATABASE_URL_OWNER` für Einrichtung und Revisionsschutz, wenn das App-Konto die Trigger nicht anlegen darf

`npm run setup-db` legt Tabellen, Trigger und die ersten Konten an. Die ausgegebenen Zugangslinks gehören nicht ins Repository.

## Deployment

Änderungen an `main` werden nach GitHub gepusht und die Produktion mit der Vercel-CLI ausgerollt:

```bash
npx vercel deploy --prod --yes --scope mario-muja
```

Verbindungsdaten und Zugangslinks bleiben in den Umgebungsvariablen von Vercel und Neon.
