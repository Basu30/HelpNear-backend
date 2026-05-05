import { Router } from "express";
import { 
    createProviderReview,
    createCustomerReview,
    getCustomerReviews,
    getProviderReviews
} from "@controllers/review_controller";

import { authMiddleware, requireRole } from "@middleware/auth.middleware";

const reviewRouter = Router();

reviewRouter.post('/bookings/:bookingId/provider-review', authMiddleware, requireRole('provider'), createCustomerReview)
reviewRouter.post('/bookings/:bookingId/customer-review', authMiddleware, requireRole('customer'), createProviderReview)
reviewRouter.get('/bookings/:providerId/reviews', authMiddleware, getProviderReviews)
reviewRouter.get('/bookings/:customerId/reviews', authMiddleware, getCustomerReviews)

export default reviewRouter;