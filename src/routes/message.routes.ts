import { Router } from "express";
import { 
    getMessages, 
    sendMessage 
} from "@controllers/message_controller";
import { authMiddleware } from "@middleware/auth.middleware";

const messageRouter = Router()

messageRouter.get('/bookings/:bookingId/messages', authMiddleware, getMessages)
messageRouter.post('/bookings/:bookingId/messages', authMiddleware, sendMessage)

export default messageRouter;