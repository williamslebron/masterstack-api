import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './routers/_app';
import { createContext } from './middleware/trpc';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

// Always allow requests with no origin (mobile apps, curl, etc.)
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            cb(null, true);
        } else {
            cb(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
}));

// ── BODY PARSER ─────────────────────────────────────────────────────────────
app.use(express.json());

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── STATIC — Admin Dashboard ─────────────────────────────────────────────
import path from 'path';
app.get('/admin', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'masterstack-admin.html'));
});

// ── tRPC ──────────────────────────────────────────────────────────────────────
app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
        router: appRouter,
        createContext: ({ req, res }) => createContext({ req, res }),
    }),
);

// ── 404 HANDLER ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀  MasterStack API running on port ${PORT}`);
    console.log(`📊  tRPC endpoint: http://localhost:${PORT}/trpc`);
    console.log(`❤️   Health check: http://localhost:${PORT}/health`);
    console.log(`🌍  Environment:   ${process.env.NODE_ENV ?? 'development'}`);
});

export { app };
