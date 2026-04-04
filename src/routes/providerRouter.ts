import { Router } from "express";
import { authMiddleware, requireRole } from "@middleware/auth.middleware";

import getProviders from "@controllers/provider_controller";

const providerRouter = Router()

providerRouter.get('/providers', authMiddleware, requireRole('admin'), getProviders)

export default providerRouter