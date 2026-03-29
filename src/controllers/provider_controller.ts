import HttpError from '../utils/http-error';
import { query } from '../db/index'
import { Request, Response, NextFunction } from 'express'


// GET ALL PROVIDERS
const getProviders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await query("select * from users where role = 'provider'")
        res.json(result.rows)
    } catch (err) {
        next(err)
    }
}
export default getProviders;

