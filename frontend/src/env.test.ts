import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const VALID = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
} satisfies Record<string, string>;

describe('parseEnv', () => {
  it('parses a valid environment', () => {
    const env = parseEnv(VALID);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(VALID.NEXT_PUBLIC_SUPABASE_URL);
    expect(env.NODE_ENV).toBe('development');
  });

  it('throws fast when a required variable is missing', () => {
    const partial = {
      NEXT_PUBLIC_SUPABASE_URL: VALID.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
    expect(() => parseEnv(partial)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('throws when the Supabase URL is malformed', () => {
    expect(() => parseEnv({ ...VALID, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it('allows an empty Sentry DSN', () => {
    const env = parseEnv({ ...VALID, NEXT_PUBLIC_SENTRY_DSN: '' });
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBe('');
  });
});
