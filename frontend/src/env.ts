import { z } from 'zod';

/**
 * Environment-variable validation. The application MUST fail fast at startup if
 * any required variable is missing or malformed (Docs/06-coding-rules.md,
 * Docs/08-security.md). Importing this module parses `process.env` once and
 * throws on the first invalid configuration.
 *
 * Only `NEXT_PUBLIC_*` values are exposed to the browser; the service-role key
 * is server-only and must never be imported into client components.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate the given record (defaults to `process.env`). Exported so
 * tests can exercise validation without mutating the real environment.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env: Env = parseEnv();
