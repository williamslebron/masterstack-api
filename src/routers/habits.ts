import { z } from 'zod';
import { eq, and, gte } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { router, protectedProcedure } from '../middleware/trpc';
import { db } from '../db/client';
import { habitDays } from '../db/schema';

/** Formats a Date as 'YYYY-MM-DD' — matches the frontend fmtDate() helper. */
function fmtDate(d: Date): string {
    return d.toISOString().split('T')[0] as string;
}

/** Calculates the current streak from a set of habit day keys. Returns number of consecutive days. */
function calcStreak(dayKeys: Set<string>): number {
    let streak = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
        const key = fmtDate(d);
        if (dayKeys.has(key)) {
            streak++;
        } else if (i > 0) {
            break;
        }
        d.setDate(d.getDate() - 1);
    }
    return streak;
}

export const habitsRouter = router({
    /**
     * Returns the last 28 days of habit check-ins for a skill.
     * Also returns the current streak count.
     */
    getCalendar: protectedProcedure
        .input(z.object({ skillId: z.number().int().min(1).max(17) }))
        .query(async ({ ctx, input }) => {
            const rows = await db.query.habitDays.findMany({
                where: and(
                    eq(habitDays.userId, ctx.userId),
                    eq(habitDays.skillId, input.skillId),
                ),
            });

            const habitMap: Record<string, boolean> = {};
            const allKeys = new Set<string>();
            rows.forEach(r => {
                habitMap[r.dateKey] = r.checked;
                if (r.checked) allKeys.add(r.dateKey);
            });

            return {
                habitDays: habitMap,
                streak: calcStreak(allKeys),
            };
        }),

    /**
     * Toggles a habit day on or off.
     * Creates the row if it doesn't exist (checked=true) or flips checked on existing row.
     */
    toggleDay: protectedProcedure
        .input(z.object({
            skillId: z.number().int().min(1).max(17),
            dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
        }))
        .mutation(async ({ ctx, input }) => {
            const existing = await db.query.habitDays.findFirst({
                where: and(
                    eq(habitDays.userId, ctx.userId),
                    eq(habitDays.skillId, input.skillId),
                    eq(habitDays.dateKey, input.dateKey),
                ),
            });

            let checked: boolean;
            if (existing) {
                checked = !existing.checked;
                await db.update(habitDays)
                    .set({ checked })
                    .where(eq(habitDays.id, existing.id));
            } else {
                checked = true;
                await db.insert(habitDays).values({
                    id: uuid(),
                    userId: ctx.userId,
                    skillId: input.skillId,
                    dateKey: input.dateKey,
                    checked: true,
                });
            }

            return { dateKey: input.dateKey, checked };
        }),

    /** Returns all habit days for all 17 skills — used on initial load to populate the app. */
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const rows = await db.query.habitDays.findMany({
            where: eq(habitDays.userId, ctx.userId),
        });

        // Group by skillId → dateKey → checked
        const result: Record<number, Record<string, boolean>> = {};
        rows.forEach(r => {
            if (!result[r.skillId]) result[r.skillId] = {};
            result[r.skillId]![r.dateKey] = r.checked;
        });
        return result;
    }),
});
