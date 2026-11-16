import pg from "pg"

const globalForPg = globalThis

if (!globalForPg.schulvereinPool) {
  globalForPg.schulvereinPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
      ? { rejectUnauthorized: false }
      : undefined,
    max: 2,
  })
}

export async function query(text, params) {
  return globalForPg.schulvereinPool.query(text, params)
}
