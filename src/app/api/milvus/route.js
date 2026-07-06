import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCollectionWithIndex,
  ingestData,
  search,
  getCollectionStats,
  COLLECTION_CONFIGS,
  CHUNKS_COLLECTION_NAME,
  PAGES_COLLECTION_NAME,
  VECTOR_DIM,
} from "@/lib/milvus-handler";
import { generateEmbedding } from "@/lib/embeddings";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const isProd = process.env.NODE_ENV === "production";

// Per-IP rate limits. Tune via env if needed.
const SEARCH_LIMIT = Number(process.env.MILVUS_SEARCH_RATE_LIMIT || 30);
const SEARCH_WINDOW_MS = Number(process.env.MILVUS_SEARCH_RATE_WINDOW_MS || 60_000);
const WRITE_LIMIT = Number(process.env.MILVUS_WRITE_RATE_LIMIT || 5);
const WRITE_WINDOW_MS = Number(process.env.MILVUS_WRITE_RATE_WINDOW_MS || 60_000);

const collectionEnum = z.enum(["chunks", "pages"]).optional();

const searchTextSchema = z.object({
  action: z.literal("searchText"),
  query: z.string().min(1).max(2000),
  collection: collectionEnum,
  limit: z.number().int().min(1).max(50).optional(),
  outputFields: z.array(z.string()).optional(),
});

const searchSchema = z.object({
  action: z.literal("search"),
  queryVector: z.array(z.number()).length(VECTOR_DIM),
  collection: collectionEnum,
  limit: z.number().int().min(1).max(50).optional(),
  outputFields: z.array(z.string()).optional(),
});

const ingestSchema = z.object({
  action: z.literal("ingest"),
  data: z.array(z.record(z.string(), z.unknown())).min(1).max(1000),
  collection: collectionEnum,
});

const createCollectionSchema = z.object({
  action: z.literal("createCollection"),
  collectionType: z.enum(["chunks", "pages"]),
  dropIfExists: z.boolean().optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  searchTextSchema,
  searchSchema,
  ingestSchema,
  createCollectionSchema,
]);

const READ_ACTIONS = new Set(["searchText", "search"]);

// Map a thrown error to a JSON response. In production we hide internals.
function errorResponse(error, status = 500) {
  console.error("Milvus API error:", error);
  return NextResponse.json(
    {
      success: false,
      error: isProd ? "Internal server error" : (error?.message || "error"),
    },
    { status }
  );
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const params = parsed.data;

  // Rate limit: reads vs writes use separate buckets.
  const ip = clientIp(req);
  const isRead = READ_ACTIONS.has(params.action);
  const rl = rateLimit(
    `milvus:${isRead ? "read" : "write"}:${ip}`,
    isRead ? SEARCH_LIMIT : WRITE_LIMIT,
    isRead ? SEARCH_WINDOW_MS : WRITE_WINDOW_MS
  );
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    switch (params.action) {
      case "searchText": {
        const queryEmbedding = await generateEmbedding(params.query);
        const collectionType = params.collection || "chunks";
        const collectionName =
          collectionType === "pages" ? PAGES_COLLECTION_NAME : CHUNKS_COLLECTION_NAME;
        const defaultOutputFields =
          collectionType === "pages"
            ? ["page_id", "file_id", "local_page_num", "summary"]
            : ["fileID", "filename", "page", "chunk_index", "chunk_text", "summary", "location"];

        const result = await search(
          queryEmbedding,
          collectionName,
          params.limit || 5,
          params.outputFields || defaultOutputFields
        );

        return NextResponse.json({
          success: true,
          action: "searchText",
          query: params.query,
          collection: collectionName,
          results: result.results || [],
          status: result.status,
        });
      }

      case "search": {
        const collectionType = params.collection || "chunks";
        const collectionName =
          collectionType === "pages" ? PAGES_COLLECTION_NAME : CHUNKS_COLLECTION_NAME;

        const result = await search(
          params.queryVector,
          collectionName,
          params.limit || 5,
          params.outputFields
        );

        return NextResponse.json({
          success: true,
          action: "search",
          collection: collectionName,
          results: result.results || [],
          status: result.status,
        });
      }

      case "ingest": {
        const collectionType = params.collection || "chunks";
        const collectionName =
          collectionType === "pages" ? PAGES_COLLECTION_NAME : CHUNKS_COLLECTION_NAME;

        const result = await ingestData(params.data, collectionName);

        return NextResponse.json({
          success: true,
          action: "ingest",
          collection: collectionName,
          insertCount: result.insertCount,
          message: result.message,
        });
      }

      case "createCollection": {
        const config = COLLECTION_CONFIGS[params.collectionType];
        if (!config) {
          return NextResponse.json(
            { error: `Invalid collectionType: ${params.collectionType}` },
            { status: 400 }
          );
        }
        const result = await createCollectionWithIndex(
          config.name,
          config.schema,
          config.indexConfig,
          config.description,
          params.dropIfExists || false
        );
        return NextResponse.json({
          success: true,
          action: "createCollection",
          collection: config.name,
          message: result.message,
        });
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(req) {
  // Light rate-limit on GETs too.
  const ip = clientIp(req);
  const rl = rateLimit(`milvus:read:${ip}`, SEARCH_LIMIT, SEARCH_WINDOW_MS);
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const collectionType = searchParams.get("collection") || "chunks";
    const action = searchParams.get("action") || "stats";

    if (collectionType !== "chunks" && collectionType !== "pages") {
      return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
    }

    const collectionName =
      collectionType === "pages" ? PAGES_COLLECTION_NAME : CHUNKS_COLLECTION_NAME;

    if (action === "files") {
      const { MilvusClient } = await import("@zilliz/milvus2-sdk-node");
      const milvusClient = new MilvusClient({
        address: `${process.env.MILVUS_HOST || "localhost"}:${process.env.MILVUS_PORT || "19530"}`,
      });
      const results = await milvusClient.query({
        collection_name: CHUNKS_COLLECTION_NAME,
        expr: "chunk_id >= 0",
        output_fields: ["filename"],
        limit: 16384,
      });
      const filenames = [
        ...new Set((results.data || []).map((r) => r.filename).filter(Boolean)),
      ].sort();
      return NextResponse.json({ success: true, filenames });
    }

    if (action === "stats") {
      const stats = await getCollectionStats(collectionName);
      return NextResponse.json({
        success: true,
        collection: collectionName,
        collectionType,
        stats,
        vectorDimension: VECTOR_DIM,
      });
    }

    if (action === "config") {
      return NextResponse.json({
        success: true,
        config: {
          collections: { chunks: CHUNKS_COLLECTION_NAME, pages: PAGES_COLLECTION_NAME },
          vectorDimension: VECTOR_DIM,
          supportedActions: ["searchText", "search", "ingest", "createCollection"],
        },
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
