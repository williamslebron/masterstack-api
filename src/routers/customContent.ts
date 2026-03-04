import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { router, protectedProcedure } from '../middleware/trpc';
import { db } from '../db/client';
import { customCourse, customBook } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

export const customContentRouter = router({
    /**
     * Returns all custom course + book overrides for the current user.
     * Returns an object keyed by skillId.
     */
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const [courses, books] = await Promise.all([
            db.query.customCourse.findMany({ where: eq(customCourse.userId, ctx.userId) }),
            db.query.customBook.findMany({ where: eq(customBook.userId, ctx.userId) }),
        ]);
        /** Group by skillId for easy frontend lookup */
        const courseMap: Record<number, typeof courses[0]> = {};
        courses.forEach(c => { courseMap[c.skillId] = c; });

        const bookMap: Record<number, Record<number, typeof books[0]>> = {};
        books.forEach(b => {
            if (!bookMap[b.skillId]) bookMap[b.skillId] = {};
            bookMap[b.skillId]![b.bookIndex] = b;
        });

        return { courses: courseMap, books: bookMap };
    }),

    /**
     * Upserts a custom course override for a specific skill.
     * Pass empty strings to clear a field (falls back to default on frontend).
     */
    setCourse: protectedProcedure
        .input(z.object({
            skillId: z.number().int().min(1).max(17),
            title: z.string().max(200),
            provider: z.string().max(200),
            duration: z.string().max(100),
            price: z.string().max(100),
            link: z.string().max(500),
        }))
        .mutation(async ({ ctx, input }) => {
            const existing = await db.query.customCourse.findFirst({
                where: and(eq(customCourse.userId, ctx.userId), eq(customCourse.skillId, input.skillId)),
            });
            const now = new Date();
            if (existing) {
                await db.update(customCourse)
                    .set({ ...input, updatedAt: now })
                    .where(eq(customCourse.id, existing.id));
            } else {
                await db.insert(customCourse).values({
                    id: uuidv4(), userId: ctx.userId, updatedAt: now, ...input,
                });
            }
            return { success: true };
        }),

    /**
     * Clears a custom course override — user reverts to the hardcoded default.
     */
    clearCourse: protectedProcedure
        .input(z.object({ skillId: z.number().int().min(1).max(17) }))
        .mutation(async ({ ctx, input }) => {
            await db.delete(customCourse).where(
                and(eq(customCourse.userId, ctx.userId), eq(customCourse.skillId, input.skillId)),
            );
            return { success: true };
        }),

    /**
     * Upserts a custom book override for a specific skill + book slot (0, 1, or 2).
     */
    setBook: protectedProcedure
        .input(z.object({
            skillId: z.number().int().min(1).max(17),
            bookIndex: z.number().int().min(0).max(2),
            title: z.string().max(200),
            author: z.string().max(200),
            note: z.string().max(1000),
            pdfLink: z.string().max(500),
        }))
        .mutation(async ({ ctx, input }) => {
            const existing = await db.query.customBook.findFirst({
                where: and(
                    eq(customBook.userId, ctx.userId),
                    eq(customBook.skillId, input.skillId),
                    eq(customBook.bookIndex, input.bookIndex),
                ),
            });
            const now = new Date();
            if (existing) {
                await db.update(customBook)
                    .set({ ...input, updatedAt: now })
                    .where(eq(customBook.id, existing.id));
            } else {
                await db.insert(customBook).values({
                    id: uuidv4(), userId: ctx.userId, updatedAt: now, ...input,
                });
            }
            return { success: true };
        }),

    /**
     * Clears a custom book override for a specific slot.
     */
    clearBook: protectedProcedure
        .input(z.object({
            skillId: z.number().int().min(1).max(17),
            bookIndex: z.number().int().min(0).max(2),
        }))
        .mutation(async ({ ctx, input }) => {
            await db.delete(customBook).where(
                and(
                    eq(customBook.userId, ctx.userId),
                    eq(customBook.skillId, input.skillId),
                    eq(customBook.bookIndex, input.bookIndex),
                ),
            );
            return { success: true };
        }),
});
