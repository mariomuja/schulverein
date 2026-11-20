import Link from "next/link"
import { canReadMembers } from "../lib/access"
import { getUser } from "../lib/auth"
import { givenName } from "../lib/names"

const tabs = [
  { id: "antraege", href: "/", label: "Förderanträge" },
  { id: "mitglieder", href: "/mitglieder", label: "Mitglieder" },
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
      <ul className="nav nav-tabs mb-3">
        {tabs.filter((tab) => tab.id !== "mitglieder" || canReadMembers(user)).map((tab) => (
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
