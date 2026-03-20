import { PoolClient } from 'pg'
import { poolHelpNear, query } from './pool';

// Re-export query so other files import from './db' not './db/pool'
export { query }

// Transaction helper - all or nothing DB operations
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await poolHelpNear.connect()
    try{
        await client.query('begin')
        const result = await fn(client)
        await client.query('commit')
        return result
    } catch (err) {
        await client.query('Rollback')
        throw err
    } finally {
        client.release()
    }
}

// Connection test - called once on server running 
export async function testConnection(): Promise<void> {
    const client = await poolHelpNear.connect()
    try {
        await client.query('select NOW()')
        console.log('Database connected!')
    } finally{
        client.release()
    }
}
