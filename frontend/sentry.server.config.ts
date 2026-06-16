import * as Sentry from '@sentry/nextjs';

/**
 * Sentry server-side init (placeholder). Inert unless NEXT_PUBLIC_SENTRY_DSN is
 * set.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    enabled: process.env.NODE_ENV === 'production',
  });
}
