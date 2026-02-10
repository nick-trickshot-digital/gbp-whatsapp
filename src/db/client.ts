import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config } from '../config/env.js';
import * as schema from './schema.js';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Ensure the data directory exists
mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });

const sqlite: DatabaseType = new Database(config.DATABASE_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

export const db = drizzle(sqlite, { schema });
export { sqlite };

// Run migrations on startup
// In dev: __dirname = src/db → migrations at src/db/migrations
// In prod: __dirname = dist/db → migrations at src/db/migrations (copied by Dockerfile)
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsPath = __dirname.includes('dist')
  ? resolve(__dirname, '../../src/db/migrations')
  : resolve(__dirname, 'migrations');
migrate(db, { migrationsFolder: migrationsPath });
