import pg from "pg"

const globalForPg = globalThis

if (!globalForPg.schulvereinPool) {
  globalForPg.schulvereinPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: true } : undefined,
    max: 2,
  })
}

export async function query(text, params) {
  return globalForPg.schulvereinPool.query(text, params)
}

export async function withTransaction(run) {
  const client = await globalForPg.schulvereinPool.connect()
  try {
    await client.query("BEGIN")
    const result = await run((text, params) => client.query(text, params))
    await client.query("COMMIT")
    return result
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {
      // Die Transaktion ist bereits abgebrochen.
    }
    throw error
  } finally {
    client.release()
  }
}
