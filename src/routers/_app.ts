import { router } from '../middleware/trpc';
import { authRouter } from './auth';
import { progressRouter } from './progress';
import { habitsRouter } from './habits';
import { tasksRouter } from './tasks';
import { dashboardRouter } from './dashboard';
import { adminRouter } from './admin';

/** Root tRPC router — merges all sub-routers under their namespaced keys. */
export const appRouter = router({
    auth: authRouter,
    progress: progressRouter,
    habits: habitsRouter,
    tasks: tasksRouter,
    dashboard: dashboardRouter,
    admin: adminRouter,
});

/** TypeScript type of the full API — used by the client for type inference. */
export type AppRouter = typeof appRouter;
