import { Request, Response, NextFunction } from 'express';
import { query } from '../db'
import { jobRequestSchema } from '@validators/job.validator';
import  HttpError  from '../utils/http-error'

export const createJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parsed = jobRequestSchema.safeParse(req.body)

        if(!parsed.success) {
            const errors = parsed.error.flatten().fieldErrors
            throw new HttpError(JSON.stringify(errors), 400)
        }

        const { category_id, title, description, budget_max, budget_min, city, district, preferred_date, preferred_time } = parsed.data

        
        const customer_id = req.user!.userId

        const category = await query(
            `Select id 
            From service_categories 
            Where id = $1 
            AND is_active = true`,
            [category_id]
        )

        if (category.rows.length === 0) {
            throw new HttpError('Category not found', 404)
        }
     
        const jobResult = await query(
            `Insert into job_request
                ( customer_id, category_id, title, 
                description, budget_min, budget_max, city, 
                district, preferred_date, preferred_time )

            Values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)

            Returning id, customer_id, category_id, title, 
                      description, budget_min, budget_max, city, 
                      district, preferred_date, preffered_time, 
                      status, created_at, updated_at`,

            [
                customer_id, category_id, title, 
                description, budget_max ?? null, budget_min ?? null, 
                city, district ?? null , preferred_date ?? null, preferred_time ?? null
            ]
        )

        const newJob = jobResult.rows[0]    
        
        res.status(201).json({
            message: 'Job Request Created successfully',
            job: newJob
        })
    } catch (err) {
        next(err)
    }
}