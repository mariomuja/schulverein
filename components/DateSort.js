import Link from "next/link"

export default function DateSort({ sort, className = "" }) {
  const nextSort = sort === "asc" ? "desc" : "asc"
  const label =
    sort === "asc"
      ? "Datum aufwärts, älteste zuerst. Auf abwärts umschalten."
      : "Datum abwärts, jüngste zuerst. Auf aufwärts umschalten."

  return (
    <Link
      href={`/?sort=${nextSort}`}
      className={`date-sort ${className}`.trim()}
      aria-label={label}
    >
      Datum <span aria-hidden="true">{sort === "asc" ? "↑" : "↓"}</span>
    </Link>
  )
}
