import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request) {
  try {
    const tokenPath = path.join(process.cwd(), "token.json");

    // Check if token file exists
    if (!fs.existsSync(tokenPath)) {
      return NextResponse.json({ authenticated: false });
    }

    // Check if token file has valid content
    const tokenContent = fs.readFileSync(tokenPath, "utf8");
    const tokens = JSON.parse(tokenContent);

    // Check if we have an access token (basic validation)
    if (tokens.access_token || tokens.refresh_token) {
      return NextResponse.json({ authenticated: true });
    }

    return NextResponse.json({ authenticated: false });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}
