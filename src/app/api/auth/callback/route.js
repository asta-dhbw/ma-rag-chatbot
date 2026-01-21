import { NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.json(
        { error: "No authorization code provided" },
        { status: 400 }
      );
    }

    // Load client secrets
    const clientSecretPath = path.join(process.cwd(), "client_secret.json");
    const credentials = JSON.parse(fs.readFileSync(clientSecretPath, "utf8"));
    const { client_secret, client_id, redirect_uris } = credentials.installed;

    // For Desktop app, use the same redirect URI as in authorize
    const redirectUri = "http://localhost:3000/api/auth/callback";

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirectUri
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save tokens to a file (you might want to use a database in production)
    const tokenPath = path.join(process.cwd(), "token.json");
    fs.writeFileSync(tokenPath, JSON.stringify(tokens));

    // Redirect to chat page after successful authorization
    return NextResponse.redirect(new URL('/chat', request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      { error: error.message || "Authorization failed" },
      { status: 500 }
    );
  }
}
