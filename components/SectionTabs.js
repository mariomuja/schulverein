import Link from "next/link"
import { getUser } from "../lib/auth"
import { givenName } from "../lib/names"

const tabs = [
  { id: "antraege", href: "/", label: "Förderanträge" },
  { id: "mitglieder", href: "/mitglieder", label: "Mitglieder" },
  { id: "statistik", href: "/statistik", label: "Statistik" },
]

function roleLine(user) {
  const parts = []
  if (user.role_label) parts.push(user.role_label)
  parts.push(user.can_write ? "Förderanträge Schreibrecht" : "Förderanträge Leserecht")
  return parts.join(" · ")
}

export default async function SectionTabs({ active }) {
  const user = await getUser()

  return (
    <>
      {user ? (
        <p className="mb-2 text-end text-secondary">
          {givenName(user.name)}
          <span className="d-block d-md-inline">
            <span className="d-none d-md-inline"> · </span>
            {roleLine(user)}
          </span>
        </p>
      ) : null}
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
    </>
  )
}
