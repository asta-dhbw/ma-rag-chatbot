import { getGDriveMCPTools, callGDriveMCPTool } from './mcp-client-gdrive.js';

const SYSTEM_PROMPT = `You are an AI assistant with access to tools.

CRITICAL RULES:
- You MUST use tools to complete tasks, never just explain how to do them
- NEVER provide code snippets or scripts to the user
- NEVER say "you can use" or "here's how you could"
- ALWAYS execute the task using available tools
- Do NOT respond until the task is 100% complete
- If you explain instead of executing, you have FAILED

When the user asks you to do something:
1. Immediately call the appropriate tool
2. Continue calling tools until complete
3. Only then provide the final result`;

/**
 * Orchestrates a conversation with Ollama LLM, handling tool calling via MCP.
 * Implements an agentic loop where the LLM can request tools, we execute them,
 * and feed results back until the LLM provides a final response.
 *
 * @param {Array} messages - Array of conversation messages
 * @param {Object} options - Configuration options
 * @returns {Object} Final response with content, messages, and usage stats
 */
export async function orchestrateLLMConversation(messages, options = {}) {
  const ollamaUrl = options.ollamaUrl || process.env.OLLAMA_URL || "http://localhost:11434";
  const model = options.model || "qwen2.5:3b";
  const maxIterations = options.maxIterations || 10;

  // Get available MCP tools from Google Drive server
  let tools = [];
  try {
    tools = await getGDriveMCPTools();
    console.log(`Loaded ${tools.length} MCP tools`);
  } catch (error) {
    console.warn('Failed to load MCP tools, continuing without tools:', error.message);
  }

  // Convert MCP tools to Ollama format
  const ollamaTools = tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));

  // Inject system prompt at the beginning of the conversation
  let conversationMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages
  ];
  let iterations = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  while (iterations < maxIterations) {
    iterations++;

    console.log(`Iteration ${iterations}: Calling Ollama with ${conversationMessages.length} messages`);

    // Call Ollama with tools
    const response = await callOllama(ollamaUrl, {
      model,
      messages: conversationMessages,
      tools: ollamaTools.length > 0 ? ollamaTools : undefined,
      stream: false,
      options:{
        num_predict:200,
        temperature:0.7
      }
    });

    // Track token usage
    totalPromptTokens += response.prompt_eval_count || 0;
    totalCompletionTokens += response.eval_count || 0;

    const assistantMessage = response.message;
    conversationMessages.push(assistantMessage);

    // Check if the model wants to use tools
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      // No more tool calls, return final response
      console.log('No tool calls requested, returning final response');
      return {
        content: assistantMessage.content,
        messages: conversationMessages,
        model: response.model,
        usage: {
          prompt_tokens: totalPromptTokens,
          completion_tokens: totalCompletionTokens
        }
      };
    }

    console.log(`Processing ${assistantMessage.tool_calls.length} tool call(s)`);

    // Execute tool calls
    for (const toolCall of assistantMessage.tool_calls) {
      console.log(`Executing tool: ${toolCall.function.name}`);

      try {
        // Parse arguments if they're a string
        const args = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;

        const toolResult = await callGDriveMCPTool(
          toolCall.function.name,
          args
        );

        console.log(`Tool ${toolCall.function.name} executed successfully`);

        // Add tool result to conversation
        conversationMessages.push({
          role: "tool",
          content: JSON.stringify(toolResult.content || toolResult),
          tool_call_id: toolCall.id
        });
      } catch (error) {
        console.error(`Error executing tool ${toolCall.function.name}:`, error);

        // Add error result to conversation so LLM can handle it
        conversationMessages.push({
          role: "tool",
          content: JSON.stringify({
            error: error.message,
            isError: true
          }),
          tool_call_id: toolCall.id
        });
      }
    }
  }

  // If we hit max iterations, return what we have
  console.warn('Max iterations reached in tool calling loop');
  throw new Error('Max iterations reached in tool calling loop. The conversation may be stuck in a loop.');
}

/**
 * Makes a call to the Ollama API
 * @param {string} ollamaUrl - Base URL for Ollama
 * @param {Object} request - Request payload
 * @returns {Object} Ollama response
 */
async function callOllama(ollamaUrl, request) {
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}
