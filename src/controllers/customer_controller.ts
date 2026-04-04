// import { HttpError } from '@utils/http-error'
import { query } from '../db'
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
                id, full_name, email, phone, role,
                is_active, is_email_verified, created_at
            From users 
            Where role = $1`,
            ['customer']
    )
        res.json({ customers: result.rows })
    } catch (err) {
        next(err)
    }
}
export default getCustomers;

