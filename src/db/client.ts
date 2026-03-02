import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createClient } from '@libsql/client';
import { drizzle as drizzleLibSQL } from 'drizzle-orm/libsql';
import * as schema from './schema';

/** Returns a Drizzle ORM client.
 *  - In development: uses a local SQLite file (zero config).
 *  - In production: uses Turso (LibSQL) for cloud persistence.
 */
function createDb() {
    const isProduction = process.env.NODE_ENV === 'production';
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (isProduction && tursoUrl && tursoToken) {
        // Production: Turso free-tier LibSQL
        const client = createClient({ url: tursoUrl, authToken: tursoToken });
        return drizzleLibSQL(client, { schema });
    }

    // Development / fallback: local SQLite file
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') ?? './masterstack.db';
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');  // Better concurrent read performance
    sqlite.pragma('foreign_keys = ON');
    return drizzle(sqlite, { schema });
}

export const db = createDb();
