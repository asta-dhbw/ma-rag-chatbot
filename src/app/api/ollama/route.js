import { NextResponse } from "next/server";
import { orchestrateMilvusHybridSearch } from "@/lib/milvus-orchestration";

/**
 * Legacy chat endpoint.
 *
 * As of the per-user LLM key feature, the LLM is called directly from the
 * browser (see `src/lib/browser-llm.js`). The user's API key never reaches
 * this server. This endpoint therefore only does retrieval and exists so
 * that older clients (and anyone hitting it without a key) still get useful
 * vector-search results back.
 *
 * Prefer using `/api/milvus` (action `searchText`) for new code.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { prompt, messages } = body;

    const conversationMessages = messages || [
      {
        role: "user",
        content: prompt || body.content || "",
      },
    ];

    const result = await orchestrateMilvusHybridSearch(conversationMessages, {
      pageLimit: 4,
      chunkLimit: 8,
    });

    return NextResponse.json({
      content: [{ text: result.content || "" }],
      structured: result.structured || null,
      responseType: result.structured ? "structured" : "text",
      model: result.model,
      usage: result.usage,
    });
  } catch (error) {
    console.error("Error in /api/ollama:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Kept for backwards-compat: this used to probe the local Ollama instance.
 * It is no longer wired into the UI but harmless to keep around.
 */
export async function GET() {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaUrl}/api/tags`);

    if (!response.ok) {
      throw new Error("Ollama service not available");
    }

    const data = await response.json();

    return NextResponse.json({
      status: "ok",
      models: data.models || [],
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 503 }
    );
  }
}