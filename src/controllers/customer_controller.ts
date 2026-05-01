import HttpError  from '@utils/http-error'
import { query } from '@db'
import { Request, Response, NextFunction } from 'express'


// GET ALL CUSTOMERS
/**
 * What: returns all customers - admin only
 * When: GET /api/v1/customers
 * Why: HttpError: if something goes wrong we throw a typed error instead of a generic 500
 */
const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await query(
            `Select 
                u.id, u.full_name, u.email, u.phone,
                cp.city, cp.district, cp.default_address, 
                cp.average_rating, cp.total_reviews, cp.total_completed_bookings,
                cp.total_cancelled_bookings, cp.created_at
            From users u
            Join customer_profiles cp ON cp.user_id = u.id
            Where role = 'customer'
            And u.is_active = true
            Order by cp.average_rating DESC`,
          
    )
        res.status(200).json({
            customers: result.rows,
            count: result.rowCount
        })
    } catch (err) {
        next(err)
    }
}
export default getCustomers;

