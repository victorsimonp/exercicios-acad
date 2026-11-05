import { buildApp } from './app.js';
import { env } from './env.js';
const app = buildApp(env.WEB_ORIGIN, true);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
try { await app.listen({ port: env.PORT, host: env.HOST }); }
catch (error) { app.log.error(error); process.exit(1); }
