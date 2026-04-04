import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import bcrypt from 'bcrypt';
import { query, withTransaction } from '../db';
import HttpError from "@utils/http-error";
import { registerSchema } from "@validators/auth.validator";
import { loginSchema } from "@validators/auth.validator";
import { type TokenPayload, generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken} from '../utils/jwt'



// ---------------------------------- REGISTER ---------------------------------

/* *******************************************************************************
                THE REGISTER DOES 5 THINGS IN ORDER:
  1. Validate the input     ->   is email valid? is password long enough?
  2. Check email not taken  ->   Select from users Where email = 1$
  3. Hash the password      ->   bcrypt turns 'Password123' into '$2b$10$...'
  4. Create user + profile  ->   Insert into users AND customer/provider_profiles
  5. Return response        ->   Send back user data (never the password hash)

********************************************************************************* */

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    
    try {
         console.log("req.body: ", req.body)
        // VALIDATE INPUT
        const parsed = registerSchema.safeParse(req.body)        // Zod checks the request body against registerSchema
        
        if(!parsed.success) {
            const errors = parsed.error.flatten().fieldErrors    // .flatten() converts Zod errors into readable field-by-field messages
            throw new HttpError(JSON.stringify(errors), 400)     // Example: { fieldErrors: {email: ['Invalid email format]}}
        }

        const { full_name, email, password, phone, role } = parsed.data

       
        // CHECK EMAIL NOT ALREADY TAKEN
        const existing = await query(                            // Query the users table for existing email
            'Select id from users where email = $1',
            [email]
        );

        if (existing.rows.length > 0) {
            throw new HttpError('Email already registered', 409)  // 409 Conflict response
        }

        // HASH PASSWORD + CREATE USER + PROFILE

          /* bcrypt.hash turns plain password into a secure hash */
        const password_hash = await bcrypt.hash(password, 10)

          /* withTransaction wraps all DB inserts in BEGIN/COMMIT/ROLLBACK*/
        const newUser = await withTransaction (async (client) => {

          /* INSERT user and return the created row immedietely */
            const userResult = await client.query(
                `Insert into users
                    (full_name, email, password_hash, phone, role)
                Values 
                    ($1, $2, $3, $4, $5)
                Returning id, full_name, email, password_hash, phone, role,
                    is_active, is_email_verified, created_at`,
                [full_name, email, password_hash, phone ?? null, role]
            )

            const user = userResult.rows[0]

          /* Create the matching profile based on role */
            if (role === 'customer') {
                await client.query(
                    `Insert into customer_profiles (user_id) Values ($1)`,
                    [user.id]
                )
            } else if (role === 'provider') {
                await client.query(
                    `Insert into provider_profiles (user_id) Values ($1)`,
                    [user.id]
                )
            }

            /* Return the user object from the transaction */
            return user
        })

        // SEND RESPONSE
          /* 201 = Created - standard HTTP code for successful creation */
        res.status(201).json({
            message: 'Registration successful',
            user: newUser,
        })
    } catch (err) {
        next(err)
    }
}

//  ------------------------------- LOGIN ------------------------------------------
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // VALIDATE INPUT
        const parsed = loginSchema.safeParse(req.body)
        if(!parsed.success) {
            throw new HttpError(JSON.stringify(parsed.error.flatten().fieldErrors), 400)
        }

        const { email, password } = parsed.data

        // FIND USER BY EMAIL
          /*
            What: SELECT the user including password_hash for comparison 
            Why: we need password_hash to verify - only here, never sent to frontend 
          */
        const result = await query(
            `Select id, full_name, email, password_hash, role, is_active
             From users Where email = $1`,
            [email]
        )

        const user = result.rows[0]

          /* 
            What: if no user found, return 401 - same message as wrong password
            Why: never say "email not found" - that tells attackers valid emails
                 always say "invalid credentials" for both cases
          */
        if(!user) {
            throw new HttpError('Invalid credentials', 401)
        }

          /*
            What: check if account is active
            Why: admin can deactivate accounts - inactive users cannot login
          */
        if(!user.is_active){
            throw new HttpError("Account is deactivated", 403)
        }

        // COMPARE PASSWORD
          /*
            What: bcrypt.compare checks plain password against stored hash
            Why: bcrypt hashes are ony-way - I can't reverse them
                 compare() rehashes the plain password and checks if they match
          */
        const isMatch = await bcrypt.compare(password, user.password_hash)

        if(!isMatch) {
            throw new HttpError('Invalid credentials', 401)
        }

        // GENERATE TOKENS
        const payload: TokenPayload = {
            userId: user.id,
            role: user.role
        }

        const accessToken = generateAccessToken(payload)
        const refreshToken = generateRefreshToken(payload)

        // SEND TOKENS  
          /*
            What: refresh token goes in httpOnly cookies
            Why: JavaScript cannot read httpOnly cookies - safe fron XSS attacks
          */
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,                                  // JS cannot read this cookie
            secure: process.env.NODE_ENV === 'production',   // HTTP only in production
            sameSite: 'strict',                              // prevents CSRF attacks
            maxAge: 7 * 24 * 60 * 60 * 1000                  // 7 days in milliseconds
        })

          /*
            What: access token goes in response body
            Why: frontend stores this in memory ( not localStorage) 
                 and sends it in Authorization header on every request
          */
        
        res.json({ 
            accessToken, 
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
            },
        })
    } catch (err) {
        next(err)
    }
}

// ----------------------- GET ME ------------------------------------------------
  /* 
    What: returns current logged-in user from their access token
    When: GET /api/auth/me -- called by frontend on app load
    Why: frontend needs to know who is logged in after page refresh
  */
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        /*
          What: req.user is attached by auth middleware (built next)
          When: middleware already verified the token and put userId on req
        */
        const userId = (req as any).user.userId

        const result = await query(
            `Select id, full_name, email, phone, role, is_active, is_verified, created_at
            From users Where id = $1`, 
            [userId]
        )

        if (!result.rows[0]) {
            throw new HttpError('User not found', 404)
        }

        res.json({ user: result.rows[0] })
    } catch (err) {
        next(err)
    }
}

// ----------------------- REFRESH TOKEN ------------------------------------------
  /*
    What: issues a new access token using the refresh token cookie
    When: POST /api/auth/refresh -- called when access token expires
    Why: access token lasts 15min -- without refresh, user logs out every 15min
  */

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        /*
          What: read refresh token from httpOnly cookie
          Why: it was stored there on login -- not in the request body
        */
        const token = req.cookies?.refreshToken

        if(!token) {
            throw new HttpError('No refresh token', 401)
        }

        
        /* Verify the refresh token -- throw if expired or tampered */
        const payload = verifyRefreshToken(token)

        /* Issue a brand new access token with same userId + role */
        const accessToken = generateAccessToken({
            userId: payload.userId,
            role: payload.role,
        })

        res.json({ accessToken })
    } catch (err) {
        next(err)
    }
}

// ---------------------------- LOGOUT ------------------------------------
  /*
    What: clears the refresh token cookie
    When: POST /api/auth/logout
    Why: access token expires on its own (15min)
         refresh token must be actively cleared from cookie
  */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        /*
          What: clearCookie removes the httpOnly cookie from the browser
          Why: without this, refresh token stays valid for 7 days even after logout
        */
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        })

        res.json({ message: 'Logged out successfully' })
    } catch (err) {
        next(err)
    }
}