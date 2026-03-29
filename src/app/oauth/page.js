'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, LogIn, Shield } from 'lucide-react';

// Read enabled auth providers from environment
const AUTH_PROVIDERS = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS || 'google').split(',').map(p => p.trim());

export default function OAuthPage() {
  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/authorize';
  };

  const handleKeycloakLogin = () => {
    window.location.href = '/api/auth/keycloak/authorize';
  };

  const showGoogle = AUTH_PROVIDERS.includes('google');
  const showKeycloak = AUTH_PROVIDERS.includes('keycloak');

  // Dynamic description based on available providers
  const getDescription = () => {
    if (showGoogle && showKeycloak) {
      return 'Bitte melden Sie sich an, um auf den Chatbot zuzugreifen.';
    } else if (showKeycloak) {
      return 'Bitte melden Sie sich mit Ihrem DHBW-Konto an, um auf den Chatbot zuzugreifen.';
    }
    return 'Bitte melden Sie sich mit Ihrem Google-Konto an, um auf den Chatbot zuzugreifen.';
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
                  {getDescription()}
                </p>
              </div>

              {/* Login Buttons */}
              <div className="w-full space-y-3">
                {showKeycloak && (
                  <Button
                    onClick={handleKeycloakLogin}
                    className="w-full bg-[hsl(217,90%,56%)] hover:bg-[hsl(217,90%,50%)] text-white"
                    size="lg"
                  >
                    <Shield className="mr-2 h-5 w-5" />
                    Mit DHBW anmelden
                  </Button>
                )}

                {showGoogle && (
                  <Button
                    onClick={handleGoogleLogin}
                    variant={showKeycloak ? "outline" : "default"}
                    className={showKeycloak
                      ? "w-full border-muted-foreground/30 hover:bg-muted/20"
                      : "w-full bg-[hsl(217,90%,56%)] hover:bg-[hsl(217,90%,50%)] text-white"
                    }
                    size="lg"
                  >
                    <LogIn className="mr-2 h-5 w-5" />
                    Mit Google anmelden
                  </Button>
                )}
              </div>

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
