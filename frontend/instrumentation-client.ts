/**
 * Client-side instrumentation entrypoint (Next.js). Loads the Sentry client
 * config, which is inert unless NEXT_PUBLIC_SENTRY_DSN is set.
 */
import './sentry.client.config';
