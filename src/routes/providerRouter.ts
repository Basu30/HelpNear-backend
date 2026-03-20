import { Router } from "express";

import getProviders from "@controllers/provider_controller";

const providerRouter = Router()

providerRouter.get('/', getProviders)

export default providerRouter