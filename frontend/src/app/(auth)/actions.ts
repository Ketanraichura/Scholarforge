'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Authentication server actions (signup / login / logout). Session persistence
 * is handled by @supabase/ssr via cookies set in the server client.
 *
 * @see Docs/01-prd.md (Authentication), Docs/08-security.md
 */

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export interface AuthActionState {
  error: string | null;
}

function readCredentials(formData: FormData): z.infer<typeof credentialsSchema> | string {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Invalid credentials.';
  }
  return parsed.data;
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = readCredentials(formData);
  if (typeof credentials === 'string') {
    return { error: credentials };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signup(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = readCredentials(formData);
  if (typeof credentials === 'string') {
    return { error: credentials };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(credentials);
  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
