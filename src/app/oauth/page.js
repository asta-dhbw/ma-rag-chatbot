'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, LogIn } from 'lucide-react';

export default function OAuthPage() {
  const handleLogin = () => {
    // Redirect to the OAuth authorization endpoint
    window.location.href = '/api/auth/authorize';
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[hsl(220,10%,6%)] py-10">
      <div className="mx-auto w-full max-w-md px-4">
        <Card className="border-muted/40 bg-[hsl(220,10%,6%)] text-muted-foreground shadow-[0_0_0_1px_hsl(220,10%,12%)]">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-6">
              {/* Logo/Icon */}
              <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-8 w-8" />
              </div>

              {/* Title */}
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white">
                  StuV-Copilot
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Das Leben ist schön!
                </p>
              </div>

              {/* Description */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Bitte melden Sie sich mit Ihrem Google-Konto an, um auf den Chatbot zuzugreifen.
                </p>
              </div>

              {/* Login Button */}
              <Button
                onClick={handleLogin}
                className="w-full bg-[hsl(217,90%,56%)] hover:bg-[hsl(217,90%,50%)] text-white"
                size="lg"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Mit Google anmelden
              </Button>

              {/* Footer */}
              <div className="pt-4 text-center text-xs text-muted-foreground">
                @StuV - Mannheim
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
