import { buildApp } from './app.js';
import { env } from './env.js';
import { database, closeDatabases } from './db.js';
const app = buildApp(env.WEB_ORIGIN, true);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await app.close();
    await closeDatabases();
    process.exit(0);
  });
try {
  await database.$queryRaw`SELECT 1`;
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
