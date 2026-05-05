import { z } from 'zod'

export const reviewSchema = z.object({
    rating: z.coerce
        .number()
        .min(1)
        .max(5),

    comment: z
        .string()
        .optional()
})

export type ReviewInput = z.infer< typeof reviewSchema >