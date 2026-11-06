import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from './generated/prisma/client.js';
import type { VerifiedIdentity } from './modules/identity.js';
const requestClient = new AsyncLocalStorage<Prisma.TransactionClient>();
if (
  process.env.NODE_ENV === 'test' &&
  [env.DATABASE_URL, env.DIRECT_URL ?? env.DATABASE_URL].some(
    (url) => !['localhost', '127.0.0.1'].includes(new URL(url).hostname),
  )
)
  throw new Error(
    'Testes de integração só podem usar o PostgreSQL local isolado.',
  );
export const database = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    connectionTimeoutMillis: 10000,
  }),
});
export const migrationDatabase = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: env.DIRECT_URL ?? env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 10000,
  }),
});
// All application modules keep their Prisma contracts. Inside an authenticated
// request, every query (including nested transactions) uses the same RLS context.
export const prisma = new Proxy(database, {
  get(target, key) {
    const scoped = requestClient.getStore();
    if (scoped && key === '$transaction')
      return async (
        operation:
          | ((tx: Prisma.TransactionClient) => Promise<unknown>)
          | Promise<unknown>[],
      ) =>
        typeof operation === 'function'
          ? operation(scoped)
          : Promise.all(operation);
    const client = scoped ?? target;
    const value = Reflect.get(client, key);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
export async function asIdentity<T>(
  identity: VerifiedIdentity,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return database.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE ht_api');
      await tx.$queryRaw`SELECT set_config('request.jwt.claims',${JSON.stringify({ sub: identity.id, email: identity.email, role: 'authenticated' })},true)`;
      return requestClient.run(tx, () => action(tx));
    },
    { maxWait: 10000, timeout: 20000 },
  );
}
export function asMigration<T>(action: () => Promise<T>) {
  return requestClient.run(migrationDatabase, action);
}
export async function closeDatabases() {
  await Promise.all([database.$disconnect(), migrationDatabase.$disconnect()]);
}
