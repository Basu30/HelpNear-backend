import { Router } from "express";

import getCustomers from "@controllers/customer_controller";

const customerRouter = Router()

customerRouter.get('/customers', getCustomers)

export default customerRouter;