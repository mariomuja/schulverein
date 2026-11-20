import Link from "next/link"

const tabs = [
  { id: "antraege", href: "/", label: "Förderanträge" },
  { id: "mitglieder", href: "/mitglieder", label: "Mitglieder" },
  { id: "statistik", href: "/statistik", label: "Statistik" },
]

export default function SectionTabs({ active }) {
  return (
    <ul className="nav nav-tabs mb-3">
      {tabs.map((tab) => (
        <li className="nav-item" key={tab.id}>
          <Link
            className={`nav-link${active === tab.id ? " active" : ""}`}
            href={tab.href}
            aria-current={active === tab.id ? "page" : undefined}
          >
            {tab.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}
