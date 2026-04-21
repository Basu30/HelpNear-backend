import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { testConnection } from './db/index'

// IMPORTING ROUTERS
import authRoutes from '@routes/auth.routes'
import providerRouter  from '@routes/providerRouter'
import customerRouter from '@routes/customerRouter'
import jobRouter from '@routes/job.routes'
import categoryRouter from '@routes/category.routes'
import quoteRouter from '@routes/quote.routes'
import bookingRouter from '@routes/booking.routes'

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
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))
app.use(cookieParser());

// --- HEALTH CHECK ------------------------------
app.get('/health', (_req: Request, res: Response ) => {
    res.json({ status: "It's working!", env: process.env.NODE_ENV })
});

// --- ROUTERS -----------------------------------------
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1', providerRouter)
app.use('/api/v1', customerRouter)
app.use('/api/v1', jobRouter)
app.use('/api/v1', categoryRouter)
app.use('/api/v1', quoteRouter)
app.use('/api/v1', bookingRouter)


// --- 404 --------------------------------------------------
app.use((_req: Request, res: Response ) => {
    res.status(404).json({ error: 'Route not found' })
});

// -- GLOBAL ERROR HANDLER -----------------------------------------
/**
 * What: catches all errors thrown with next(err) across the app
 * Why: 4 parameters required - Express identifies error handlers this way 
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction ) => {
    console.error(err.stack)
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'production'
        ? 'Internal server error'                         // hide details in production
        : err.message                                     // show details in development
    })
});

// --- START --------------------------------------------
const PORT = Number(process.env.PORT) || 5000

async function start() {
    await testConnection()
    httpServer.listen(PORT, () => {
        console.log(`✓ Server is running on http://localhost:${PORT}`)
    })
}

start().catch((err) => {
    console.error('Failed to start: ', err.message)
    process.exit(1);
})