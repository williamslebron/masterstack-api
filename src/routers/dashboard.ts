import { eq } from 'drizzle-orm';
import { router, protectedProcedure } from '../middleware/trpc';
import { db } from '../db/client';
import { skillState, habitDays } from '../db/schema';

const SKILL_IDS = Array.from({ length: 17 }, (_, i) => i + 1);

/** Formats a Date as 'YYYY-MM-DD'. */
function fmtDate(d: Date): string {
    return d.toISOString().split('T')[0] as string;
}

/** Calculates the streak from a set of checked date keys. Returns number of consecutive days. */
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

export const dashboardRouter = router({
    /**
     * Returns aggregate dashboard stats for the authenticated user:
     * - Overall progress percentage
     * - Per-phase progress percentages
     * - Number of skills completed / remaining
     * - Courses completed count
     * - Total pomodoro sessions
     * - Longest individual streak across all skills
     */
    stats: protectedProcedure.query(async ({ ctx }) => {
        const states = await db.query.skillState.findMany({
            where: eq(skillState.userId, ctx.userId),
        });
        const habits = await db.query.habitDays.findMany({
            where: eq(habitDays.userId, ctx.userId),
        });

        // Build quick lookup
        const bySkillId = new Map(states.map(s => [s.skillId, s]));

        // Overall progress
        const totalProgress = SKILL_IDS.reduce((sum, id) => sum + (bySkillId.get(id)?.progress ?? 0), 0);
        const overallPct = Math.round(totalProgress / 17);

        // Phase progress — phase 1: ids 1–5, phase 2: 6–9, phase 3: 10–13, phase 4: 14–17
        const phaseRanges: Record<number, number[]> = {
            1: [1, 2, 3, 4, 5],
            2: [6, 7, 8, 9],
            3: [10, 11, 12, 13],
            4: [14, 15, 16, 17],
        };
        const phasePct = Object.fromEntries(
            Object.entries(phaseRanges).map(([phase, ids]) => {
                const sum = ids.reduce((s, id) => s + (bySkillId.get(id)?.progress ?? 0), 0);
                return [phase, Math.round(sum / ids.length)];
            }),
        );

        // Counts
        const skillsDone = SKILL_IDS.filter(id => bySkillId.get(id)?.done).length;
        const coursesDone = SKILL_IDS.filter(id => bySkillId.get(id)?.courseDone).length;
        const totalPomodoro = states.reduce((sum, s) => sum + s.pomSessions, 0);

        // Per-skill streaks — find the longest
        const habitsBySkill: Record<number, Set<string>> = {};
        habits.forEach(h => {
            if (!habitsBySkill[h.skillId]) habitsBySkill[h.skillId] = new Set();
            if (h.checked) habitsBySkill[h.skillId]!.add(h.dateKey);
        });
        const streaks = SKILL_IDS.map(id => ({
            skillId: id,
            streak: calcStreak(habitsBySkill[id] ?? new Set()),
        }));
        const longestStreak = Math.max(...streaks.map(s => s.streak), 0);

        return {
            overallPct,
            phasePct,
            skillsDone,
            skillsRemaining: 17 - skillsDone,
            coursesDone,
            totalPomodoro,
            longestStreak,
            streaks,
        };
    }),
});
