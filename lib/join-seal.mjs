import { createHmac, randomBytes, timingSafeEqual } from "crypto"

const maxAgeMs = 2 * 60 * 60 * 1000
const minAgeMs = 2000

function macKey() {
  const decoded = Buffer.from(process.env.MEMBER_DATA_KEY ?? "", "base64")
  if (decoded.length !== 32) throw new Error("MEMBER_DATA_KEY fehlt")
  return decoded
}

function mac(value) {
  return createHmac("sha256", macKey()).update(value).digest("base64url")
}

export function issueJoinSeal(now = Date.now()) {
  const nonce = randomBytes(18).toString("base64url")
  const issued = String(now)
  return { issued, nonce, seal: mac(`${issued}.${nonce}`) }
}

export function assessJoinSeal(fields, now = Date.now()) {
  const issued = String(fields?.issued ?? "")
  const nonce = String(fields?.nonce ?? "")
  const seal = String(fields?.seal ?? "")
  if (!/^\d{13}$/.test(issued) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !seal) return "angaben"
  const expected = mac(`${issued}.${nonce}`)
  const left = Buffer.from(seal)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return "angaben"
  const age = now - Number(issued)
  if (age < minAgeMs) return "warte"
  if (age > maxAgeMs) return "alt"
  return ""
}
