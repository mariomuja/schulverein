import { query } from "./db"
import { germanIbanParts } from "./iban.mjs"

export async function findBankByBlz(blz) {
  if (!/^\d{8}$/.test(String(blz ?? ""))) return null
  const { rows } = await query(`SELECT bic, name FROM bank_codes WHERE blz = $1`, [blz])
  const bank = rows[0]
  if (!bank?.bic || !bank?.name) return null
  return { bic: bank.bic, name: bank.name }
}

export async function findBankByIban(iban) {
  const parts = germanIbanParts(iban)
  if (!parts || parts.country !== "DE") return null
  return findBankByBlz(parts.bankCode)
}
