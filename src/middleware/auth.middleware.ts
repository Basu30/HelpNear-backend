import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type TokenPayload } from "@utils/jwt";
import HttpError from "@utils/http-error";


/*
  What: extends Express Request type to include user property
  Why: by default Request has no .user - TypeScript would error

  JavaScript: you just did req.user = payload — no type checking
  TypeScript: you must declare the new property properly
*/
declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload  // now req.user is valid everywhere
        }
    }
}

// ----------------- AUTH MIDDLEWARE --------------------------------------

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        /*
          What: read Authorization header
          Format: "Bearer enguUTGOyhweo..."
          Why: this is the standard HTTP auth header format
        */
        const authHeader = req.headers.authorization

        if(!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new HttpError('No token provided', 401)
        }

        /* What: split "Bearer <token>" and take the token part */
        const token = authHeader.split(' ')[1]

        /*
          What: verify throws if token is expired or tampered
          Why: jwt.verify checks the signature using your JWT_ACCESS_SECRET
               if someone fakes a token, signature won't match -> throws
        */
        const payload = verifyAccessToken(token)

        /*
          What: attach decoded payload to req so controllers can use it
          Why:  controllers need userId to query only that user's data
          When: after this line, every controller can access req.user.userId
        */
        req.user = payload

        /*
          What: call next() to proceed to the controller
          Why: middleware must call next() or the request hangs forever
        */
        next()

    } catch (err) {
        next(new HttpError('Invalid or expired token', 401))
    }
}

// ---------------------- ROLE MIDDLEWARE ------------------------------------
  /*
    What: checks if logged-in user has the required role
    Why:  authMiddleware only checks IF logged in — not WHAT role
    When: used on routes that only admins or only providers can access
    Usage: router.get('/admin/users', authMiddleware, requireRole('admin'), handler) 
  */

export const requireRole = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        /*
          What: req.user was attached by authMiddleware above
          Why: requireRole always comes AFTER authMiddleware in the chain
        */
        if (!req.user || !roles.includes(req.user.role)) {
            next(new HttpError('Forbidden - insufficient permissions', 403))
            return
        }
        next()
    }
}