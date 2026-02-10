import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config/env.js';
import * as schema from './schema.js';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Ensure the data directory exists
mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });

const sqlite: DatabaseType = new Database(config.DATABASE_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

export const db = drizzle(sqlite, { schema });
export { sqlite };
