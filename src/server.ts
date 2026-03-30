import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { testConnection } from './db/index'


import authRoutes from './routes/auth.routes'
import providerRouter  from './routes/providerRouter'
import customerRouter from '@routes/customerRouter'
const app = express()
const httpServer = createServer(app)

// --- Socket.IO ---------------------------------
export const io = new Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// --- MIDDLEWARE --------------------------------------
app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', credentials: true}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))
app.use(cookieParser());

// --- HEALTH CHECK ------------------------------
app.use('/health', (_req: Request, res: Response ) => {
    res.json({ status: "It's working!", env: process.env.NODE_ENV })
});

// --- ROUTERS -----------------------------------------
app.use('/api/auth', authRoutes)
app.use('/api', providerRouter)
app.use('/api', customerRouter)


// --- 404 --------------------------------------------------
app.use((_req: Request, res: Response ) => {
    res.status(404).json({ error: 'Route not found' })
});

// -- ERROR HANDLER -----------------------------------------
app.use((err: Error, _req: Request, res: Response ) => {
    console.error(err.stack)
    res.status(500).json({ error: err.message })
});

// --- START ---
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