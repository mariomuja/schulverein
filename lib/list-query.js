const filters = new Set(["offen", "abgeschlossen", "genehmigt"])

export function cleanFilter(value) {
  return filters.has(value) ? value : ""
}

export function boardHref({ sort = "desc", filter = "", hinweis = "", edit = "" } = {}) {
  const params = new URLSearchParams()
  if (sort === "asc") params.set("sort", "asc")
  if (cleanFilter(filter)) params.set("filter", cleanFilter(filter))
  if (hinweis) params.set("hinweis", hinweis)
  if (edit) params.set("edit", String(edit))
  const query = params.toString()
  return query ? `/?${query}` : "/"
}
