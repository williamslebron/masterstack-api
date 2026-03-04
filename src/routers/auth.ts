import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { v4 as uuidv4 } from 'uuid';
import { router, publicProcedure, protectedProcedure } from '../middleware/trpc';
import { db } from '../db/client';
import { users, passwordResets, emailVerifications } from '../db/schema';
import { signToken } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/hash';

/** Generates a random uppercase hex token of a given byte-length. */
function randomToken(bytes: number): string {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export const authRouter = router({
    /**
     * Registers a new user account.
     * Returns a JWT token and the user record.
     * Also creates an email verification token (shown in admin dashboard).
     */
    register: publicProcedure
        .input(z.object({
            email: z.string().email(),
            name: z.string().min(1).max(80),
            password: z.string().min(8),
        }))
        .mutation(async ({ input }) => {
            // Check duplicate email
            const existing = await db.query.users.findFirst({ where: eq(users.email, input.email.toLowerCase()) });
            if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'An account with this email already exists.' });

            const id = uuidv4();
            const passwordHash = await hashPassword(input.password);
            const now = new Date();

            await db.insert(users).values({
                id,
                email: input.email.toLowerCase(),
                name: input.name,
                passwordHash,
                isAdmin: false,
                emailVerified: false,
                createdAt: now,
            });

            // Create email verification token (6-char code)
            const verifyToken = randomToken(3); // 6 hex chars
            await db.insert(emailVerifications).values({
                id: uuidv4(),
                userId: id,
                token: verifyToken,
                createdAt: now,
            });

            const token = signToken({ userId: id, email: input.email.toLowerCase() });
            return { token, user: { id, email: input.email.toLowerCase(), name: input.name, emailVerified: false } };
        }),

    /**
     * Authenticates a user and returns a JWT token.
     */
    login: publicProcedure
        .input(z.object({
            email: z.string().email(),
            password: z.string(),
        }))
        .mutation(async ({ input }) => {
            const user = await db.query.users.findFirst({ where: eq(users.email, input.email.toLowerCase()) });
            if (!user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });

            const valid = await verifyPassword(input.password, user.passwordHash);
            if (!valid) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });

            const token = signToken({ userId: user.id, email: user.email });
            return { token, user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified } };
        }),

    /**
     * Returns the currently authenticated user's profile.
     */
    me: protectedProcedure.query(async ({ ctx }) => {
        const user = await db.query.users.findFirst({ where: eq(users.id, ctx.userId) });
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
        return { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified };
    }),

    /**
     * Verifies a user's email using the 6-char code visible in the admin dashboard.
     * Public — requires the token only, not a JWT.
     */
    verifyEmail: publicProcedure
        .input(z.object({ token: z.string().length(6) }))
        .mutation(async ({ input }) => {
            const record = await db.query.emailVerifications.findFirst({
                where: eq(emailVerifications.token, input.token.toUpperCase()),
            });
            if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid or expired verification code.' });

            await db.update(users)
                .set({ emailVerified: true })
                .where(eq(users.id, record.userId));

            // Remove the verification record once used
            await db.delete(emailVerifications).where(eq(emailVerifications.id, record.id));

            return { success: true };
        }),

    /**
     * Creates a password reset token for the given email.
     * Returns the token so it can be displayed in the admin dashboard and relayed to the user.
     * Expires after 1 hour.
     */
    requestReset: publicProcedure
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ input }) => {
            const user = await db.query.users.findFirst({ where: eq(users.email, input.email.toLowerCase()) });
            // Always return success to avoid email enumeration
            if (!user) return { message: 'If that email exists, a reset code has been generated.' };

            const token = randomToken(16); // 32-char hex
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

            await db.insert(passwordResets).values({
                id: uuidv4(),
                userId: user.id,
                token,
                expiresAt,
                used: false,
                createdAt: now,
            });

            return { message: 'If that email exists, a reset code has been generated.' };
        }),

    /**
     * Resets a user's password using a valid, unused reset token.
     * Token must be obtained from the admin dashboard.
     */
    resetPassword: publicProcedure
        .input(z.object({
            token: z.string().min(1),
            newPassword: z.string().min(8),
        }))
        .mutation(async ({ input }) => {
            const record = await db.query.passwordResets.findFirst({
                where: eq(passwordResets.token, input.token.toUpperCase()),
            });

            if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid reset code.' });
            if (record.used) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This reset code has already been used.' });
            if (new Date() > record.expiresAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Reset code has expired. Request a new one.' });

            const passwordHash = await hashPassword(input.newPassword);
            await db.update(users)
                .set({ passwordHash })
                .where(eq(users.id, record.userId));

            await db.update(passwordResets)
                .set({ used: true })
                .where(eq(passwordResets.id, record.id));

            return { success: true };
        }),

    /**
     * Resends (regenerates) the email verification code for the logged-in user.
     */
    resendVerification: protectedProcedure.mutation(async ({ ctx }) => {
        const verifyToken = randomToken(3);
        const now = new Date();

        // Upsert: delete old record if exists, insert new
        await db.delete(emailVerifications).where(eq(emailVerifications.userId, ctx.userId));
        await db.insert(emailVerifications).values({
            id: uuidv4(),
            userId: ctx.userId,
            token: verifyToken,
            createdAt: now,
        });

        return { message: 'New verification code generated. Check the admin dashboard.' };
    }),
});
