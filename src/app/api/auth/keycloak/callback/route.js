import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Keycloak OIDC configuration from environment variables
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET;
const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle error response from Keycloak
    if (error) {
      console.error("Keycloak error:", error, errorDescription);
      return NextResponse.redirect(
        `${
          process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
        }/oauth?error=${encodeURIComponent(errorDescription || error)}`
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Authorization code not provided" },
        { status: 400 }
      );
    }

    if (!KEYCLOAK_CLIENT_ID || !KEYCLOAK_CLIENT_SECRET || !KEYCLOAK_ISSUER) {
      throw new Error(
        "Keycloak configuration missing. Please set all KEYCLOAK_* variables in .env"
      );
    }

    const redirectUri = `${
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    }/api/auth/keycloak/callback`;

    // Exchange authorization code for tokens
    const tokenEndpoint = `${KEYCLOAK_ISSUER}/protocol/openid-connect/token`;

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: KEYCLOAK_CLIENT_ID,
        client_secret: KEYCLOAK_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      throw new Error("Failed to exchange authorization code for tokens");
    }

    const tokens = await tokenResponse.json();

    // Save tokens to keycloak-token.json (separate from Google tokens)
    const tokenPath = path.join(process.cwd(), "keycloak-token.json");
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

    console.log("Keycloak tokens saved successfully");

    // Redirect to chat page after successful authentication
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/chat`
    );
  } catch (error) {
    console.error("Keycloak callback error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to complete Keycloak authentication" },
      { status: 500 }
    );
  }
}
