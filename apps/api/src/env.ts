import 'dotenv/config';
import { z } from 'zod';
export const env = z.object({ PORT: z.coerce.number().int().min(1).max(65535).default(3333), HOST: z.string().default('127.0.0.1'), WEB_ORIGIN: z.url().default('http://localhost:5173'), DATABASE_URL: z.string().min(1) }).parse(process.env);
