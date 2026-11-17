const typesByExtension = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
}

export const maxReceiptBytes = 4 * 1024 * 1024
export const maxReceipts = 12

export function safeReceiptName(name) {
  const base = String(name ?? "beleg")
    .split(/[/\\]/)
    .pop()
    .replace(/[\r\n"]/g, "")
  const cleaned = base.replace(/[^\w.\- ()äöüÄÖÜß]/g, "_").slice(0, 120)
  return cleaned || "beleg"
}

export function acceptReceipt(file) {
  const name = safeReceiptName(file?.name)
  const extension = name.toLowerCase().split(".").pop()
  const type = typesByExtension[extension]
  if (!type || file.size <= 0 || file.size > maxReceiptBytes) return null
  return { name, type }
}

export function receiptDisposition(name) {
  const safe = safeReceiptName(name)
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_")
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`
}
