import { defineConfig } from 'drizzle-kit';

/** Drizzle Kit config — used for `npm run db:generate` and `npm run db:studio` */
export default defineConfig({
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: process.env.DATABASE_URL ?? 'file:./masterstack.db',
    },
});
