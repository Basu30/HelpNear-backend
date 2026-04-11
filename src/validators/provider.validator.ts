import { z } from 'zod'


export const providerProfileSchema = z.object({
    bio: z
        .string()
        .optional(),

    experience_years: z  
        .number()
        .positive('The experience years must be positive!')
        .optional(),

    city: z
        .string()
        .min(1, 'Too short city name')
        .max(100, 'Too long city name! Please enter less than 100 characters')
        .optional(),

    district: z
        .string()
        .min(1, 'Too short district name')
        .max(100, 'Too long district name! Please enter less than 100 characters')
        .optional(),
    
});

// PROVIDER SELECTS WHICH DESTRICT THEY COVER
export const serviceAreaSchema = z.object({
    city: z.string().min(1).max(100),
    district: z.string().min(1).max(100)
})

export const serviceAreasSchema = z.object({
    // ARRAY OF ARRAYS - PROVDER CAN COVER MULTIPLE DISTRICT
    areas: z.array(serviceAreaSchema).min(1, 'At least one area required')
})

// Categories
export const providerCategoriesSchema = z.object({
    category_ids: z
        .array(z.string().uuid('Invalid category ID'))
        .min(1, 'Select at leats one category')
})



export type ProviderProfileInput = z.infer< typeof providerProfileSchema >
export type ServiceAreasInput = z.infer< typeof serviceAreasSchema >
export type providerCategoriesInput = z.infer< typeof providerCategoriesSchema >