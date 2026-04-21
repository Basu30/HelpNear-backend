import { Router } from "express";
import { 
    getBookingById, 
    getCustomerBookings, 
    getProviderBookings, 
    startBooking, 
    completeBooking, 
    cancelBooking 
} from "@controllers/booking_controller";
import { authMiddleware, requireRole } from "@middleware/auth.middleware";

const bookingRouter = Router()


bookingRouter.get('/customer/bookings', authMiddleware, requireRole('customer'), getCustomerBookings)
bookingRouter.get('/provider/bookings', authMiddleware, requireRole('provider'), getProviderBookings)
bookingRouter.get('/bookings/:bookingId', authMiddleware, getBookingById)

bookingRouter.patch('/bookings/:bookingId/start', authMiddleware, requireRole('provider'), startBooking)
bookingRouter.patch('/bookings/:bookingId/complete', authMiddleware, requireRole('provider'), completeBooking)
bookingRouter.patch('/bookings/:bookingId/cancel', authMiddleware, cancelBooking)

export default bookingRouter