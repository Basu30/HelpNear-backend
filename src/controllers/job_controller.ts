import { Request, Response, NextFunction } from 'express';
import { query } from '@db'
import { jobRequestSchema } from '@validators/job.validator';
import HttpError  from '@utils/http-error'

// --------- CREATE JOB -------------------------------------------------

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
            `Insert into job_requests
                ( customer_id, category_id, title, 
                description, budget_min, budget_max, city, 
                district, preferred_date, preferred_time )

            Values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)

            Returning id, customer_id, category_id, title, 
                      description, budget_min, budget_max, city, 
                      district, preferred_date, preferred_time, 
                      status, created_at, updated_at`,

            [
                customer_id, category_id, title, 
                description, budget_min ?? null, budget_max ?? null, 
                city, district ?? null , preferred_date ?? null, preferred_time ?? null
            ]
        )

      
        
        res.status(201).json({
            message: 'Job request created successfully',
            job: jobResult.rows[0]
        })
    } catch (err) {
        next(err)
    }
}

// --------------- GET ALL OPEN JOBS (with pagination) ------------------------------------------------

export const getAllJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    
    try {
        const page = Number(req.query.page) || 1
        const limit = Number(req.query.limit) || 10
        const offset = (page - 1) * limit

        const result = await query(
            `Select 
                id, title, description, budget_min, budget_max, 
                city, district, preferred_date, preferred_time, 
                created_at, updated_at
            From job_requests 
            Where status = 'open'
            Order by created_at DESC
            Limit $1 offset $2`,
            [limit, offset]
        )

        res.status(200).json({
            jobs: result.rows,
            count: result.rowCount,
            page,
            limit
        })

    } catch (err) {
        next(err)
    }
}

// ------------- GET CUSTOMER'S OWN JOBS --------------------------------------------------

export const getJobForCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    const customer_id = req.user?.userId
    try {
        const result = await query(
            `Select 
                id, customer_id, title, description, budget_min, budget_max, 
                city, district, preferred_date, preferred_time, 
                created_at, updated_at
            From job_requests 
            Where customer_id = $1`,
            [customer_id]
        )

        res.status(200).json({
            jobs: result.rows,
            count: result.rowCount
        })
    } catch (err) {
        next(err)
    }
}

// ------------- GET JOB BY ID ---------------------------------------------

export const getJobById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    
    const { jobId } = req.params;

    try {
        const result = await query(
            `Select 
                id, customer_id, title, description, budget_min, budget_max, 
                city, district, preferred_date, preferred_time, status,
                selected_quote_id, created_at, updated_at
            From job_requests 
            Where id = $1`,
            [jobId]
        )

        if (result.rows.length === 0) {
            throw new HttpError('Job not found', 404)
        }

        res.status(200).json({
            job: result.rows[0]
        })
    } catch (err) {
        next(err)
    }
}