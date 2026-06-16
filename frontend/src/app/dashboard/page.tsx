import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/auth/logout-button';
import { UploadForm } from '@/components/documents/upload-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

/**
 * Protected dashboard. The middleware already redirects unauthenticated users,
 * but we re-check here as defense in depth (the page renders only for a valid
 * session, and we never trust the client).
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <LogoutButton />
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Signed in as {user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500">
            Your research workspace is ready. Upload a PDF below to get started.
          </p>
        </CardContent>
      </Card>
      <UploadForm />
    </main>
  );
}
