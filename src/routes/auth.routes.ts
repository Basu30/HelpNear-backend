import { Router } from "express";
import { 
    register, 
    login, 
    getMe, 
    refresh, 
    logout 
} from "@controllers/auth.controller";
import { authMiddleware } from "@middleware/auth.middleware";

const router = Router();

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)

// What: authMiddleware runs first - verifies token
//       then getMe runs - returns user data
router.get('/me', authMiddleware, getMe)

export default router