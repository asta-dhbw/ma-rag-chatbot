'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatWindow from '@/components/Chat';

export default function ChatPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();

        if (data.authenticated) {
          setIsAuthenticated(true);
        } else {
          // Not authenticated, redirect to OAuth page
          router.push('/oauth');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // On error, redirect to OAuth page
        router.push('/oauth');
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  // Show loading state while checking authentication
  if (isChecking) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[hsl(220,10%,6%)]">
        <div className="text-muted-foreground">Laden...</div>
      </main>
    );
  }

  // Only render the chat if authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[hsl(220,10%,6%)] py-10">
      <ChatWindow />
    </main>
  );
}
