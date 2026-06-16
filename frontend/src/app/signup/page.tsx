import { signup } from '@/app/(auth)/actions';
import { AuthForm } from '@/components/auth/auth-form';

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <AuthForm mode="signup" action={signup} />
    </main>
  );
}
