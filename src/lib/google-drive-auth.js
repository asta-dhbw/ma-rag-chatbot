import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Cache the OAuth2 client to avoid recreating it
let cachedOAuth2Client = null;

// Helper function to get authenticated Drive client
export function getDriveClient() {
  // Return cached client if available
  if (cachedOAuth2Client) {
    return google.drive({ version: "v3", auth: cachedOAuth2Client });
  }

  // Load client secrets
  const clientSecretPath = path.join(process.cwd(), "client_secret.json");
  const credentials = JSON.parse(fs.readFileSync(clientSecretPath, "utf8"));
  const { client_secret, client_id } = credentials.installed;

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    "http://localhost:3000/api/auth/callback"
  );

  // Load tokens
  const tokenPath = path.join(process.cwd(), "token.json");

  if (!fs.existsSync(tokenPath)) {
    throw new Error("No token found. Please authorize first by visiting /api/auth/authorize");
  }

  const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
  oauth2Client.setCredentials(tokens);

  // Listen for token refresh events and save the new tokens
  oauth2Client.on("tokens", (newTokens) => {
    console.log("Tokens refreshed, saving to disk...");

    // Merge new tokens with existing ones (preserve refresh_token if not included)
    const currentTokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    const updatedTokens = {
      ...currentTokens,
      ...newTokens,
    };

    // Save updated tokens to disk
    fs.writeFileSync(tokenPath, JSON.stringify(updatedTokens, null, 2));
    console.log("New tokens saved successfully");
  });

  // Cache the client
  cachedOAuth2Client = oauth2Client;

  // Create Drive client
  return google.drive({ version: "v3", auth: oauth2Client });
}

// Clear the cached OAuth2 client (useful for re-authentication)
export function clearAuthCache() {
  cachedOAuth2Client = null;
  console.log("Auth cache cleared");
}
