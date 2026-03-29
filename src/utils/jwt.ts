import * as jwt from 'jsonwebtoken';

// SHAPE OF DATA STORED INSIDE THE TOKEN
export type TokenPayload = {
    userId: string
    role: 'customer' | 'provider' | 'admin'
}

// ACCESS TOKEN
  /* 
    What: short-lived token sent in Authorization header
    When: created on login, used on every protected request
    Why 15m: short enough that stolen tokens expire quickly
  */

export function generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(
        payload,
        process.env.JWT_ACCESS_SECRET!,     // !  tells TypeScript 'Trust me, this exists'
        { expiresIn: '15m'}
    )
}

// REFRESH TOKEN
  /*
    What: long-lived token stored in httpOnly cookie
    When: created on login, used only to get new access tokens
    Why different secret: if one secret leaks, the other is still safe
  */

export function generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign (
        payload,
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '7d'}
    )
}

// VERIFY ACCESS TOKEN
  /*
    What: Checks fi a token is valid and not expired
    Why: used in auth middleware to protect routes
    Returns: the decoded payload ( userId + role) or throws if invalid
  */
export function verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET! 
    ) as TokenPayload
}

// VERIFY REFRESH TOKEN
export function verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET!,
    ) as TokenPayload
}