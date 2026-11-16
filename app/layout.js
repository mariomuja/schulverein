import "./globals.css"

export const metadata = {
  title: "Förderanträge · Schulverein Gymnasium Heidberg",
  description:
    "Abstimmung über Förderanträge des Schulvereins des Gymnasiums Heidberg e.V.",
  robots: { index: false, follow: false },
  referrer: "strict-origin-when-cross-origin",
  appleWebApp: {
    capable: true,
    title: "Schulverein",
    statusBarStyle: "default",
  },
  icons: { icon: "/logo.png", apple: "/logo.png" },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
}

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
        />
      </head>
      <body className="d-flex flex-column min-vh-100 bg-light">
        <header className="bg-white border-bottom">
          <div className="container-fluid px-3 py-2 py-md-3">
            <img
              className="logo"
              src="/logo.png"
              alt="Schulverein des Gymnasiums Heidberg"
            />
          </div>
        </header>
        <main className="container-xl px-3 py-3 py-md-4 flex-grow-1">
          {children}
        </main>
        <footer className="site-footer text-center text-secondary bg-white border-top">
          <div className="d-none d-md-block">
            Schulverein des Gymnasiums Heidberg e.V. | Fritz-Schumacher-Allee
            200 | 22417 Hamburg
          </div>
          <div className="d-md-none">
            <div>Schulverein des Gymnasiums Heidberg e.V.</div>
            <div>Fritz-Schumacher-Allee 200, 22417 Hamburg</div>
          </div>
          <div>
            <a
              className="link-secondary"
              href="mailto:schulverein@gymnasium-heidberg.de"
            >
              schulverein@gymnasium-heidberg.de
            </a>
          </div>
        </footer>
      </body>
    </html>
  )
}
