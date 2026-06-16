'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuthActionState } from '@/app/(auth)/actions';

type AuthAction = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;

interface AuthFormProps {
  mode: 'login' | 'signup';
  action: AuthAction;
}

const COPY = {
  login: {
    title: 'Welcome back',
    description: 'Log in to your ScholarForge workspace.',
    submit: 'Log in',
    switchPrompt: "Don't have an account?",
    switchHref: '/signup',
    switchLabel: 'Sign up',
  },
  signup: {
    title: 'Create your account',
    description: 'Start building your research workspace.',
    submit: 'Sign up',
    switchPrompt: 'Already have an account?',
    switchHref: '/login',
    switchLabel: 'Log in',
  },
} as const;

const INITIAL_STATE: AuthActionState = { error: null };

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const copy = COPY[mode];

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Please wait…' : copy.submit}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          {copy.switchPrompt}{' '}
          <Link href={copy.switchHref} className="font-medium underline">
            {copy.switchLabel}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
