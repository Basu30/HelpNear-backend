import { Router } from "express";

import getProviders from "@controllers/provider_controller";

const providerRouter = Router()

providerRouter.get('/providers', getProviders)

export default providerRouter