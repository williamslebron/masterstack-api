import { initTRPC, TRPCError } from '@trpc/server';
import { Request, Response } from 'express';
import { extractBearer, verifyToken } from '../lib/jwt';
import { ZodError } from 'zod';

/** tRPC context — available to every procedure via `ctx` */
export interface Context {
    req: Request;
    res: Response;
    userId: string | null;  // null = unauthenticated
}

/** Creates the context object per request */
export function createContext({ req, res }: { req: Request; res: Response }): Context {
    const token = extractBearer(req.headers.authorization);
    const payload = token ? verifyToken(token) : null;
    return { req, res, userId: payload?.userId ?? null };
}

const t = initTRPC.context<Context>().create({
    /** Format all errors before sending to client */
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            data: {
                ...shape.data,
                zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
            },
        };
    },
});

/** Base router factory */
export const router = t.router;

/** Unauthenticated procedure — anyone can call */
export const publicProcedure = t.procedure;

/** Authenticated procedure — throws 401 if no valid JWT */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in.' });
    }
    return next({ ctx: { ...ctx, userId: ctx.userId } });
});
