import { NextResponse } from "next/server";
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

/**
 * POST endpoint for Milvus operations
 * Supports: search, searchText, ingest, createCollection
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action parameter is required" },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "searchText":
        // Search using text query (automatically generates embedding)
        // Required: query (string)
        // Optional: limit (default: 5), collection ('chunks' or 'pages'), outputFields
        if (!params.query || typeof params.query !== 'string') {
          return NextResponse.json(
            { error: "query (string) is required for searchText action" },
            { status: 400 }
          );
        }

        console.log(`Generating embedding for query: "${params.query}"`);
        const queryEmbedding = await generateEmbedding(params.query);

        // Determine which collection to search
        const collectionType = params.collection || 'chunks';
        const collectionName = collectionType === 'pages'
          ? PAGES_COLLECTION_NAME
          : CHUNKS_COLLECTION_NAME;

        // Determine output fields based on collection
        const defaultOutputFields = collectionType === 'pages'
          ? ['page_id', 'file_id', 'local_page_num', 'summary']
          : ['fileID', 'filename', 'page', 'chunk_index', 'chunk_text', 'summary', 'location'];

        console.log(`Searching in ${collectionName} collection...`);
        result = await search(
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

      case "search":
        // Search for similar vectors (direct vector input)
        // Required: queryVector (array of numbers with length VECTOR_DIM)
        // Optional: limit (default: 5), collection, outputFields
        if (!params.queryVector) {
          return NextResponse.json(
            { error: "queryVector is required for search action" },
            { status: 400 }
          );
        }

        if (!Array.isArray(params.queryVector)) {
          return NextResponse.json(
            { error: "queryVector must be an array" },
            { status: 400 }
          );
        }

        if (params.queryVector.length !== VECTOR_DIM) {
          return NextResponse.json(
            {
              error: `queryVector must have length ${VECTOR_DIM}, got ${params.queryVector.length}`,
            },
            { status: 400 }
          );
        }

        const searchCollectionType = params.collection || 'chunks';
        const searchCollectionName = searchCollectionType === 'pages'
          ? PAGES_COLLECTION_NAME
          : CHUNKS_COLLECTION_NAME;

        result = await search(
          params.queryVector,
          searchCollectionName,
          params.limit || 5,
          params.outputFields
        );

        return NextResponse.json({
          success: true,
          action: "search",
          collection: searchCollectionName,
          results: result.results || [],
          status: result.status,
        });

      case "ingest":
        // Ingest data into collection
        // Required: data (array of objects matching schema)
        // Optional: collection ('chunks' or 'pages')
        if (!params.data || !Array.isArray(params.data)) {
          return NextResponse.json(
            { error: "data array is required for ingest action" },
            { status: 400 }
          );
        }

        if (params.data.length === 0) {
          return NextResponse.json(
            { error: "data array cannot be empty" },
            { status: 400 }
          );
        }

        const ingestCollectionType = params.collection || 'chunks';
        const ingestCollectionName = ingestCollectionType === 'pages'
          ? PAGES_COLLECTION_NAME
          : CHUNKS_COLLECTION_NAME;

        result = await ingestData(
          params.data,
          ingestCollectionName
        );

        return NextResponse.json({
          success: true,
          action: "ingest",
          collection: ingestCollectionName,
          insertCount: result.insertCount,
          message: result.message,
        });

      case "createCollection":
        // Create a new collection with index
        // Required: collectionType ('chunks' or 'pages')
        // Optional: dropIfExists (default: false)
        const createCollectionType = params.collectionType || 'chunks';
        const config = COLLECTION_CONFIGS[createCollectionType];

        if (!config) {
          return NextResponse.json(
            { error: `Invalid collectionType: ${createCollectionType}. Must be 'chunks' or 'pages'` },
            { status: 400 }
          );
        }

        result = await createCollectionWithIndex(
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

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}. Supported actions: searchText, search, ingest, createCollection`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in Milvus API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for Milvus status and collection information
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const collectionType = searchParams.get("collection") || "chunks";
    const action = searchParams.get("action") || "stats";

    const collectionName = collectionType === 'pages'
      ? PAGES_COLLECTION_NAME
      : CHUNKS_COLLECTION_NAME;

    if (action === "stats") {
      // Get collection statistics
      const stats = await getCollectionStats(collectionName);

      return NextResponse.json({
        success: true,
        collection: collectionName,
        collectionType: collectionType,
        stats: stats,
        vectorDimension: VECTOR_DIM,
      });
    } else if (action === "config") {
      // Return configuration information
      return NextResponse.json({
        success: true,
        config: {
          collections: {
            chunks: CHUNKS_COLLECTION_NAME,
            pages: PAGES_COLLECTION_NAME,
          },
          vectorDimension: VECTOR_DIM,
          supportedActions: ["searchText", "search", "ingest", "createCollection"],
        },
      });
    } else {
      return NextResponse.json(
        {
          error: `Unknown action: ${action}. Supported actions: stats, config`,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in Milvus GET API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
