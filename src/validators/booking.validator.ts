import { z } from 'zod'

export const cancelBookingSchema = z.object({
    cancellation_reason: z.string().optional()
})

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>