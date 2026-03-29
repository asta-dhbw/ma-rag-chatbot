'use client';

import ChatWindow from '@/components/Chat';
import { useAuth } from '@/lib/use-auth';

export default function ChatPage() {
  const { isAuthenticated, isChecking, provider } = useAuth({ redirectToLogin: true });

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
