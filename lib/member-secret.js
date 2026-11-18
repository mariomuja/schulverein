import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

function key() {
  const raw = process.env.MEMBER_DATA_KEY ?? ""
  const decoded = Buffer.from(raw, "base64")
  if (decoded.length !== 32) {
    throw new Error("MEMBER_DATA_KEY fehlt")
  }
  return decoded
}

export function encryptMember(data) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decryptMember(payload) {
  const buffer = Buffer.from(String(payload ?? ""), "base64")
  const iv = buffer.subarray(0, 12)
  const tag = buffer.subarray(12, 28)
  const encrypted = buffer.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", key(), iv)
  decipher.setAuthTag(tag)
  const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
  return JSON.parse(json)
}
