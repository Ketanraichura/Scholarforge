import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthForm } from './auth-form';
import type { AuthActionState } from '@/app/(auth)/actions';

const noopAction = vi.fn(async (): Promise<AuthActionState> => ({ error: null }));

describe('AuthForm', () => {
  it('renders login copy and the credential fields', () => {
    render(<AuthForm mode="login" action={noopAction} />);
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('renders signup copy in signup mode', () => {
    render(<AuthForm mode="signup" action={noopAction} />);
    expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });
});
