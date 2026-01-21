import { NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Define the scopes you need for Google Drive
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

export async function GET(request) {
  try {
    // Load client secrets
    const clientSecretPath = path.join(process.cwd(), "client_secret.json");
    const credentials = JSON.parse(fs.readFileSync(clientSecretPath, "utf8"));
    const { client_secret, client_id, redirect_uris } = credentials.installed;


    //  TODO: might need to change the app to "webapp" --> google cloud console thing that needs to change
    // Desktop apps accept http://localhost on any port 
    const redirectUri = "http://localhost:3000/api/auth/callback";

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirectUri
    );

    // Generate the authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });

    // Redirect to Google's OAuth consent screen
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Authorization error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate authorization" },
      { status: 500 }
    );
  }
}
