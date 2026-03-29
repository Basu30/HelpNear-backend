import { z } from 'zod';

// REGISTER SCHEMA
export const registerSchema = z.object({
    full_name: z
        .string()
        .min(2, 'Name too short')
        .max(120, 'Name too long'),
    
    email: z
        .string()
        .email('Invalid email format'),

    password: z
        .string()
        .min(8, 'Password must be at least 8 characters'),

    phone: z
        .string()
        .max(30)
        .optional(),
    
    role: z.enum(['customer', 'provider'])   // matches DB check constraint
                                             // admin cannot self-register
})

// LOGIN SCHEMA   ->    Validates login request body
export const loginSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password required')
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginSchema = z.infer<typeof loginSchema>