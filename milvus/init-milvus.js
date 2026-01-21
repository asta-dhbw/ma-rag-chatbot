import {
  createCollectionWithIndex,
  ingestData,
  getCollectionStats,
  COLLECTION_CONFIGS,
  VECTOR_DIM,
} from './milvus-handler.js';

/**
 * Initialization script that creates collections and ingests test entities
 * This runs automatically when the Milvus Docker container starts
 */
async function initializeMilvus() {
  try {
    console.log('=== Milvus Initialization Started ===\n');

    // ========================================================================
    // Step 1: Create collections with indexes
    // ========================================================================
    console.log('[1/4] Creating collections...\n');

    // Create chunks collection
    console.log('Creating chunks collection (document chunks)...');
    const chunksResult = await createCollectionWithIndex(
      COLLECTION_CONFIGS.chunks.name,
      COLLECTION_CONFIGS.chunks.schema,
      COLLECTION_CONFIGS.chunks.indexConfig,
      COLLECTION_CONFIGS.chunks.description,
      true // dropIfExists
    );

    if (!chunksResult.success) {
      throw new Error(`Chunks collection creation failed: ${chunksResult.message}`);
    }
    console.log(`✓ ${chunksResult.message}\n`);

    // Create pages collection
    console.log('Creating pages collection (page summaries)...');
    const pagesResult = await createCollectionWithIndex(
      COLLECTION_CONFIGS.pages.name,
      COLLECTION_CONFIGS.pages.schema,
      COLLECTION_CONFIGS.pages.indexConfig,
      COLLECTION_CONFIGS.pages.description,
      true // dropIfExists
    );

    if (!pagesResult.success) {
      throw new Error(`Pages collection creation failed: ${pagesResult.message}`);
    }
    console.log(`✓ ${pagesResult.message}\n`);

    // ========================================================================
    // Step 2: Ingest test chunk entity
    // ========================================================================
    console.log('[2/4] Ingesting test chunk entity...');

    // Create a test vector with a predictable pattern
    const testChunkVector = [
      ...Array(VECTOR_DIM / 2).fill(0.5),
      ...Array(VECTOR_DIM / 2).fill(0.8),
    ];

    const testChunkEntity = {
      chunk_id: 1,
      fileID: 'TEST_ENTITY_001',
      filename: 'test-document.pdf',
      file_hash: 'd41d8cd98f00b204e9800998ecf8427e', // MD5 hash example
      page: 1,
      chunk_index: 0,
      chunk_text: 'This is a test chunk of text from the test document.',
      summary: 'Test document summary for verification purposes.',
      location: 'https://drive.google.com/file/d/TEST_ENTITY_001/view',
      chunk: testChunkVector,
    };

    console.log('Test chunk entity details:');
    console.log(`  - fileID: ${testChunkEntity.fileID}`);
    console.log(`  - filename: ${testChunkEntity.filename}`);
    console.log(`  - page: ${testChunkEntity.page}`);
    console.log(`  - chunk_text: ${testChunkEntity.chunk_text}`);
    console.log(`  - vector dimension: ${testChunkVector.length}`);
    console.log(`  - vector pattern: first half=0.5, second half=0.8\n`);

    const ingestChunksResult = await ingestData(
      [testChunkEntity],
      COLLECTION_CONFIGS.chunks.name
    );

    if (!ingestChunksResult.success) {
      throw new Error(`Chunk data ingestion failed: ${ingestChunksResult.message}`);
    }

    if (!ingestChunksResult.insertCount || ingestChunksResult.insertCount === 0) {
      throw new Error(
        'Chunk data ingestion returned 0 entities. Expected 1 entity to be inserted.'
      );
    }

    console.log(`✓ Successfully ingested ${ingestChunksResult.insertCount} test chunk entity\n`);

    // ========================================================================
    // Step 3: Ingest test page entity
    // ========================================================================
    console.log('[3/4] Ingesting test page entity...');

    // Create a test summary vector with a different pattern
    const testSummaryVector = [
      ...Array(VECTOR_DIM / 2).fill(0.3),
      ...Array(VECTOR_DIM / 2).fill(0.7),
    ];

    const testPageEntity = {
      page_id: 'TEST_ENTITY_001_page_1',
      file_id: 'TEST_ENTITY_001',
      local_page_num: 1,
      summary: 'Sample page summary for testing purposes.',
      summary_embedding: testSummaryVector,
    };

    console.log('Test page entity details:');
    console.log(`  - page_id: ${testPageEntity.page_id}`);
    console.log(`  - file_id: ${testPageEntity.file_id}`);
    console.log(`  - local_page_num: ${testPageEntity.local_page_num}`);
    console.log(`  - summary: ${testPageEntity.summary}`);
    console.log(`  - summary_embedding dimension: ${testSummaryVector.length}`);
    console.log(`  - vector pattern: first half=0.3, second half=0.7\n`);

    const ingestPagesResult = await ingestData(
      [testPageEntity],
      COLLECTION_CONFIGS.pages.name
    );

    if (!ingestPagesResult.success) {
      throw new Error(`Page data ingestion failed: ${ingestPagesResult.message}`);
    }

    if (!ingestPagesResult.insertCount || ingestPagesResult.insertCount === 0) {
      throw new Error(
        'Page data ingestion returned 0 entities. Expected 1 entity to be inserted.'
      );
    }

    console.log(`✓ Successfully ingested ${ingestPagesResult.insertCount} test page entity\n`);

    // ========================================================================
    // Step 4: Verify collections
    // ========================================================================
    console.log('[4/4] Verifying collections...');

    // Verify chunks collection
    const chunksStats = await getCollectionStats(COLLECTION_CONFIGS.chunks.name);
    const chunksRowCount = chunksStats.data?.row_count;

    // Verify pages collection
    const pagesStats = await getCollectionStats(COLLECTION_CONFIGS.pages.name);
    const pagesRowCount = pagesStats.data?.row_count;

    console.log('Collection statistics:');
    console.log(`  - Chunks collection row count: ${chunksRowCount || 'N/A'}`);
    console.log(`  - Pages collection row count: ${pagesRowCount || 'N/A'}\n`);

    // Validate row counts
    if (chunksRowCount === undefined || chunksRowCount === null) {
      throw new Error('Unable to retrieve chunks collection row count');
    }
    if (pagesRowCount === undefined || pagesRowCount === null) {
      throw new Error('Unable to retrieve pages collection row count');
    }

    if (chunksRowCount === 0) {
      throw new Error(
        'Chunks collection has 0 rows after ingestion. Data was not persisted correctly.'
      );
    }
    if (pagesRowCount === 0) {
      throw new Error(
        'Pages collection has 0 rows after ingestion. Data was not persisted correctly.'
      );
    }

    console.log(`✓ Verified: Chunks collection contains ${chunksRowCount} entity (as expected)`);
    console.log(`✓ Verified: Pages collection contains ${pagesRowCount} entity (as expected)`);

    // ========================================================================
    // Success!
    // ========================================================================
    console.log('\n=== Milvus Initialization Completed Successfully ===');
    console.log('✓ Both collections are ready for querying');
    console.log(
      '✓ Run "docker exec milvus-standalone node /app/test-query.js" to verify data\n'
    );

    process.exit(0);
  } catch (error) {
    console.error('\n✗ ERROR: Milvus initialization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run initialization
initializeMilvus();
