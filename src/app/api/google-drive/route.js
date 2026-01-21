import { NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Helper function to get authenticated Drive client
function getDriveClient() {
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

  // Create Drive client
  return google.drive({ version: "v3", auth: oauth2Client });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId") || "root";

    const drive = getDriveClient();

    // List files from Google Drive using OAuth
    const response = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: "files(id, name, mimeType, modifiedTime, size)",
      pageSize: 100,
    });

    return NextResponse.json(response.data);
  } catch (error) {
    if (error.message.includes("No token found")) {
      return NextResponse.json(
        { error: error.message, authorizeUrl: "/api/auth/authorize" },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId is required" },
        { status: 400 }
      );
    }

    const drive = getDriveClient();

    // Get file metadata using OAuth
    const response = await drive.files.get({
      fileId: fileId,
      fields: "id, name, mimeType, modifiedTime, size, webViewLink, webContentLink",
    });

    return NextResponse.json(response.data);
  } catch (error) {
    if (error.message.includes("No token found")) {
      return NextResponse.json(
        { error: error.message, authorizeUrl: "/api/auth/authorize" },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
