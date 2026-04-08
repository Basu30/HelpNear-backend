import { Router } from "express";

import { getCategories } from "@controllers/category_controller";

const categoryRouter = Router();

categoryRouter.get('/category', getCategories)

export default categoryRouter