import HttpError from '../utils/http-error';
import { query } from '../db/index'
import { Request, Response, NextFunction } from 'express'


// GET ALL PROVIDERS
const getProviders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await query(
            `Select 
                id, full_name, email, phone, role,
                is_active, is_email_verified, created_at
                From users 
                Where role = $1`,
            ['provider']
        )
        res.json({ provider: result.rows })
    } catch (err) {
        next(err)
    }
}
export default getProviders;

