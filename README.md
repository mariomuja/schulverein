# Schulverein – Förderanträge

Abstimmung über Förderanträge des Schulvereins des Gymnasiums Heidberg e.V.

Die Datenbank liegt bei Neon, dieselbe Plattform wie bei der Buchhaltung. Die App läuft auf Vercel. Jede Person hat einen dauerhaften persönlichen Zugangslink. Ohne diesen Link erscheint nur der Hinweis zur Anmeldung.

Schreibrechte: Mario Muja, Meike Brand, Sebastian Siem, Alexander Nehls. Leserechte: Markus Fürstenberg, Miriam Rasched. Nur der Schatzmeister kann eine Abstimmung abschließen.

Lokal:

```bash
npm install
npm run setup-db
npm run dev
```

`DATABASE_URL` und `DIRECT_URL` stehen in `.env.local` und werden nicht eingecheckt.
