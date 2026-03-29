import HttpError from '../utils/http-error';
import { query } from '../db/index'
import { Request, Response, NextFunction } from 'express'


// GET ALL CUSTOMERS
const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await query("select * from users where role = 'customer'")
        res.json(result.rows)
    } catch (err) {
        next(err)
    }
}
export default getCustomers;

