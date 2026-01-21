import { search, getCollectionStats, VECTOR_DIM } from './milvus-handler.js';

/**
 * Test query script that searches for the test entity ingested during startup
 * This script should be run manually to verify the vector database is working
 */
async function testQuery() {
  try {
    console.log('=== Milvus Test Query Started ===\n');

    // Step 1: Check collection stats
    console.log('[1/3] Checking collection statistics...');
    const stats = await getCollectionStats('first_collection');
    console.log(`Collection has ${stats.data?.row_count || 0} entities`);

    if (stats.data?.row_count === 0) {
      console.log('\nWARNING: Collection is empty!');
      console.log(
        'Make sure test-ingest.js ran successfully during container startup.'
      );
      process.exit(1);
    }

    // Step 2: Create a query vector similar to the test entity
    // The test entity uses: first half=0.5, second half=0.8
    // We'll use a slightly varied vector to test similarity search
    const queryVector = [
      ...Array(VECTOR_DIM / 2).fill(0.51), // Slightly different from 0.5
      ...Array(VECTOR_DIM / 2).fill(0.79), // Slightly different from 0.8
    ];

    console.log('\n[2/3] Searching with similar vector...');
    console.log('Query vector pattern: first half=0.51, second half=0.79');
    console.log('Expected to find: TEST_ENTITY_001');

    // Step 3: Perform search
    const results = await search(
      queryVector,
      5, // Get top 5 results
      ['fileID', 'filename', 'file_hash', 'page', 'chunk_index', 'chunk_text', 'summary', 'location'],
      'first_collection'
    );

    console.log('\n[3/3] Search results:');
    if (results.results && results.results.length > 0) {
      results.results.forEach((result, index) => {
        console.log(`\nResult ${index + 1}:`);
        console.log(`  fileID: ${result.fileID}`);
        console.log(`  filename: ${result.filename}`);
        console.log(`  file_hash: ${result.file_hash}`);
        console.log(`  page: ${result.page}`);
        console.log(`  chunk_index: ${result.chunk_index}`);
        console.log(`  chunk_text: ${result.chunk_text}`);
        console.log(`  summary: ${result.summary}`);
        console.log(`  location: ${result.location}`);
        console.log(`  similarity score: ${result.score}`);

        // Check if we found the test entity
        if (result.fileID === 'TEST_ENTITY_001') {
          console.log('TEST ENTITY FOUND!');
        }
      });

      // Verify test entity was retrieved
      const foundTestEntity = results.results.some(
        (r) => r.fileID === 'TEST_ENTITY_001'
      );

      if (foundTestEntity) {
        console.log('\nSUCCESS: Test entity retrieved successfully!');
        console.log('Vector database is working correctly.');
        console.log('Milvus is ready for production use.\n');
        process.exit(0);
      } else {
        console.log('\nWARNING: Test entity not found in results!');
        console.log(
          'This may indicate an issue with vector similarity search.'
        );
        process.exit(1);
      }
    } else {
      console.log('\nERROR: No results returned from search!');
      console.log('Collection may be empty or search failed.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\nERROR: Test query failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test query
testQuery();
