import { Pool, PoolClient } from "pg";

const pool = new Pool({
    host: process.env.DB_HOST           ?? 'localhost',
    port: Number(process.env.DB_PORT)   || 5432,
    database: process.env.DB_NAME       ?? 'helpnear',
    user: process.env.DB_USER           ?? 'postgres',
    password: process.env.DB_PASSWORD   ?? '',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000

})

export const query = (text: string, params?: unknown[]) => {
    pool.query(text, params)
}
    

export async function testConnection(): Promise<void> {
    const client = await pool.connect()
    try {
        await client.query('select now()')
        console.log('Database connected!')
    } finally{
        client.release()
    }
}