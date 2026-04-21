import { Request, Response, NextFunction } from "express";
import { cancelBookingSchema } from "@validators/booking.validator";
import { query } from "@db";
import HttpError from "@utils/http-error";

export const getBookingById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    const { bookingId } = req.params

    try {
        const result = await query(
            `Select b.id, b.job_request_id, 
                b.customer_id, b.provider_id, b.accepted_quote_id,
                jr.title, jr.description, jr.budget_min, jr.budget_max, jr.city, jr.district,
                cu.full_name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone,
                pu.full_name AS provider_name, pu.email AS provider_email, pu.phone AS provider_phone,
                cp.city, cp.district, cp.average_rating AS customer_rating, cp.total_reviews,
                pp.bio, pp.experience_years, pp.city, pp.district, pp.average_rating AS provider_rating, pp.total_reviews, pp.completed_jobs, pp.is_verified,
                q.price, q.message, q.estimated_time

            From bookings b

            Join job_requests jr      ON jr.id = b.job_request_id
            Join users cu             ON cu.id = b.customer_id
            Join users pu             On pu.id = b.provider_id
            Join customer_profiles cp ON cp.user_id = b.customer_id
            Join provider_profiles pp ON pp.user_id = b.provider_id
            Join quotes q             ON q.id = b.accepted_quote_id

            where b.id = $1`,
            [bookingId]
        )

        if (result.rows.length === 0){
            throw new HttpError('Not found booking', 404)
        }

        const booking = result.rows[0]
        if (booking.customer_id !== req.user?.userId && booking.provider_id !== req.user?.userId) {
            throw new HttpError('Not authorized', 403)
        }

        res.status(200).json({
            booking: result.rows[0]
        })
    } catch (err) {
        next(err)
    }
}


// ── GET CUSTOMER BOOKINGS ─────────────────────────────────────
export const getCustomerBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customer_id = req.user!.userId

    const result = await query(
      `SELECT
          b.id, b.status, b.created_at,
          b.start_time, b.completed_at,
          b.cancelled_at, b.cancellation_reason,
          jr.title, jr.city, jr.district,
          pu.full_name AS provider_name,
          pp.average_rating AS provider_rating,
          pp.is_verified,
          q.price, q.estimated_time
       FROM bookings b
       JOIN job_requests jr ON jr.id = b.job_request_id
       JOIN users pu        ON pu.id = b.provider_id
       JOIN provider_profiles pp ON pp.user_id = b.provider_id
       JOIN quotes q        ON q.id = b.accepted_quote_id
       WHERE b.customer_id = $1
       ORDER BY b.created_at DESC`,
      [customer_id]
    )

    // Empty list is valid — not a 404
    res.status(200).json({
      bookings: result.rows,
      count:    result.rowCount,
    })

  } catch (err) {
    next(err)
  }
}

// ── GET PROVIDER BOOKINGS ─────────────────────────────────────
export const getProviderBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const provider_id = req.user!.userId

    const result = await query(
      `SELECT
          b.id, b.status, b.created_at,
          b.start_time, b.completed_at,
          b.cancelled_at, b.cancellation_reason,
          jr.title, jr.city, jr.district,
          cu.full_name AS customer_name,
          cp.average_rating AS customer_rating,
          q.price, q.estimated_time
       FROM bookings b
       JOIN job_requests jr ON jr.id = b.job_request_id
       JOIN users cu        ON cu.id = b.customer_id
       JOIN customer_profiles cp ON cp.user_id = b.customer_id
       JOIN quotes q        ON q.id = b.accepted_quote_id
       WHERE b.provider_id = $1
       ORDER BY b.created_at DESC`,
      [provider_id]
    )

    res.status(200).json({
      bookings: result.rows,
      count:    result.rowCount,
    })

  } catch (err) {
    next(err)
  }
}


// -----------------  START BOOKING ----------------------------    

export const startBooking = async (req: Request, res: Response, next: NextFunction) : Promise<void> => {

    try {
        const { bookingId } = req.params
        const provider_id = req.user?.userId

        const bookingResult = await query(
            `Select id, provider_id, status
            From bookings
            where id = $1`,
            [bookingId]
        )

        if (bookingResult.rows.length === 0) {
            throw new HttpError('Booking not found', 404)
        }

        const booking = bookingResult.rows[0]

         // Ownership check
        if (booking.provider_id !== provider_id) {
            throw new HttpError('Not authorized', 403)
        }

        if (booking.status !== 'confirmed') {
            throw new HttpError('Booking must be confirmed to start', 400)
        }

        const result = await query(
            `Update bookings 
            Set status = 'in_progress',
                start_time = NOW(),
                updated_at = NOW()
            Where id = $1
            Returning id, status, start_time`,
            [bookingId]
        )

        res.status(200).json({
            message: 'Booking started',
            booking: result.rows[0]
        })
    } catch (err) {
        next(err)
    }
}


// --------------------- COMPLETE BOOKING -----------------------------------
  /**
   * What: provider marks work done -> in_progress -> completed
   * Who: provider only
   */
export const completeBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId } = req.params
    const provider_id = req.user!.userId

    const bookingResult = await query(
      'SELECT id, provider_id, status FROM bookings WHERE id = $1',
      [bookingId]
    )
    if (bookingResult.rows.length === 0) {
      throw new HttpError('Booking not found', 404)
    }

    const booking = bookingResult.rows[0]

    if (booking.provider_id !== provider_id) {
      throw new HttpError('Not authorized', 403)
    }

    if (booking.status !== 'in_progress') {
      throw new HttpError('Booking must be in progress to complete', 400)
    }

    const result = await query(
        `Update bookings
        Set status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        Where id = $1
        Returning id, status, completed_at`,
        [bookingId]
    )

    // UPDATED PROVIDER COMPLETED_JOBS COUNT
    await query(
        `Update provider_profiles 
        Set completed_jobs = completed_jobs + 1
        Where user_id = $1`,
        [provider_id]
    )

    res.status(200).json({
      message: 'Booking completed',
      booking: result.rows[0],
    })


  } catch (err) {
    next(err)
  }
}


// ── CANCEL BOOKING ────────────────────────────────────────────
// What: customer or provider cancels booking
// When: PATCH /api/v1/bookings/:bookingId/cancel
// Who:  customer or provider
export const cancelBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId } = req.params
    const user_id = req.user!.userId

    // Validate optional body
    const parsed = cancelBookingSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(
        JSON.stringify(parsed.error.flatten().fieldErrors), 400
      )
    }
    const { cancellation_reason } = parsed.data

    const bookingResult = await query(
      'SELECT id, customer_id, provider_id, status FROM bookings WHERE id = $1',
      [bookingId]
    )
    if (bookingResult.rows.length === 0) {
      throw new HttpError('Booking not found', 404)
    }

    const booking = bookingResult.rows[0]

    // Only participants can cancel
    if (booking.customer_id !== user_id &&
        booking.provider_id !== user_id) {
      throw new HttpError('Not authorized', 403)
    }

    // Can't cancel completed or already cancelled
    if (['completed', 'cancelled', 'disputed'].includes(booking.status)) {
      throw new HttpError(`Cannot cancel a ${booking.status} booking`, 400)
    }

    const result = await query(
      `UPDATE bookings
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancellation_reason = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, cancelled_at, cancellation_reason`,
      [cancellation_reason ?? null, bookingId]
    )

    res.status(200).json({
      message: 'Booking cancelled',
      booking: result.rows[0],
    })

  } catch (err) {
    next(err)
  }
}