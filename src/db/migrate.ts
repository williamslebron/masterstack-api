import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

/** Runs pending Drizzle migrations against the local SQLite database.
 *  For Turso (production), migrations are applied manually via drizzle-kit push.
 */
async function main() {
    console.log('🗄️  Running database migrations...');

    const dbPath = process.env.DATABASE_URL?.replace('file:', '') ?? './masterstack.db';
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    const db = drizzle(sqlite);

    migrate(db, {
        migrationsFolder: path.join(__dirname, 'migrations'),
    });

    console.log('✅  Migrations complete.');
    process.exit(0);
}

main().catch((err) => {
    console.error('❌  Migration failed:', err);
    process.exit(1);
});
