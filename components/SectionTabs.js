import Link from "next/link"
import { canReadMembers } from "../lib/access"
import { getUser } from "../lib/auth"
import { givenName } from "../lib/names"

const tabs = [
  { id: "mitglieder", href: "/mitglieder", label: "Mitglieder" },
  { id: "antraege", href: "/", label: "Förderanträge" },
  { id: "spenden", href: "/spenden", label: "Spendentöpfe" },
  { id: "vorlagen", href: "/vorlagen", label: "eMail Vorlagen" },
  { id: "statistik", href: "/statistik", label: "Statistik" },
]

export default async function SectionTabs({ active }) {
  const user = await getUser()

  return (
    <>
      {user ? (
        <p className="mb-2 small text-secondary">
          {givenName(user.name)}
          {user.role_label ? ` · ${user.role_label}` : ""}
        </p>
      ) : null}
      <ul className="nav nav-tabs flex-wrap mb-3">
        {tabs.filter((tab) => (tab.id !== "mitglieder" && tab.id !== "vorlagen") || canReadMembers(user)).map((tab) => (
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
