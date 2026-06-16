/**
 * Next.js instrumentation hook. Loads the appropriate Sentry config per runtime.
 * Both configs are inert unless NEXT_PUBLIC_SENTRY_DSN is set.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.server.config');
  }
}
