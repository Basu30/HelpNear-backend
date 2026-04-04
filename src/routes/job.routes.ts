import { Router } from "express";
import { createJob } from "@controllers/job_controller";

const jobRouter = Router()

jobRouter.post('/job', createJob)

export default jobRouter