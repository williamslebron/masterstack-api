import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_in_prod';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '30d';

export interface JwtPayload {
    userId: string;
    email: string;
}

/** Signs a JWT with userId + email. Returns the token string. */
export function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

/** Verifies and decodes a JWT. Returns the payload or null if invalid/expired. */
export function verifyToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, SECRET) as JwtPayload;
    } catch {
        return null;
    }
}

/** Extracts the Bearer token from an Authorization header string. */
export function extractBearer(authHeader: string | undefined): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
}
