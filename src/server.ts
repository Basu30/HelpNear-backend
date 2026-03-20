import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { testConnection } from './db/index'

import providerRouter  from './routes/providerRouter'
const app = express()
const httpServer = createServer(app)

// --- Socket.IO ---
export const io = new Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// --- Middleware ---
app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', credentials: true}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

// --- Health check ---
app.use('/health', (_req: Request, res: Response ) => {
    res.json({ status: 'ok', env: process.env.NODE_ENV })
});

// --- Routers ---
app.use('/api', providerRouter)


// --- 404 ---
app.use((_req: Request, res: Response ) => {
    res.status(404).json({ error: 'Route not found' })
});

// -- Error Handler ---
app.use((err: Error, _req: Request, res: Response ) => {
    console.error(err.stack)
    res.status(500).json({ error: err.message })
});

// --- Start ---
const PORT = Number(process.env.PORT) || 5000

async function start() {
    await testConnection()
    httpServer.listen(PORT, () => {
        console.log(`✓ Server is running on http://localhost:${PORT}`)
    })
}

start().catch((err) => {
    console.error('Failed to start: ', err.message)
    process.exit();
})