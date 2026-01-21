import {
  createCollection,
  ingestData,
  getCollectionStats,
  VECTOR_DIM,
} from './milvus-handler.js';

/**
 * Test ingestion script that creates a collection and ingests a single test entity
 * This script runs during Docker container startup
 */
async function testIngest() {
  try {
    console.log('=== Milvus Test Ingestion Started ===\n');

    // Step 1: Create collection
    console.log('[1/3] Creating collection...');
    const createResult = await createCollection('first_collection', true);
    console.log(`${createResult.message}`);

    // Step 2: Create a test entity with a predictable vector
    // Using a simple pattern: first half is 0.5, second half is 0.8
    const testVector = [
      ...Array(VECTOR_DIM / 2).fill(0.5),
      ...Array(VECTOR_DIM / 2).fill(0.8),
    ];

    const testEntity = {
      chunk_id: 1,
      fileID: 'TEST_ENTITY_001',
      filename: 'test-document.pdf',
      file_hash: 'd41d8cd98f00b204e9800998ecf8427e', // MD5 hash example
      page: 1,
      chunk_index: 0,
      chunk_text: 'This is a test chunk of text from the test document.',
      summary: 'Test document summary for verification purposes.',
      location: 'https://drive.google.com/file/d/TEST_ENTITY_001/view',
      chunk: testVector,
    };

    console.log('\n[2/3] Ingesting test entity...');
    console.log('Test entity details:');
    console.log(`  - fileID: ${testEntity.fileID}`);
    console.log(`  - filename: ${testEntity.filename}`);
    console.log(`  - file_hash: ${testEntity.file_hash}`);
    console.log(`  - page: ${testEntity.page}`);
    console.log(`  - chunk_index: ${testEntity.chunk_index}`);
    console.log(`  - chunk_text: ${testEntity.chunk_text}`);
    console.log(`  - summary: ${testEntity.summary}`);
    console.log(`  - location: ${testEntity.location}`);
    console.log(`  - vector dimension: ${testVector.length}`);
    console.log(`  - vector pattern: first half=0.5, second half=0.8`);

    const ingestResult = await ingestData([testEntity], 'first_collection');
    console.log(
      `Successfully ingested ${ingestResult.insertCount} test entity`
    );

    // Step 3: Verify collection stats
    console.log('\n[3/3] Verifying collection...');
    const stats = await getCollectionStats('first_collection');
    console.log('Collection statistics:');
    console.log(`  - Row count: ${stats.data?.row_count || 'N/A'}`);

    console.log('\n=== Milvus Test Ingestion Completed Successfully ===');
    console.log('Test entity is ready for querying');
    console.log('Run test-query.js to verify retrieval\n');

    process.exit(0);
  } catch (error) {
    console.error('\nERROR: Test ingestion failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test ingestion
testIngest();
