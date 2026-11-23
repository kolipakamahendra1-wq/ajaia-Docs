import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { config } from '../config.js';

/**
 * Creates a libSQL client. Local dev uses file:./data/ajaia.db;
 * production uses a Turso URL (libsql://...) with DATABASE_AUTH_TOKEN.
 */
export function createDb(url = config.databaseUrl, authToken = config.databaseAuthToken) {
  if (url.startsWith('file:')) {
    const filePath = url.slice('file:'.length);
    if (filePath !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
    }
  }
  return createClient({ url, authToken });
}

export async function enableForeignKeys(db) {
  await db.execute('PRAGMA foreign_keys = ON');
}
