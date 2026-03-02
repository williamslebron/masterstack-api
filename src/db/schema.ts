import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/** Users table — one row per registered account */
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),              // UUID v4
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Per-user per-skill state — mirrors the `S[skill.id]` shape from the frontend.
 * Primary key = (userId, skillId).
 */
export const skillState = sqliteTable('skill_state', {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id').notNull(),           // 1–17
    status: text('status').notNull().default('Not Started'), // 'Not Started' | 'In Progress' | 'Completed'
    progress: integer('progress').notNull().default(0),        // 0–100
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    courseDone: integer('course_done', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes').notNull().default(''),     // free-text personal notes
    pomSessions: integer('pom_sessions').notNull().default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Per-user per-skill per-book state.
 * bookIndex: 0 = first book, 1 = second book
 */
export const bookState = sqliteTable('book_state', {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id').notNull(),
    bookIndex: integer('book_index').notNull(),        // 0 | 1
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    notesWritten: integer('notes_written', { mode: 'boolean' }).notNull().default(false),
    pdfLink: text('pdf_link').notNull().default(''),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Per-user per-skill per-task state.
 * isCustom distinguishes built-in tasks (from SKILLS data) from user-added tasks.
 */
export const taskState = sqliteTable('task_state', {
    id: text('id').primaryKey(),                  // UUID v4
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id').notNull(),
    taskIndex: integer('task_index').notNull(),           // index in task array; -1 = custom
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
    label: text('label').notNull().default(''),       // only set for custom tasks
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Habit-day check-ins — one row per user/skill/date.
 * dateKey format: 'YYYY-MM-DD'
 */
export const habitDays = sqliteTable('habit_days', {
    id: text('id').primaryKey(),                    // UUID v4
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id').notNull(),
    dateKey: text('date_key').notNull(),                 // 'YYYY-MM-DD'
    checked: integer('checked', { mode: 'boolean' }).notNull().default(true),
});

/** TypeScript types inferred from schema */
export type User = typeof users.$inferSelect;
export type SkillState = typeof skillState.$inferSelect;
export type BookState = typeof bookState.$inferSelect;
export type TaskState = typeof taskState.$inferSelect;
export type HabitDay = typeof habitDays.$inferSelect;
