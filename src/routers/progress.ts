import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { router, protectedProcedure } from '../middleware/trpc';
import { db } from '../db/client';
import { skillState, bookState } from '../db/schema';

const SKILL_IDS = Array.from({ length: 17 }, (_, i) => i + 1);

/** Ensures a skill_state row exists for the user+skill; creates it if missing. */
async function ensureSkillState(userId: string, skillId: number) {
    const existing = await db.query.skillState.findFirst({
        where: and(eq(skillState.userId, userId), eq(skillState.skillId, skillId)),
    });
    if (!existing) {
        await db.insert(skillState).values({
            userId, skillId,
            status: 'Not Started', progress: 0,
            done: false, courseDone: false,
            notes: '', pomSessions: 0,
            updatedAt: new Date(),
        });
    }
}

export const progressRouter = router({
    /**
     * Returns all 17 skill states for the authenticated user.
     * Missing rows are returned with zero-state defaults.
     */
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const rows = await db.query.skillState.findMany({
            where: eq(skillState.userId, ctx.userId),
        });
        const books = await db.query.bookState.findMany({
            where: eq(bookState.userId, ctx.userId),
        });

        // Build a complete map — one entry per skill_id 1–17
        const byId = new Map(rows.map(r => [r.skillId, r]));
        const booksByKey = new Map(books.map(b => [`${b.skillId}_${b.bookIndex}`, b]));

        return SKILL_IDS.map(id => {
            const s = byId.get(id);
            const b0 = booksByKey.get(`${id}_0`);
            const b1 = booksByKey.get(`${id}_1`);
            return {
                skillId: id,
                status: s?.status ?? 'Not Started',
                progress: s?.progress ?? 0,
                done: s?.done ?? false,
                courseDone: s?.courseDone ?? false,
                notes: s?.notes ?? '',
                pomSessions: s?.pomSessions ?? 0,
                updatedAt: s?.updatedAt ?? null,
                book0: { read: b0?.read ?? false, notesWritten: b0?.notesWritten ?? false, pdfLink: b0?.pdfLink ?? '' },
                book1: { read: b1?.read ?? false, notesWritten: b1?.notesWritten ?? false, pdfLink: b1?.pdfLink ?? '' },
            };
        });
    }),

    /** Updates status, progress, done, and/or courseDone for a skill. */
    update: protectedProcedure
        .input(z.object({
            skillId: z.number().int().min(1).max(17),
            status: z.enum(['Not Started', 'In Progress', 'Completed']).optional(),
            progress: z.number().int().min(0).max(100).optional(),
            done: z.boolean().optional(),
            courseDone: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            await ensureSkillState(ctx.userId, input.skillId);

            const patch: Partial<typeof skillState.$inferInsert> = { updatedAt: new Date() };
            if (input.status !== undefined) patch.status = input.status;
            if (input.progress !== undefined) patch.progress = input.progress;
            if (input.done !== undefined) patch.done = input.done;
            if (input.courseDone !== undefined) patch.courseDone = input.courseDone;

            await db.update(skillState)
                .set(patch)
                .where(and(eq(skillState.userId, ctx.userId), eq(skillState.skillId, input.skillId)));

            return { success: true };
        }),

    /** Saves the user's personal notes for a skill. */
    saveNotes: protectedProcedure
        .input(z.object({
            skillId: z.number().int().min(1).max(17),
            notes: z.string().max(10000),
        }))
        .mutation(async ({ ctx, input }) => {
            await ensureSkillState(ctx.userId, input.skillId);
            await db.update(skillState)
                .set({ notes: input.notes, updatedAt: new Date() })
                .where(and(eq(skillState.userId, ctx.userId), eq(skillState.skillId, input.skillId)));
            return { success: true };
        }),

    /** Updates book read / notesWritten / pdfLink for a skill. */
    updateBook: protectedProcedure
        .input(z.object({
            skillId: z.number().int().min(1).max(17),
            bookIndex: z.number().int().min(0).max(1),
            read: z.boolean().optional(),
            notesWritten: z.boolean().optional(),
            pdfLink: z.string().max(1000).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const key = { userId: ctx.userId, skillId: input.skillId, bookIndex: input.bookIndex };
            const existing = await db.query.bookState.findFirst({
                where: and(
                    eq(bookState.userId, ctx.userId),
                    eq(bookState.skillId, input.skillId),
                    eq(bookState.bookIndex, input.bookIndex),
                ),
            });

            const patch: Partial<typeof bookState.$inferInsert> = { updatedAt: new Date() };
            if (input.read !== undefined) patch.read = input.read;
            if (input.notesWritten !== undefined) patch.notesWritten = input.notesWritten;
            if (input.pdfLink !== undefined) patch.pdfLink = input.pdfLink;

            if (existing) {
                await db.update(bookState).set(patch)
                    .where(and(
                        eq(bookState.userId, ctx.userId),
                        eq(bookState.skillId, input.skillId),
                        eq(bookState.bookIndex, input.bookIndex),
                    ));
            } else {
                await db.insert(bookState).values({ ...key, ...patch, updatedAt: new Date() } as typeof bookState.$inferInsert);
            }
            return { success: true };
        }),

    /** Increments the pomodoro session count for a skill by 1. */
    incrementPomodoro: protectedProcedure
        .input(z.object({ skillId: z.number().int().min(1).max(17) }))
        .mutation(async ({ ctx, input }) => {
            await ensureSkillState(ctx.userId, input.skillId);
            const current = await db.query.skillState.findFirst({
                where: and(eq(skillState.userId, ctx.userId), eq(skillState.skillId, input.skillId)),
            });
            const next = (current?.pomSessions ?? 0) + 1;
            await db.update(skillState)
                .set({ pomSessions: next, updatedAt: new Date() })
                .where(and(eq(skillState.userId, ctx.userId), eq(skillState.skillId, input.skillId)));
            return { pomSessions: next };
        }),
});
