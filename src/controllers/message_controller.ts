import { Request, Response, NextFunction } from "express";
import { query } from "@db";
import HttpError from "@utils/http-error";


// ------------ Helper -- GET COVERSATION_ID AND VERIFY OWNERSHIP ----------------------------
async function getConversationId(bookingId: string, userId: string): Promise<string> {
    
    // Check booking exists and user is a participant
    const bookingResult = await query(
        `SELECT id, customer_id, provider_id
        FROM bookings WHERE id = $1`,
        [bookingId]
    )

    if (bookingResult.rows.length === 0) {
        throw new HttpError('Booking not found', 404)
    }

    const booking = bookingResult.rows[0]

    // Ownership check — only participants can message
    if (booking.customer_id !== userId &&
        booking.provider_id !== userId) {
        throw new HttpError('Not authorized', 403)
    }

    // Get conversation linked to this booking
    const convResult = await query(
        `SELECT id FROM conversations WHERE booking_id = $1`,
        [bookingId]
    )

    if (convResult.rows.length === 0) {
        throw new HttpError('Conversation not found', 404)
    }

    return convResult.rows[0].id
}

// -------------- GET MESSAGES -------------------------------
  /**
   * What: load message history for a booking
   * Who: customer or provider of that booking
   */
export const getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
        const { bookingId } = req.params
        const userId = req.user!.userId
     

        // GET CONVERSTAION_ID + VERIFY OWNERSHIP
        const conversation_id = await getConversationId(bookingId, userId)

        const messageResult = await query(
            `SELECT
                m.id, m.conversation_id, m.sender_id,
                m.message_text, m.is_read, m.created_at,
                u.full_name AS sender_name
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at ASC`,
            [conversation_id]
        )

        // MARK MESSAGES AS READ
        await query(
            `Update messages Set is_read = true
            Where conversation_id = $1
            AND sender_id != $2
            AND is_read = false`,
            [ conversation_id, userId]
        )

        res.status(200).json({
            message: messageResult.rows,
            count: messageResult.rowCount
        })

    } catch (err) {
        next(err)
    }
}


//------------- SEND MESSAGE --------------------------------------
  /**
   * What: save a message to DB
   * Who: customer or provider of that message
   */
export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

    try {
        const userId = req.user!.userId;
        const { bookingId } = req.params;
        const { message_text } = req.body;

         // Validate message
        if (!message_text?.trim()) {
            throw new HttpError('Message cannot be empty', 400)
        }

         // Get conversation_id + verify ownership
        const conversation_id = await getConversationId(bookingId, userId)

       

        const sendResult = await query(
            `Insert into messages 
                (conversation_id, sender_id, message_text)

            values ($1, $2, $3)

            Returning 
                id, conversation_id, sender_id, message_text, is_read, created_at`,
           [ conversation_id, userId, message_text ]
        )

        const message = sendResult.rows[0];

        res.status(201).json({
            message
        })
    } catch (err) {
        next(err)
    }
}
