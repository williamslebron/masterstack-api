import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/** Users table — one row per registered account */
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),              // UUID v4
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
    emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
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
}, (t) => ({
    userSkillIdx: index('skill_state_user_skill_idx').on(t.userId, t.skillId),
}));

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
}, (t) => ({
    userSkillIdx: index('book_state_user_skill_idx').on(t.userId, t.skillId),
}));

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
}, (t) => ({
    userSkillIdx: index('task_state_user_skill_idx').on(t.userId, t.skillId),
}));

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
}, (t) => ({
    userSkillIdx: index('habit_days_user_skill_idx').on(t.userId, t.skillId),
    userDateIdx: index('habit_days_user_date_idx').on(t.userId, t.dateKey),
}));

/**
 * Password reset tokens — one row per reset request.
 * Token is a random 32-char hex string. Expires after 1 hour.
 */
export const passwordResets = sqliteTable('password_resets', {
    id: text('id').primaryKey(),                    // UUID v4
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),         // 32-char hex, shown to admin
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    used: integer('used', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
    userIdx: index('password_resets_user_idx').on(t.userId),
    tokenIdx: index('password_resets_token_idx').on(t.token),
}));

/**
 * Email verification tokens — one row per user (upserted on re-request).
 * Token is shown in the admin dashboard for the admin to relay to the user.
 */
export const emailVerifications = sqliteTable('email_verifications', {
    id: text('id').primaryKey(),                    // UUID v4
    userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),         // 6-char uppercase code
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Per-user per-skill custom course override.
 * If present, replaces the hardcoded default course for that skill.
 */
export const customCourse = sqliteTable('custom_course', {
    id: text('id').primaryKey(),                    // UUID v4
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id').notNull(),
    title: text('title').notNull().default(''),
    provider: text('provider').notNull().default(''),
    duration: text('duration').notNull().default(''),
    price: text('price').notNull().default(''),
    link: text('link').notNull().default(''),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
    userSkillIdx: index('custom_course_user_skill_idx').on(t.userId, t.skillId),
}));

/**
 * Per-user per-skill per-book custom override.
 * bookIndex: 0 = book 1, 1 = book 2, 2 = optional book 3.
 * If present, replaces the hardcoded default book for that slot.
 */
export const customBook = sqliteTable('custom_book', {
    id: text('id').primaryKey(),                    // UUID v4
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id').notNull(),
    bookIndex: integer('book_index').notNull(),      // 0 | 1 | 2
    title: text('title').notNull().default(''),
    author: text('author').notNull().default(''),
    note: text('note').notNull().default(''),
    pdfLink: text('pdf_link').notNull().default(''),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
    userSkillIdx: index('custom_book_user_skill_idx').on(t.userId, t.skillId),
}));

/** TypeScript types inferred from schema */
export type User = typeof users.$inferSelect;
export type SkillState = typeof skillState.$inferSelect;
export type BookState = typeof bookState.$inferSelect;
export type TaskState = typeof taskState.$inferSelect;
export type HabitDay = typeof habitDays.$inferSelect;
export type PasswordReset = typeof passwordResets.$inferSelect;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type CustomCourse = typeof customCourse.$inferSelect;
export type CustomBook = typeof customBook.$inferSelect;
