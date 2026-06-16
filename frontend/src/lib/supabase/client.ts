import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/env';

/**
 * Browser-side Supabase client for use in Client Components. Uses only the
 * public anon key; never reference the service-role key here.
 */
export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
