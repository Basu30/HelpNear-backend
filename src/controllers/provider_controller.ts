import HttpError from '@utils/http-error';
import { query, withTransaction } from '@db';
import { Request, Response, NextFunction } from 'express';
import { 
    providerProfileSchema, 
    providerCategoriesSchema,
} from '@validators/provider.validator';


// ------------------- GET ALL PROVIDERS (public) ----------------------------------
  /**
   * What: returns all active providers with their profile data
   * Who: anyone who logged in
   */
export const getProviders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await query(
            `Select 
                u.id, u.full_name, u.email, u.phone, 
                pp.bio, pp.experience_years, pp.city, pp.district,
                pp.is_verified, pp.average_rating, pp.total_reviews, 
                pp.completed_jobs, pp.created_at
                From users u
                Join provider_profiles pp ON pp.user_id = u.id
                Where u.role = 'provider'
                And u.is_active = true
                Order by pp.average_rating DESC`,
        )
        res.json({ 
            provider: result.rows,
            count: result.rowCount,
        })
    } catch (err) {
        next(err)
    }
}

// ------------------- GET OWN PROFILE ---------------------------
  /** 
   * What: provider fetches their own profile
   */
export const getOwnProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    const provider_id = req.user?.userId;

    try {
        const result = await query(
            `Select 
                id, bio, experience_years, 
                city, district, average_rating, 
                total_reviews, completed_jobs_count
            From provider_profiles
            Where user_id = $1 `,
            [provider_id]
        )

        if (result.rows.length === 0) {
            throw new HttpError('Profile not found', 404)
        }

        res.status(200).json({
            profile: result.rows[0]        
        })
    } catch (err) {
        next(err)
    }
}


// ---------------- GET PROVIDER BY ID (public) -------------------------------------
  /**
   * What public profile of a specific provider
   * Who: anyone who loggod in - customers view before hiring
   */
export const getProviderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    
    try {

        const { providerId } = req.params;

        const result = await query(
            `Select 
                u.id, u.full_name, u.email, u.phone,
                pp.bio, pp.experience_years, pp.city, pp.district,
                pp.is_verified, pp.average_rating, pp.total_reviews,
                pp.completed_jobs_count, u.created_at
            From users u
            Join provider_profiles pp ON pp.user_id = u.id
            Where u.id = $1
            AND u.is_active = true`,
            [providerId]
        )

        if (result.rows.length === 0) {
            throw new HttpError('Provider not found', 404)
        }

        res.status(200).json({
            provider: result.rows[0]
        })
    } catch (err) {
        next(err)
    }
}


// -------------------- UPDATE PROFILE -----------------------------------
  /**
   * What: provider updates their profile details
   * Who: provider only
   */
export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    
    try {

        const parsed = providerProfileSchema.safeParse(req.body)

        if (!parsed.success) {
            const error = parsed.error.flatten().fieldErrors
            throw new HttpError(JSON.stringify(error), 400)
        }

        // GET FIELDS - ALL OPTIONAL, PROVIDER UPDATES WHAT THEY WANT
        const { bio, experience_years, city, district } = parsed.data;

        const user_id = req.user?.userId;

        // UPDATE
            /**
             * What COALESCE: returns first non-null value
             * Why: provider may only update bio, not city 
             *      without COALESCE, city would be overwritten with null 
             *      with COALESCE, city its current value if $3 is null
             * 
             * Example: COALESCE($1, bio)
             *          -- if $1 (new value) is null -> keep existing bio
             *          -- if $1 has a value -> use new value
             */
        const result = await query(
            `Update provider_profiles
            Set 
                bio              = coalesce($1, bio),
                experience_years = coalesce($2, experience_years),
                city             = coalesce($3, city),
                district         = coalesce($4, district),
                updated_at       = NOW()
            Where user_id = $5
            Returning 
                id, user_id, bio, experience_years, 
                city, district, is_verified, 
                average_rating, total_reviews, completed_jobs_count, 
                created_at, updated_at`,

            [bio ?? null, experience_years ?? null, city ?? null, district ?? null, user_id]
        )

        if (result.rows.length === 0) {
            throw new HttpError('Profile not found', 404)
        }

        res.status(200).json({
            message: 'Profile updated successfully',
            profile: result.rows[0]
        })
    } catch (err) {
        next(err)
    }
}


// ----------------- PROVIDER CATEGORIES ------------------------------------
  /**
   * What: saves which service categories this provider offers
   * Who: provider only 
   */
export const updateCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {

        const parsed = providerCategoriesSchema.safeParse(req.body)

        if (!parsed.success) {
            throw new HttpError(JSON.stringify(parsed.error.flatten().fieldErrors), 400)
        }

        const { category_ids } = parsed.data
        const user_id = req.user?.userId

        /**
         * What: Get provider profile id
         * Why: provider_categories uses profile id not user id
         * provider_profiles.id ≠ users_id - they are different UUIDs
        */

        const profileResult = await query(
            `Select id 
                From provider_profiles 
                where user_id = $1`,
            [user_id]
        )

        if (profileResult.rows.length === 0) {
            throw new HttpError('Provider profile not found', 404)
        }

        const profileId = profileResult.rows[0].id

        /**
         * What: Delete existing + insert new in one transaction
         * Why transaction: if any insert fails, delete is also undone
        */
        await withTransaction(async (client) => {
            /**
             * What: Delete all exsiting categories for this provider
             * Why: easiet to replace all then to diff old vs new
             */
            await client.query(
                `Delete 
                    From provider_categories 
                    Where provider_profile_id = $1`,
                [profileId]
            )

            /**
             * What: insert each new category one by one
             * Why loop: one Insert per category - simple and clear
             */
            for (const category_id of category_ids) {
                await client.query(
                    `Insert Into provider_profiles
                        (provider_profile_id, category_id)
                    Values ($1, $2)`,
                [profileId, category_id]
                )
            }
        })

        res.status(200).json({
            message: 'Categories updated successfully'
        })

    } catch (err) {
        next(err)
    }
}

// --------------------- GET JOBS MATCHING PROVIDER -------------------------------
  /**
   * What: returns open jobs that match provider's categories AND areas
   */
export const getProviderJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    
    try {
        
        const user_id = req.user?.userId

        // GET PROVIDER PROFILE ID
        const profileResult = await query(
            `Select id 
                From provider_profiles
                Where user_id = $1`,
            [user_id]
        )

        if (profileResult.rows.length === 0) {
            throw new HttpError('Provider not found', 404)
        }

        const providerId = profileResult.rows[0].id
        
        /**
         * What: Get marching jobs
         * DISTINCT: prevents duplicate jobs when provider covers
         *           multiple districts that both match one job
         * JOIN 1: matches job category to provider's categories
         * JOIN 2: matches job location to provider's service areas
         * WHERE: only open jobs - not booked/completed/cancelled
         */
        const result = await query(
            `Select Distinct
                jr.id, jr.customer_id, jr.category_id,
                jr.title, jr.description,
                jr.budget_min, jr.budget_max,
                jr.city, jr.district,
                jr.preferred_date, jr.preferred_time,
                jr.status, jr.created_at
            From job_requests jr
            Join provider_categories pc
            On pc.category_id = jr.category_id
            Join service_areas sa
            on sa.city = jr.city
            And sa.district = jr.district
            Where pc.provider_profile_id = $1
            And sa.provider_profile_id = $1
            And jr.status = 'open'
            Order by jr.created_at DESC`,
            [providerId]
        )

        res.status(200).json({
            jobs: result.rows,
            count: result.rowCount
        })
    } catch (err) {
        next(err)
    }
}