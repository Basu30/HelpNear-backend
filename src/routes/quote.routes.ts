import { Router } from "express";
import { authMiddleware, requireRole } from "@middleware/auth.middleware";

import { 
    submitQuote,
    getJobQuotes,
    getProviderQuotes,
    withDrawQuote,
    acceptQuote
} from "@controllers/quote.controller";


const quoteRouter = Router()

quoteRouter.post('/jobs/:jobId/quotes', authMiddleware, requireRole('provider'), submitQuote )
quoteRouter.get('/jobs/:jobId/quotes', authMiddleware, getJobQuotes)
quoteRouter.get('/provider/quotes', authMiddleware, requireRole('provider'), getProviderQuotes)
quoteRouter.patch('/quotes/:quoteId/withdraw', authMiddleware, requireRole('provider'), withDrawQuote)
quoteRouter.post('/quotes/:quoteId/accept', authMiddleware, requireRole('customer'), acceptQuote)

export default quoteRouter;