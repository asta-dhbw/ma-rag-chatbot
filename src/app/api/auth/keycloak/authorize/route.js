import { NextResponse } from "next/server";

// Keycloak OIDC configuration from environment variables
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER;

// Default scopes for Keycloak OIDC
const SCOPES = ["openid", "profile", "email"];

export async function GET(request) {
  try {
    if (!KEYCLOAK_CLIENT_ID || !KEYCLOAK_ISSUER) {
      throw new Error(
        "Keycloak configuration missing. Please set KEYCLOAK_CLIENT_ID and KEYCLOAK_ISSUER in .env"
      );
    }

    const redirectUri = `${
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    }/api/auth/keycloak/callback`;

    // Build the authorization URL
    const authUrl = new URL(`${KEYCLOAK_ISSUER}/protocol/openid-connect/auth`);
    authUrl.searchParams.set("client_id", KEYCLOAK_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", generateState());

    // Redirect to Keycloak's login page
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Keycloak authorization error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate Keycloak authorization" },
      { status: 500 }
    );
  }
}

// Generate a random state parameter for CSRF protection
function generateState() {
  return Math.random().toString(36).substring(2, 15);
}
