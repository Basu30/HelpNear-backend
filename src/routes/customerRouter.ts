import { Router } from "express";
import { authMiddleware, requireRole } from "@middleware/auth.middleware";

import getCustomers from "@controllers/customer_controller";

const customerRouter = Router()

customerRouter.get('/customers', authMiddleware, requireRole('admin'), getCustomers)

export default customerRouter;