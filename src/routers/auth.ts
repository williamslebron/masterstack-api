import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { v4 as uuid } from 'uuid';
import { router, publicProcedure, protectedProcedure } from '../middleware/trpc';
import { db } from '../db/client';
import { users } from '../db/schema';
import { hashPassword, verifyPassword } from '../lib/hash';
import { signToken } from '../lib/jwt';

/** Returns true if this email should be auto-granted admin (set via ADMIN_EMAIL env var). */
function isAdminEmail(email: string): boolean {
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
    return !!adminEmail && adminEmail === email.toLowerCase();
}

export const authRouter = router({
    /** Register a new user. Returns a JWT token on success. */
    register: publicProcedure
        .input(z.object({
            email: z.string().email(),
            name: z.string().min(1).max(80),
            password: z.string().min(8),
        }))
        .mutation(async ({ input }) => {
            const existing = await db.query.users.findFirst({
                where: eq(users.email, input.email.toLowerCase()),
            });
            if (existing) {
                throw new TRPCError({ code: 'CONFLICT', message: 'An account with this email already exists.' });
            }

            const passwordHash = await hashPassword(input.password);
            const id = uuid();
            const grantAdmin = isAdminEmail(input.email);

            await db.insert(users).values({
                id,
                email: input.email.toLowerCase(),
                name: input.name.trim(),
                passwordHash,
                isAdmin: grantAdmin,
                createdAt: new Date(),
            });

            const token = signToken({ userId: id, email: input.email.toLowerCase() });
            return { token, user: { id, email: input.email.toLowerCase(), name: input.name.trim(), isAdmin: grantAdmin } };
        }),

    /** Log in with email + password. Returns a JWT token on success. */
    login: publicProcedure
        .input(z.object({
            email: z.string().email(),
            password: z.string().min(1),
        }))
        .mutation(async ({ input }) => {
            const user = await db.query.users.findFirst({
                where: eq(users.email, input.email.toLowerCase()),
            });
            if (!user) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid email or password.' });
            }

            const valid = await verifyPassword(input.password, user.passwordHash);
            if (!valid) {
                throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });
            }

            // Auto-promote to admin if env var matches and not already admin
            if (!user.isAdmin && isAdminEmail(user.email)) {
                await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
            }

            const token = signToken({ userId: user.id, email: user.email });
            return {
                token,
                user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin || isAdminEmail(user.email) },
            };
        }),

    /** Returns the current user's profile. Requires valid JWT. */
    me: protectedProcedure.query(async ({ ctx }) => {
        const user = await db.query.users.findFirst({ where: eq(users.id, ctx.userId) });
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
        return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin };
    }),
});
