'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    // Check authentication and redirect accordingly
    const checkAuthAndRedirect = async () => {
      try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();

        if (data.authenticated) {
          // User is authenticated, redirect to chat
          router.push('/chat');
        } else {
          // User is not authenticated, redirect to OAuth page
          router.push('/oauth');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // On error, redirect to OAuth page
        router.push('/oauth');
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  // Show a loading state while redirecting
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[hsl(220,10%,6%)]">
      <div className="text-muted-foreground">Laden...</div>
    </main>
  );
}
