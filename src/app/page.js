'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/use-auth';

export default function Page() {
  const router = useRouter();
  const { isAuthenticated, isChecking } = useAuth({ redirectToLogin: false });

  useEffect(() => {
    if (!isChecking) {
      if (isAuthenticated) {
        router.push('/chat');
      } else {
        router.push('/oauth');
      }
    }
  }, [isAuthenticated, isChecking, router]);

  // Show a loading state while redirecting
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[hsl(220,10%,6%)]">
      <div className="text-muted-foreground">Laden...</div>
    </main>
  );
}
