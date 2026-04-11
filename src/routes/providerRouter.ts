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

providerRouter.get('/providers',            getProviders)
providerRouter.get('/provider/profile',     authMiddleware, requireRole('provider'), getOwnProfile)
providerRouter.get('/provider/:providerId', authMiddleware, getProviderById)
providerRouter.patch('/provider/profile',   authMiddleware, requireRole('provider'), updateProfile)
providerRouter.get('/provider/jobs',        authMiddleware, requireRole('provider'), getProviderJobs)
providerRouter.post('/provider/categories', authMiddleware, requireRole('provider'), updateCategories)

export default providerRouter