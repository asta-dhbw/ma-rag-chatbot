import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getDriveClient } from "../src/lib/google-drive-auth.js";

// Initialize Drive client
let drive = null;

function initializeDrive() {
  try {
    drive = getDriveClient();
    console.error("Successfully loaded Google Drive credentials");
  } catch (error) {
    console.error(
      "Warning: Failed to initialize Google Drive:",
      error.message
    );
    console.error(
      "Please authenticate via http://localhost:3000/api/auth/authorize"
    );
  }
}

// Create the MCP server
const server = new McpServer({
  name: "google-drive-server",
  version: "1.0.0",
});

// Helper function to check if drive is initialized
function ensureDriveInitialized() {
  if (!drive) {
    throw new Error(
      "Google Drive not initialized. Please ensure you have authenticated via http://localhost:3000/api/auth/authorize"
    );
  }
}

// Register tool: list_drive_files
server.tool(
  "list_drive_files",
  {
    folderId: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform(val => val || undefined)
      .describe(
        "Optional folder ID to list files from. If not provided, lists files from 'My Drive' root."
      ),
    query: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform(val => val || undefined)
      .describe(
        'Optional search query (e.g., \'name contains "report"\' or \'mimeType="application/pdf"\')'
      ),
    pageSize: z
      .union([z.number(), z.null(), z.undefined()])
      .optional()
      .transform(val => val ?? 100)
      .describe("Number of files to return (default: 100, max: 1000)"),
  },
  async ({ folderId, query, pageSize = 100 }) => {
    ensureDriveInitialized();

    let finalQuery = query || "";

    // If folderId is provided, add it to the query
    if (folderId) {
      finalQuery = finalQuery
        ? `'${folderId}' in parents and ${finalQuery}`
        : `'${folderId}' in parents`;
    }

    const response = await drive.files.list({
      pageSize: Math.min(pageSize, 1000),
      fields:
        "files(id, name, mimeType, size, modifiedTime, webViewLink, parents)",
      q: finalQuery || undefined,
      orderBy: "modifiedTime desc",
    });

    const files = response.data.files;
    if (!files || files.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No files found.",
          },
        ],
      };
    }

    const fileList = files.map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ? `${(file.size / 1024).toFixed(2)} KB` : "N/A",
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      parents: file.parents,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(fileList, null, 2),
        },
      ],
    };
  }
);

// Register tool: search_files
server.tool(
  "search_files",
  {
    searchTerm: z
      .string()
      .min(1)
      .describe("The search term (will search in file names and content)"),
    pageSize: z
      .union([z.number(), z.null(), z.undefined()])
      .optional()
      .transform(val => val ?? 20)
      .describe("Number of results to return (default: 20, max: 100)"),
  },
  async ({ searchTerm, pageSize = 20 }) => {
    ensureDriveInitialized();

    // Build search query - searches in name and full text
    const query = `fullText contains '${searchTerm}' or name contains '${searchTerm}'`;

    const response = await drive.files.list({
      pageSize: Math.min(pageSize, 100),
      q: query,
      fields:
        "files(id, name, mimeType, size, modifiedTime, webViewLink, parents)",
      orderBy: "modifiedTime desc",
    });

    const files = response.data.files;
    if (!files || files.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No files found matching "${searchTerm}".`,
          },
        ],
      };
    }

    const fileList = files.map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ? `${(file.size / 1024).toFixed(2)} KB` : "N/A",
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
    }));

    return {
      content: [
        {
          type: "text",
          text: `Found ${files.length} file(s) matching "${searchTerm}":\n\n${JSON.stringify(fileList, null, 2)}`,
        },
      ],
    };
  }
);

// Register tool: get_file_metadata
server.tool(
  "get_file_metadata",
  {
    fileId: z
      .string()
      .min(1)
      .refine(
        (val) =>
          val !== "None" &&
          val !== "null" &&
          val !== "undefined" &&
          val.trim() !== "",
        {
          message:
            "Invalid file ID. You must first call 'list_drive_files' or 'search_files' to get valid file IDs.",
        }
      )
      .describe(
        "The Google Drive file ID (obtain this from list_drive_files or search_files first)"
      ),
  },
  async ({ fileId }) => {
    ensureDriveInitialized();

    const response = await drive.files.get({
      fileId,
      fields:
        "id, name, mimeType, size, modifiedTime, createdTime, description, webViewLink, owners, parents, shared, capabilities",
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }
);

// Register tool: read_file_content
server.tool(
  "read_file_content",
  {
    fileId: z
      .string()
      .min(1)
      .refine(
        (val) =>
          val !== "None" &&
          val !== "null" &&
          val !== "undefined" &&
          val.trim() !== "",
        {
          message:
            "Invalid file ID. You must first call 'list_drive_files' or 'search_files' to get valid file IDs.",
        }
      )
      .describe(
        "The Google Drive file ID (obtain this from list_drive_files or search_files first)"
      ),
    mimeType: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform(val => val || undefined)
      .describe(
        'Optional MIME type for export (for Google Workspace files). E.g., "text/plain" for Docs, "text/csv" for Sheets.'
      ),
  },
  async ({ fileId, mimeType }) => {
    ensureDriveInitialized();

    // First, get file metadata to determine if it's a Google Workspace file
    const metadata = await drive.files.get({
      fileId,
      fields: "mimeType, name",
    });

    const fileMimeType = metadata.data.mimeType;
    let content;

    // Check if it's a Google Workspace file that needs export
    if (fileMimeType.startsWith("application/vnd.google-apps.")) {
      // Determine export MIME type
      let exportMimeType = mimeType;
      if (!exportMimeType) {
        // Default export types for common Google Workspace files
        if (fileMimeType === "application/vnd.google-apps.document") {
          exportMimeType = "text/plain";
        } else if (fileMimeType === "application/vnd.google-apps.spreadsheet") {
          exportMimeType = "text/csv";
        } else if (fileMimeType === "application/vnd.google-apps.presentation") {
          exportMimeType = "text/plain";
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Error: Cannot export file type ${fileMimeType}. Please specify a valid export mimeType.`,
              },
            ],
            isError: true,
          };
        }
      }

      const response = await drive.files.export(
        { fileId, mimeType: exportMimeType },
        { responseType: "text" }
      );
      content = response.data;
    } else {
      // Regular file download
      const response = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "text" }
      );
      content = response.data;
    }

    return {
      content: [
        {
          type: "text",
          text: `File: ${metadata.data.name}\nMIME Type: ${fileMimeType}\n\nContent:\n${content}`,
        },
      ],
    };
  }
);

// Start the server
async function main() {
  initializeDrive();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Drive MCP server running");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
