import { pathToFileURL } from 'node:url';
import { createDb, enableForeignKeys } from './client.js';
import { SCHEMA_STATEMENTS } from './schema.js';

export async function initSchema(db) {
  await enableForeignKeys(db);
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(statement);
  }
}

// CLI: `npm run db:init`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDb();
  await initSchema(db);
  console.log('Database schema initialized.');
  db.close();
}
