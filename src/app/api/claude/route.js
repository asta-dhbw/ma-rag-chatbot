import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getGDriveMCPTools, callGDriveMCPTool } from "@/lib/mcp-client-gdrive";

const anthropic = new Anthropic({
  apiKey: process.env.LONGCAT_API_KEY,
});

export async function POST(request) {
  try {
    const { messages } = await request.json();

    // Get MCP tools
    const tools = await getGDriveMCPTools();

    // Call Claude with tools
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      tools: tools,
      messages: messages,
    });

    // Handle tool use loop
    while (response.stop_reason === "tool_use") {
      const toolUse = response.content.find((c) => c.type === "tool_use");

      // Execute tool via MCP
      const toolResult = await callGDriveMCPTool(toolUse.name, toolUse.input);

      // Continue conversation with tool result
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        tools: tools,
        messages: [
          ...messages,
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: toolResult.content,
              },
            ],
          },
        ],
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Claude API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
