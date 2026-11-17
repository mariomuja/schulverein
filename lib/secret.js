import { createHash } from "crypto"

export const sessionDays = 30

export function hashSecret(value) {
  return createHash("sha256").update(String(value)).digest("hex")
}
