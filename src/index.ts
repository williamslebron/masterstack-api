import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './routers/_app';
import { createContext } from './middleware/trpc';
import path from 'path';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// ── CORS — Updated to allow local HTML files and any origin ──────────────────
app.use(cors({
    origin: true, // Reflects the requester's origin (fixes the "Load failed" error)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'trpc-batch']
}));

// ── BODY PARSER ─────────────────────────────────────────────────────────────
app.use(express.json());

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── STATIC — Admin Dashboard ─────────────────────────────────────────────
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