import { Request, Response, NextFunction } from 'express'
import { query } from '@db'


// GET CATEGORIES
export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
        const result = await query(
            'Select * From service_categories'
        )

        res.status(200).json({ categories: result.rows})
    } catch (err) {
        next(err)
    }
}
