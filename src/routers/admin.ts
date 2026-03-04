import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import { router, protectedProcedure } from '../middleware/trpc';
import { db } from '../db/client';
import { users, skillState, habitDays, taskState, passwordResets, emailVerifications } from '../db/schema';

const SKILL_NAMES: Record<number, string> = {
    1: 'Emotional Control', 2: 'Discipline', 3: 'Learning', 4: 'Focus', 5: 'Consistency',
    6: 'Decision-Making', 7: 'Problem-Solving', 8: 'Execution', 9: 'Adaptability',
    10: 'Communication', 11: 'Confidence', 12: 'Writing', 13: 'Networking',
    14: 'Digital Skills', 15: 'Marketing', 16: 'Sales', 17: 'Personal Branding',
};
const SKILL_IDS = Array.from({ length: 17 }, (_, i) => i + 1);

/** Admin-only middleware — throws 403 if user is not an admin. */
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, ctx.userId) });
    if (!user?.isAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required.' });
    }
    return next({ ctx });
});

/** Formats a Date as 'YYYY-MM-DD'. */
function fmtDate(d: Date): string {
    return d.toISOString().split('T')[0] as string;
}

/** Calculates consecutive day streak from a set of date keys. */
function calcStreak(dayKeys: Set<string>): number {
    let streak = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
        if (dayKeys.has(fmtDate(d))) { streak++; }
        else if (i > 0) { break; }
        d.setDate(d.getDate() - 1);
    }
    return streak;
}

export const adminRouter = router({
    /**
     * Returns a summary card for every user:
     * name, email, overall progress %, skills done, total pomodoros, longest streak.
     * Admin-only.
     */
    getAllUsers: adminProcedure.query(async () => {
        const allUsers = await db.query.users.findMany({ orderBy: asc(users.createdAt) });
        const allSkills = await db.query.skillState.findMany();
        const allHabits = await db.query.habitDays.findMany();

        return allUsers.map(u => {
            const skills = allSkills.filter(s => s.userId === u.id);
            const habits = allHabits.filter(h => h.userId === u.id);

            const progressMap = new Map(skills.map(s => [s.skillId, s.progress]));
            const totalProgress = SKILL_IDS.reduce((sum, id) => sum + (progressMap.get(id) ?? 0), 0);
            const overallPct = Math.round(totalProgress / 17);
            const skillsDone = skills.filter(s => s.done).length;
            const coursesDone = skills.filter(s => s.courseDone).length;
            const totalPomodoro = skills.reduce((sum, s) => sum + s.pomSessions, 0);

            // Longest streak across all skills
            const habitsBySkill: Record<number, Set<string>> = {};
            habits.forEach(h => {
                if (!habitsBySkill[h.skillId]) habitsBySkill[h.skillId] = new Set();
                if (h.checked) habitsBySkill[h.skillId]!.add(h.dateKey);
            });
            const longestStreak = Math.max(
                ...SKILL_IDS.map(id => calcStreak(habitsBySkill[id] ?? new Set())), 0
            );

            return {
                id: u.id,
                name: u.name,
                email: u.email,
                isAdmin: u.isAdmin,
                joinedAt: u.createdAt,
                overallPct,
                skillsDone,
                coursesDone,
                totalPomodoro,
                longestStreak,
            };
        });
    }),

    /**
     * Returns a detailed skill-by-skill breakdown for a specific user.
     * Admin-only.
     */
    getUserDetail: adminProcedure
        .input(z.object({ userId: z.string().uuid() }))
        .query(async ({ input }) => {
            const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
            if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });

            const skills = await db.query.skillState.findMany({ where: eq(skillState.userId, input.userId) });
            const habits = await db.query.habitDays.findMany({ where: eq(habitDays.userId, input.userId) });

            const byId = new Map(skills.map(s => [s.skillId, s]));
            const habitMap: Record<number, Set<string>> = {};
            habits.forEach(h => {
                if (!habitMap[h.skillId]) habitMap[h.skillId] = new Set();
                if (h.checked) habitMap[h.skillId]!.add(h.dateKey);
            });

            const skillBreakdown = SKILL_IDS.map(id => {
                const s = byId.get(id);
                return {
                    skillId: id,
                    name: SKILL_NAMES[id] ?? `Skill ${id}`,
                    progress: s?.progress ?? 0,
                    status: s?.status ?? 'Not Started',
                    done: s?.done ?? false,
                    courseDone: s?.courseDone ?? false,
                    pomSessions: s?.pomSessions ?? 0,
                    streak: calcStreak(habitMap[id] ?? new Set()),
                };
            });

            return {
                user: { id: user.id, name: user.name, email: user.email, joinedAt: user.createdAt },
                skillBreakdown,
                overallPct: Math.round(skillBreakdown.reduce((s, sk) => s + sk.progress, 0) / 17),
            };
        }),

    /**
     * Returns a comparison matrix: all users × all 17 skills with progress %.
     * Used to render the comparison table in the admin dashboard.
     * Admin-only.
     */
    getComparisonMatrix: adminProcedure.query(async () => {
        const allUsers = await db.query.users.findMany({ orderBy: asc(users.createdAt) });
        const allSkills = await db.query.skillState.findMany();

        const matrix = allUsers.map(u => {
            const row: Record<string, number | string> = { userId: u.id, userName: u.name };
            const userSkills = allSkills.filter(s => s.userId === u.id);
            const byId = new Map(userSkills.map(s => [s.skillId, s.progress]));
            SKILL_IDS.forEach(id => { row[`skill_${id}`] = byId.get(id) ?? 0; });
            return row;
        });

        return { matrix, skillNames: SKILL_NAMES };
    }),

    /** Grants or revokes admin status for a user. Can only be called by an existing admin. */
    setAdmin: adminProcedure
        .input(z.object({ userId: z.string().uuid(), isAdmin: z.boolean() }))
        .mutation(async ({ input }) => {
            await db.update(users)
                .set({ isAdmin: input.isAdmin })
                .where(eq(users.id, input.userId));
            return { success: true };
        }),

    /**
     * Returns pending (unused) email verification tokens for all unverified users.
     * Admin uses this to relay 6-char codes to users manually.
     */
    getPendingVerifications: adminProcedure.query(async () => {
        const records = await db.query.emailVerifications.findMany();
        const allUsers = await db.query.users.findMany();
        const userMap = new Map(allUsers.map(u => [u.id, u]));
        return records.map(r => ({
            userId: r.userId,
            email: userMap.get(r.userId)?.email ?? 'unknown',
            name: userMap.get(r.userId)?.name ?? 'unknown',
            token: r.token,
            createdAt: r.createdAt,
        }));
    }),

    /**
     * Returns all unexpired, unused password reset tokens.
     * Admin uses this to relay tokens to users who forgot their password.
     */
    getPendingResets: adminProcedure.query(async () => {
        const now = new Date();
        const records = await db.query.passwordResets.findMany();
        const allUsers = await db.query.users.findMany();
        const userMap = new Map(allUsers.map(u => [u.id, u]));
        return records
            .filter(r => !r.used && r.expiresAt > now)
            .map(r => ({
                userId: r.userId,
                email: userMap.get(r.userId)?.email ?? 'unknown',
                name: userMap.get(r.userId)?.name ?? 'unknown',
                token: r.token,
                expiresAt: r.expiresAt,
            }));
    }),
});
