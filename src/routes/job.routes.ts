import { Router } from "express";
import { authMiddleware, requireRole } from "@middleware/auth.middleware";
import { 
    createJob, 
    getAllJobs, 
    getJobForCustomer,
    getJobById,
} from "@controllers/job_controller";


const jobRouter = Router()


jobRouter.post('/jobs', authMiddleware, requireRole('customer'), createJob);                  // Customer creates job
jobRouter.get('/jobs', authMiddleware, getAllJobs);                                           // All open jobs (providers browse)
jobRouter.get('/customer/jobs', authMiddleware, requireRole('customer'), getJobForCustomer);  // Customer sees their own jobs
jobRouter.get('/jobs/:jobId', authMiddleware, getJobById)                                     // Single job detail

export default jobRouter