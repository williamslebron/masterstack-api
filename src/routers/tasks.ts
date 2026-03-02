import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { router, protectedProcedure } from '../middleware/trpc';
import { db } from '../db/client';
import { taskState } from '../db/schema';

export const tasksRouter = router({
    /**
     * Returns all task states for a skill — both built-in (by index) and custom tasks.
     */
    getForSkill: protectedProcedure
        .input(z.object({ skillId: z.number().int().min(1).max(17) }))
        .query(async ({ ctx, input }) => {
            const rows = await db.query.taskState.findMany({
                where: and(
                    eq(taskState.userId, ctx.userId),
                    eq(taskState.skillId, input.skillId),
                ),
            });
            return rows;
        }),

    /** Returns task states for every skill, grouped by skillId. Used on initial load. */
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const rows = await db.query.taskState.findMany({
            where: eq(taskState.userId, ctx.userId),
        });
        // Group by skillId
        const result: Record<number, typeof rows> = {};
        rows.forEach(r => {
            if (!result[r.skillId]) result[r.skillId] = [];
            result[r.skillId]!.push(r);
        });
        return result;
    }),

    /** Toggles a built-in task (by index) done/not-done. Upserts the row. */
    toggle: protectedProcedure
        .input(z.object({
            skillId: z.number().int().min(1).max(17),
            taskIndex: z.number().int().min(0),
        }))
        .mutation(async ({ ctx, input }) => {
            const existing = await db.query.taskState.findFirst({
                where: and(
                    eq(taskState.userId, ctx.userId),
                    eq(taskState.skillId, input.skillId),
                    eq(taskState.taskIndex, input.taskIndex),
                    eq(taskState.isCustom, false),
                ),
            });

            let done: boolean;
            if (existing) {
                done = !existing.done;
                await db.update(taskState)
                    .set({ done })
                    .where(eq(taskState.id, existing.id));
            } else {
                done = true;
                await db.insert(taskState).values({
                    id: uuid(),
                    userId: ctx.userId,
                    skillId: input.skillId,
                    taskIndex: input.taskIndex,
                    done: true,
                    isCustom: false,
                    label: '',
                    createdAt: new Date(),
                });
            }
            return { taskIndex: input.taskIndex, done };
        }),

    /** Adds a custom task string. Returns the new task row. */
    addCustom: protectedProcedure
        .input(z.object({
            skillId: z.number().int().min(1).max(17),
            label: z.string().min(1).max(300),
        }))
        .mutation(async ({ ctx, input }) => {
            const id = uuid();
            await db.insert(taskState).values({
                id,
                userId: ctx.userId,
                skillId: input.skillId,
                taskIndex: -1,
                done: false,
                isCustom: true,
                label: input.label.trim(),
                createdAt: new Date(),
            });
            return { id, label: input.label.trim(), done: false };
        }),

    /** Toggles a custom task done/not-done by its UUID. */
    toggleCustom: protectedProcedure
        .input(z.object({ taskId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await db.query.taskState.findFirst({
                where: and(eq(taskState.id, input.taskId), eq(taskState.userId, ctx.userId)),
            });
            if (!existing) return { success: false };
            const done = !existing.done;
            await db.update(taskState).set({ done }).where(eq(taskState.id, input.taskId));
            return { id: input.taskId, done };
        }),

    /** Removes a custom task (soft check: must belong to the user). */
    removeCustom: protectedProcedure
        .input(z.object({ taskId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            await db.delete(taskState).where(
                and(eq(taskState.id, input.taskId), eq(taskState.userId, ctx.userId)),
            );
            return { success: true };
        }),
});
