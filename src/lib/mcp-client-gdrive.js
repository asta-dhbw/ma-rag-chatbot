import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

let mcpClient = null;

/**
 * Get or create the Google Drive MCP client
 * @returns {Promise<Client>} The connected MCP client
 */
export async function getGDriveMCPClient() {
  if (mcpClient) {
    return mcpClient;
  }

  // Create new client instance
  mcpClient = new Client(
    {
      name: "stuv-chat-gdrive-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  // Create stdio transport to connect to the MCP server
  const serverPath = path.join(process.cwd(), "mcp-servers", "google-drive-server.mjs");

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
  });

  // Connect to the MCP server
  await mcpClient.connect(transport);
  console.log("Connected to Google Drive MCP server");

  return mcpClient;
}

/**
 * Get list of available tools from the Google Drive MCP server
 * @returns {Promise<Array>} Array of tool definitions in Anthropic/Ollama format
 */
export async function getGDriveMCPTools() {
  const client = await getGDriveMCPClient();
  const { tools } = await client.listTools();

  // Convert MCP tool format to format expected by LLM orchestration
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

/**
 * Call a tool on the Google Drive MCP server
 * @param {string} name - Tool name
 * @param {Object} args - Tool arguments
 * @returns {Promise<Object>} Tool execution result
 */
export async function callGDriveMCPTool(name, args) {
  const client = await getGDriveMCPClient();
  const result = await client.callTool({ name, arguments: args });
  return result;
}

/**
 * Disconnect from the MCP server and reset the client
 */
export async function disconnectGDriveMCPClient() {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    console.log("Disconnected from Google Drive MCP server");
  }
}
