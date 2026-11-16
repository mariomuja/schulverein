const filters = new Set(["offen", "abgeschlossen", "genehmigt"])

export function cleanFilter(value) {
  return filters.has(value) ? value : ""
}

export function boardHref({ sort = "desc", filter = "", hinweis = "" } = {}) {
  const params = new URLSearchParams()
  if (sort === "asc") params.set("sort", "asc")
  if (cleanFilter(filter)) params.set("filter", cleanFilter(filter))
  if (hinweis) params.set("hinweis", hinweis)
  const query = params.toString()
  return query ? `/?${query}` : "/"
}
