import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">ScholarForge AI</h1>
        <p className="max-w-md text-neutral-500">
          An AI-native research workspace. Upload documents, query them semantically, and build
          citation-grounded knowledge.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/login" className={cn(buttonVariants())}>
          Log in
        </Link>
        <Link href="/signup" className={cn(buttonVariants({ variant: 'outline' }))}>
          Sign up
        </Link>
      </div>
    </main>
  );
}
