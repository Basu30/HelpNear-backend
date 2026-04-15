import { Router } from "express";
import { authMiddleware, requireRole } from "@middleware/auth.middleware";

import { 
    getProviders,
    getOwnProfile,
    getProviderById,
    updateProfile,
    getProviderJobs,
    updateCategories,
} from "@controllers/provider_controller";

const providerRouter = Router()

// PUBLIC
providerRouter.get('/providers',            getProviders)
providerRouter.get('/providers/:providerId',getProviderById)

// PROTECTED - MUST BE LOGGED IN
providerRouter.get('/provider/profile',     authMiddleware, requireRole('provider'), getOwnProfile)
providerRouter.get('/provider/jobs',        authMiddleware, requireRole('provider'), getProviderJobs)
providerRouter.patch('/provider/profile',   authMiddleware, requireRole('provider'), updateProfile)
providerRouter.post('/provider/categories', authMiddleware, requireRole('provider'), updateCategories)

// DYNAMIC ROUTE


export default providerRouter