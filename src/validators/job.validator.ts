import { z } from 'zod'

// JOB REQUEST SCHEMA
export const jobRequestSchema = z.object({
    category_id: z
        .string()
        .uuid('Invalid category ID'),

    title: z
        .string()
        .min(5, 'Title too short')
        .max(200, 'Title too long'),

    description: z
        .string()
        .min(1, 'Description required'),

    budget_min: z
        .number()
        .positive('Must be positive')
        .optional(),
    
    budget_max: z
        .number() 
        .positive('Must be positive')
        .optional(),
    city: z
        .string()
        .min(2, 'City too short')
        .max(100, 'City too long'),

    district: z
        .string()
        .max(100)
        .optional(),

    preferred_date: z
        .string()
        .optional(),

    preferred_time: z
        .string()
        .max(50)
        .optional(),
} )

export type JobRequestInput = z.infer< typeof jobRequestSchema >