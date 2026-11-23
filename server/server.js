import { config, assertConfig } from './config.js';
import { createDb } from './database/client.js';
import { initSchema } from './database/init.js';
import { seedDemoUsers } from './database/seed.js';
import { createApp } from './app.js';

assertConfig();

const db = createDb();
await initSchema(db);
await seedDemoUsers(db);

const app = createApp({ db });
app.listen(config.port, () => {
  console.log(`Ajaia Docs API listening on port ${config.port} (${config.env})`);
});
