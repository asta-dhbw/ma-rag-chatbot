import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER;

export async function GET(request) {
  try {
    const tokenPath = path.join(process.cwd(), "keycloak-token.json");

    // Check if token file exists
    if (!fs.existsSync(tokenPath)) {
      return NextResponse.json({ authenticated: false });
    }

    const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));

    // Check if we have an access token
    if (!tokens.access_token) {
      return NextResponse.json({ authenticated: false });
    }

    // Optional: Validate token with Keycloak's userinfo endpoint
    if (KEYCLOAK_ISSUER) {
      try {
        const userInfoResponse = await fetch(
          `${KEYCLOAK_ISSUER}/protocol/openid-connect/userinfo`,
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        );

        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          return NextResponse.json({
            authenticated: true,
            provider: "keycloak",
            user: {
              sub: userInfo.sub,
              email: userInfo.email,
              name: userInfo.name || userInfo.preferred_username,
            },
          });
        }

        // Token might be expired, try to refresh
        if (tokens.refresh_token) {
          const refreshed = await refreshToken(tokens.refresh_token);
          if (refreshed) {
            return NextResponse.json({
              authenticated: true,
              provider: "keycloak",
            });
          }
        }

        return NextResponse.json({ authenticated: false });
      } catch (validationError) {
        console.error("Token validation error:", validationError);
        // If validation fails but we have tokens, still consider authenticated
        // (might be a network issue)
        return NextResponse.json({
          authenticated: true,
          provider: "keycloak",
          validated: false,
        });
      }
    }

    return NextResponse.json({
      authenticated: true,
      provider: "keycloak",
    });
  } catch (error) {
    console.error("Keycloak check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}

async function refreshToken(refreshToken) {
  try {
    const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
    const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET;

    const tokenEndpoint = `${KEYCLOAK_ISSUER}/protocol/openid-connect/token`;

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: KEYCLOAK_CLIENT_ID,
        client_secret: KEYCLOAK_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    if (response.ok) {
      const newTokens = await response.json();
      const tokenPath = path.join(process.cwd(), "keycloak-token.json");
      fs.writeFileSync(tokenPath, JSON.stringify(newTokens, null, 2));
      return true;
    }

    return false;
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
}
