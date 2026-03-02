import bcrypt from 'bcryptjs';

const ROUNDS = 12;

/** Hashes a plain-text password. Returns the bcrypt hash string. */
export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, ROUNDS);
}

/** Compares a plain-text password against a stored hash. Returns true if they match. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}
