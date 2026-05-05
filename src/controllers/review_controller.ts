import { query } from "@db";
import HttpError from "@utils/http-error";
import { reviewSchema } from "@validators/review.validator";
import { Request, Response, NextFunction } from "express";


// ----------------- CREATE PROVIDER REVIEW ----------------------------------

export const createProviderReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
        const { bookingId } = req.params;
        const customer_id = req.user?.userId;
   
        // VALIDATE INPUT
        const parsed = reviewSchema.safeParse(req.body)
        if (!parsed.success) {
            throw new HttpError(JSON.stringify(parsed.error.flatten().fieldErrors), 400)
        }

        const { comment, rating } = parsed.data

        // GET BOOKING WITH ALL NEEDED FIELDS
        const bookingResult = await query(
            `Select 
                id, customer_id, provider_id, status
            From 
                bookings 
            Where id = $1`,
            [bookingId]
        )

        if (bookingResult.rows.length === 0 ) {
            throw new HttpError('Not found booking', 404)
        }

        const booking = bookingResult.rows[0]

        // OWNERSHIP CHECK
        if (booking.customer_id !== customer_id) {
            throw new HttpError('Not authorized', 403)
        }

        // MUST BE COMPLETED
        if (booking.status !== 'completed') {
            throw new HttpError('Booking must be completed to leave review', 400)
        }

        // CHECK NO REVIEW ALREADY EXISTS
        const existingReview = await query(
            `Select id From provider_reviews Where booking_id = $1`,
            [bookingId]
        )
        if (existingReview.rows.length > 0) {
            throw new HttpError('You have already reviewed this booking', 409)
        }

        // INSERT REVIEW
        const proResult = await query(
            `Insert Into provider_reviews 
                (booking_id, customer_id, provider_id, rating, comment)
            Values 
                ($1, $2, $3, $4, $5)
            Returning 
                id, booking_id, customer_id, provider_id, rating, comment, created_at`,
            [bookingId, customer_id, booking.provider_id, rating, comment ?? null]
        )

        // RECALCULATE PROVIDER RATING USING AVG
        await query(
            `Update provider_profiles
            Set 
                average_rating = (
                    Select Round(AVG(rating)::numeric, 2)
                        From provider_reviews
                        Where provider_id = $1
                    ),
                total_reviews = (
                    Select Count(*)
                        From provider_reviews
                        Where provider_id = $1
                    )             
            Where user_id = $1`,
            [booking.provider_id]
        )

        res.status(201).json({
            review: proResult.rows[0]
        })

    } catch (err) {
        next(err)
    }
}

// ----------- CREATE CUSTOMER REVIEW ------------------------------

export const createCustomerReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
        const { bookingId } = req.params;
        const provider_id = req.user?.userId;
   
        // VALIDATE INPUT
        const parsed = reviewSchema.safeParse(req.body)
        if (!parsed.success) {
            throw new HttpError(JSON.stringify(parsed.error.flatten().fieldErrors), 400)
        }

        const { comment, rating } = parsed.data

        // GET BOOKING WITH ALL NEEDED FIELDS
        const bookingResult = await query(
            `Select 
                id, customer_id, provider_id, status
            From 
                bookings 
            Where id = $1`,
            [bookingId]
        )

        if (bookingResult.rows.length === 0 ) {
            throw new HttpError('Not found booking', 404)
        }

        const booking = bookingResult.rows[0]

        // OWNERSHIP CHECK
        if (booking.provider_id !== provider_id) {
            throw new HttpError('Not authorized', 403)
        }

        // MUST BE COMPLETED
        if (booking.status !== 'completed') {
            throw new HttpError('Booking must be completed to leave review', 400)
        }

        // CHECK NO REVIEW ALREADY EXISTS
        const existingReview = await query(
            `Select id From customer_reviews Where booking_id = $1`,
            [bookingId]
        )
        if (existingReview.rows.length > 0) {
            throw new HttpError('You have already reviewed this booking', 409)
        }

        // INSERT REVIEW
        const proResult = await query(
            `Insert Into customer_reviews 
                (booking_id, customer_id, provider_id, rating, comment)
            Values 
                ($1, $2, $3, $4, $5)
            Returning 
                id, booking_id, customer_id, provider_id, rating, comment, created_at`,
            [bookingId, booking.customer_id, provider_id, rating, comment ?? null]
        )

        // RECALCULATE PROVIDER RATING USING AVG
        await query(
            `Update customer_profiles
            Set 
                average_rating = (
                    Select Round(AVG(rating)::numeric, 2)
                        From customer_reviews
                        Where customer_id = $1
                    ),
                total_reviews = (
                    Select Count(*)
                        From customer_reviews
                        Where customer_id = $1
                    )             
            Where user_id = $1`,
            [booking.customer_id]
        )

        res.status(201).json({
            review: proResult.rows[0]
        })

    } catch (err) {
        next(err)
    }
}

// -------------------- GET PROVIDER REVIEWS -------------------------------

export const getProviderReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
        
        const {provider_id} = req.params

        const result = await query(
            `Select
                u.id, u.full_name,  
                pp.id, pp.experience_years, pp.city, pp.district, 
                pp.average_rating, pp.total_reviews, pp.completed_jobs,
                pr.provider_id, pr.rating, pr.comment
            From provider_profiles pp
            Join users u ON u.id = pp.user_id
            Join provider_reviews pr ON pr.provider_id = u.id
            Where pr.provider_id = $1
            And u.is_active = true`,
            [provider_id]
        )

        
        res.status(200).json({
            reviews: result.rows,
            count: result.rowCount
        })
    } catch (err) {
        next(err)
    }
}

// -------------------- GET CUSTOMER REVIEWS -------------------------------

export const getCustomerReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
        
        const { customer_id } = req.params

        const result = await query(
            `Select 
                u.id, u.full_name,
                cp.id, cp.city, cp.district,
                cr.customer_id, cr.rating, cr.comment
            From customer_profiles cp
            Join users u ON u.id = cp.user_id
            Join customer_reviews cr ON pr.customer_id = u.id
            Where cr.customer_id = $1
            And u.is_active`,
            [customer_id]
        )

      
        res.status(200).json({
            reviews: result.rows,
            count: result.rowCount
        })
    } catch (err) {
        next(err)
    }
}