import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { createDb, enableForeignKeys } from './client.js';
import { initSchema } from './init.js';
import { config } from '../config.js';

export const DEMO_USERS = [
  { email: 'alice@demo.com', name: 'Alice' },
  { email: 'bob@demo.com', name: 'Bob' },
];

/** Idempotent: inserts demo users only if they do not exist yet. */
export async function seedDemoUsers(db, password = config.demoPassword) {
  await enableForeignKeys(db);
  const hash = await bcrypt.hash(password, 12);
  for (const user of DEMO_USERS) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO users (email, name, password_hash) VALUES (?, ?, ?)`,
      args: [user.email, user.name, hash],
    });
  }
}

// CLI: `npm run db:seed`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDb();
  await initSchema(db);
  await seedDemoUsers(db);
  console.log('Demo users ready: alice@demo.com, bob@demo.com');
  db.close();
}
