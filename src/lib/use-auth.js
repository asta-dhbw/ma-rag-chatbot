import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook to check authentication status across all providers (Google & Keycloak)
 * Returns authentication state and provider information
 */
export function useAuth({ redirectToLogin = true } = {}) {
  const router = useRouter();
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    isChecking: true,
    provider: null, // 'google' | 'keycloak' | null
    user: null,
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check Google auth first
        const googleResponse = await fetch('/api/auth/check');
        const googleData = await googleResponse.json();

        if (googleData.authenticated) {
          setAuthState({
            isAuthenticated: true,
            isChecking: false,
            provider: 'google',
            user: googleData.user || null,
          });
          return;
        }

        // Check Keycloak auth
        const keycloakResponse = await fetch('/api/auth/keycloak/check');
        const keycloakData = await keycloakResponse.json();

        if (keycloakData.authenticated) {
          setAuthState({
            isAuthenticated: true,
            isChecking: false,
            provider: 'keycloak',
            user: keycloakData.user || null,
          });
          return;
        }

        // Not authenticated with any provider
        setAuthState({
          isAuthenticated: false,
          isChecking: false,
          provider: null,
          user: null,
        });

        if (redirectToLogin) {
          router.push('/oauth');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState({
          isAuthenticated: false,
          isChecking: false,
          provider: null,
          user: null,
        });

        if (redirectToLogin) {
          router.push('/oauth');
        }
      }
    };

    checkAuth();
  }, [router, redirectToLogin]);

  return authState;
}
