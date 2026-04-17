import { z } from "zod";

export const quoteSchema = z.object({
    price: z.coerce
        .number()
        .positive('Price must be positive'),

    message: z
        .string()
        .optional(),

    estimated_time: z
        .string()
        .min(1)
        .max(100, 'Too long')
        .optional()

})

export type QuoteInput = z.infer< typeof quoteSchema >