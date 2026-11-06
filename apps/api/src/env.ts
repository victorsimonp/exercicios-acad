import 'dotenv/config';
import { z } from 'zod';
export const env = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    HOST: z.string().default('127.0.0.1'),
    WEB_ORIGIN: z.url().default('http://localhost:5173'),
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),
    SUPABASE_URL: z.url(),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  })
  .parse(process.env);
