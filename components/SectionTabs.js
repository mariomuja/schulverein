import Link from "next/link"
import { canSeeMembers } from "../lib/access"

export default function SectionTabs({ user, active }) {
  if (!canSeeMembers(user)) return null
  return (
    <ul className="nav nav-tabs mb-3">
      <li className="nav-item">
        <Link
          className={`nav-link${active === "mitglieder" ? " active" : ""}`}
          href="/mitglieder"
          aria-current={active === "mitglieder" ? "page" : undefined}
        >
          Mitglieder
        </Link>
      </li>
      <li className="nav-item">
        <Link
          className={`nav-link${active === "antraege" ? " active" : ""}`}
          href="/"
          aria-current={active === "antraege" ? "page" : undefined}
        >
          Förderanträge
        </Link>
      </li>
    </ul>
  )
}
