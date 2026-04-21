import { Request, Response, NextFunction } from "express";
import { quoteSchema } from "@validators/quote.validator";
import { query, withTransaction } from "@db";
import HttpError from "@utils/http-error";


export const submitQuote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // VALIDATE WITH QUOTESCHEMA
        const parsed = quoteSchema.safeParse(req.body)

        if (!parsed.success) {
            const error = parsed.error.flatten().fieldErrors
            throw new HttpError(JSON.stringify(error), 400)
        }

        const { price, message, estimated_time } = parsed.data;

        // GET PROVIDER_ID FROM REQ.USER!.USERID
        const provider_id = req.user!.userId

        // GET JOBID FROM REQ.PARAMS
        const { jobId } = req.params;

        // CHECK JOB EXISTS AND IS OPEN
        const jobResult = await query(
            `Select 
                id, customer_id, status
            From 
                job_requests
            Where id = $1`,
            [jobId]
        )

        if (jobResult.rows.length === 0) {
            throw new HttpError('Job not found', 404)
        }

        // CHECK PROVIDER HAS NOT ALREADY QUOTED THIS JOB
        const existing = await query(
            `Select id 
            From    quotes
            Where   job_request_id = $1 
            AND     provider_id = $2`,

            [jobId, provider_id]
        )

        if (existing.rows.length > 0) {
            throw new HttpError('You have already submitted a quote for this job', 409)
        }


        // INSERT QUOTE
        const result = await query(
            `Insert into quotes
                (job_request_id, provider_id, price, message, estimated_time)
        
            Values ( $1, $2, $3, $4, $5 )
        
            Returning 
                id, job_request_id, provider_id, 
                price, message, estimated_time, 
                status, created_at, updated_at`,

            [jobId, provider_id, price, message ?? null, estimated_time ?? null]
        )

        // UPDATE JOB STATUS TO 'QUOTED'
        await query(
            `Update job_requests 
            Set status = 'quoted'
            Where id = $1`,
            [jobId]
        )


        res.status(200).json({
            message: 'Quote submitted successfully',
            quote: result.rows[0]
        })

    } catch (err) {
        next(err)
    }

}


// ---------------- ALL JOBS WITH QUOTES -------------------------------------

// export const allJobsWithQuotes =  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    
//     try {
//         const result = await query(
//             `Select `
//         )
//     }
// }


export const getJobQuotes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
        const { jobId } = req.params
        const customer_id = req.user?.userId

        const jobResult = await query(
            `Select id, customer_id
            From    job_requests 
            Where   id = $1`,
            [jobId]
        )

        if (jobResult.rows.length === 0) {
            throw new HttpError('Job not found', 404)
        }

        const job = jobResult.rows[0]

        if (job.customer_id !== customer_id) {
            throw new HttpError('Not authorized', 403)
        }

        // GET QUOTES WITH PROVIDER INFO
        const quoteResult = await query(
            `Select 
                q.id, q.price, q.message, q.estimated_time,
                q.status, q.created_at, 
                u.id AS provider_user_id,
                u.full_name AS provider_name,
                pp.city AS provider_city,
                pp.district AS provider_district,
                pp.total_reviews AS provider_reviews,
                pp.average_rating, pp.completed_jobs,
                pp.is_verified                
            From quotes q
            Join users u ON u.id = q.provider_id
            Join provider_profiles pp ON pp.user_id = q.provider_id
            Where q.job_request_id = $1
            Order by q.created_at ASC`,
            [jobId]
        )



        res.status(200).json({
            quotes: quoteResult.rows,
            count: quoteResult.rowCount
        })
    } catch (err) {
        next(err)
    }
}

export const getProviderQuotes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
        const provider_id = req.user?.userId

        const result = await query(
            `Select 
                q.id, q.price, q.message, q.estimated_time,
                q.status, q.created_at,
                jr.id AS job_id,
                jr.title, jr.description, jr.budget_min, jr.budget_max,
                jr.city, jr.district, 
                jr.status AS job_status,
                u.full_name AS customer_name
            From quotes q
            Join job_requests jr ON jr.id = q.job_request_id 
            Join users u ON u.id = jr.customer_id
            Where q.provider_id = $1
            Order by q.created_at DESC`,
            [provider_id]
        )

        res.status(200).json({
            quotes: result.rows,
            count: result.rowCount
        })

    } catch (err) {
        next(err)
    }
}

// ------------------ WITHDRAWN QUOTE ----------------------------------

export const withDrawQuote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {

        const { quoteId } = req.params;
        const provider_id = req.user?.userId

        // CHECK QUOTE EXISTS, BELONGS TO THIS PROVIDER, AND IS PENDING
        const quoteResult = await query(
            `Select 
                id, provider_id, status
            From quotes
            Where id = $1`,
            [quoteId]
        )

        if (quoteResult.rows.length === 0) {
            throw new HttpError('Quote not found', 404)
        }

        const quote = quoteResult.rows[0]

        // OWNERSHIP CHECK - ONLY QUOTE OWNER CAN WITHDRAW
        if (quote.provider_id === provider_id) {
            throw new HttpError('Not authorized', 403)
        }

        // CAN ONLY WITHDRAW PENDING QUOTES
        if (quote.status !== 'pending') {
            throw new HttpError('Only pending quotes can be withdrawn', 400)
        }

        const result = await query(
            `Update quotes 
            Set status = 'withdrawn', updated_at = NOW()
            Where id = $1
            Returning id, status, updated_at`,
            [quoteId]
        )

        res.status(200).json({
            message: 'Quote withdrawn successfully',
            quote: result.rows[0]
        })

    } catch (err) {
        next(err)
    }
}

// -------------------- ACCEPT QUOTE -----------------------------------
/**
 * What: customer accepts a quote -> creates booking + converstaion
 * Why: withTransaction: 5 operations must ALL succeed or ALL rollback
 */
export const acceptQuote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
        const { quoteId } = req.params
        const customer_id = req.user?.userId

        // GET QUOTE AND VERIFY IT EXISTS AND IS PENDING
        const quoteResult = await query(
            `Select 
                q.id, q.job_request_id, q.provider_id, q.status, q.price, 
                jr.customer_id, jr.status AS job_status
            From quotes q
            Join job_requests jr ON jr.id = q.job_request_id
            Where q.id = $1`,
            [quoteId]
        )

        if (quoteResult.rows.length === 0) {
            throw new HttpError('Quote not found', 404)
        }

        const quote = quoteResult.rows[0]

        // VALIDATE STATUS
        if (quote.status === 'accepted'){
            throw new HttpError('Quote already accepted', 400)
        }
        if (quote.status !== 'pending') {
            throw new HttpError('Only can accept quote is not pending', 400)
        }
       
        if (quote.job_status !== 'open' && quote.job_status !== 'quoted') {
            throw new HttpError('Job is no longer accepting quotes', 400)
        }
        

        // CHECKING OWNERSHIP
        if (quote.customer_id !== customer_id) {
            throw new HttpError('Not authorized', 403)
        }

        // RUN ALL OPERATIONS ATOMATICALLY
        const booking = await withTransaction(async (client) => {

            // OPERATION 1: ACCEPT THIS QUOTE
            await client.query(
                `Update quotes SET status = 'accepted', updated_at = NOW()
                Where id = $1`,
                [quoteId]
            )

            // 2: REJECT ALL OTHER QUOTES FOR THIS JOB
            await client.query(
                `Update quotes Set status = 'rejected', updated_at = NOW()
                Where job_request_id = $1 AND id != $2`,
                [quoteId, quote.job_request_id]
            )

            // 3: UPDATE JOB STATUS + SELECTED QUOTE
            await client.query(
                `Update job_requests
                Set status = 'booked',
                    selected_quote_id = $1,
                    updated_at = NOW()
                Where id = $2`,
                [quoteId, quote.job_request_id]
            )

            // 4: Create booking
            const bookingResult = await client.query(
                `INSERT INTO bookings
                    (job_request_id, customer_id, provider_id, accepted_quote_id)

                VALUES ($1, $2, $3, $4)

                RETURNING 
                    id, job_request_id, customer_id,
                    provider_id, accepted_quote_id, status, created_at`,

                [quote.job_request_id, customer_id, quote.provider_id, quoteId]
            )

            const newBooking = bookingResult.rows[0]

            // 5:  CREATE CONVERSATION FOR THIS BOOKING
            await client.query(
                `Insert Into conversations (booking_id) Values ($1)`,
                [newBooking.id]
            )

            return newBooking
        })

        res.status(200).json({
            message: 'Quote accepted - booking created',
            booking
        })
    } catch (err) {
        next(err)
    }
}