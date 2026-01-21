import os
import hashlib
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility
from langchain_text_splitters import RecursiveCharacterTextSplitter
from PyPDF2 import PdfReader
from dotenv import load_dotenv
import anthropic
from embeddings import get_embedding_provider
load_dotenv()

# Config from environment variables
MILVUS_HOST = os.environ["MILVUS_HOST"]
MILVUS_PORT = os.environ["MILVUS_PORT"]
CHUNKS_COLLECTION_NAME = os.environ.get("CHUNKS_COLLECTION_NAME", "test")
PAGES_COLLECTION_NAME = os.environ.get("PAGES_COLLECTION_NAME", "page_with_meta")
EMBEDDING_DIM = int(os.environ["EMBEDDING_DIM"])
PDF_DIR = os.environ["PDF_DIR"]

# Connect to DB
connections.connect("default", host=MILVUS_HOST, port=MILVUS_PORT)


def get_pdf_hash(file_path):
    """Create a hash fingerprint for a PDF to detect content changes."""
    with open(file_path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def load_and_split_pdf(file_path, file_id):
    """Extract text from PDF and split into chunks with global page tracking."""
    reader = PdfReader(file_path)
    chunks_with_pages = []
    pages_with_meta = []

    for page_num, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        if page_text.strip():
            # Create globally unique page_id
            page_id = f"{file_id}_page_{page_num}"
            
            # Split page into chunks
            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            page_chunks = splitter.split_text(page_text)
            
            for chunk in page_chunks:
                chunks_with_pages.append({
                    'text': chunk,
                    'page_id': page_id
                })
            
            # Store page metadata (one per page)
            pages_with_meta.append({
                'page_id': page_id,
                'page_text': page_text,
                'file_id': file_id,
                'local_page_num': page_num
            })

    return chunks_with_pages, pages_with_meta


def get_existing_hashes(collection):
    collection.load()
    try:
        results = collection.query(
            expr="chunk_id >= 0",
            output_fields=["filename", "file_hash"],
            limit=10000
        )
        return {r["filename"]: r["file_hash"] for r in results}
    except Exception as e:
        print(f"Could not query existing hashes: {e}")
        return {}


def get_existing_page_ids(page_collection):
    page_collection.load()
    try:
        results = page_collection.query(
            expr="local_page_num >= 0",
            output_fields=["page_id"],
            limit=1000
        )
        return {r["page_id"] for r in results}
    except Exception as e:
        print(f"Could not query existing page_ids: {e}")
        return set()


def get_max_chunk_id(collection):
    collection.load()
    try:
        results = collection.query(
            expr="chunk_id >= 0",
            output_fields=["chunk_id"],
            limit=10000
        )
        if results:
            return max(r["chunk_id"] for r in results)
        return -1
    except Exception as e:
        print(f"Could not query max chunk_id: {e}")
        return -1


def insert_embeddings(collection, file_name, file_hash, chunks_data, embeddings, start_chunk_id):
    """Insert new embeddings into Milvus with all required fields."""
    num_chunks = len(chunks_data)

    # Safety check: No chunks
    if num_chunks == 0:
        print(f"WARNING: No chunks found for {file_name}, skipping insertion.")
        return False

    # Safety check: Embedding mismatch
    if not embeddings or len(embeddings) != num_chunks:
        print(f"WARNING: Embedding mismatch for {file_name}: {len(embeddings) if embeddings else 0} embeddings for {num_chunks} chunks. Skipping.")
        return False

    file_id = os.path.splitext(file_name)[0]

    entities = [
        list(range(start_chunk_id, start_chunk_id + num_chunks)),  # chunk_id
        [file_id] * num_chunks,                                    # fileID
        [file_name] * num_chunks,                                  # filename
        [file_hash] * num_chunks,                                  # file_hash
        [chunk['page_id'] for chunk in chunks_data],               # page_id
        list(range(len(chunks_data))),                             # chunk_index
        [chunk['text'] for chunk in chunks_data],                  # chunk_text
        [chunk['text'][:200] + "..." if len(chunk['text']) > 200 else chunk['text'] for chunk in chunks_data],  # summary
        [PDF_DIR] * num_chunks,                                    # location
        embeddings,                                                # chunk (vector)
    ]
    collection.insert(entities)
    print(f"Inserted {num_chunks} chunks from '{file_name}' into Milvus.")
    return True


def insert_page_summaries(page_collection, pages_data, existing_page_ids, embedding_provider):
    """Insert page summaries into the page metadata collection."""
    import time

    # Filter out pages that already exist
    new_pages = [p for p in pages_data if p['page_id'] not in existing_page_ids]

    if not new_pages:
        print("No new pages to summarize.")
        return True

    print(f"\n{'='*70}")
    print(f"Generating summaries for {len(new_pages)} pages...")
    print(f"{'='*70}")

    page_ids = []
    file_ids = []
    local_page_nums = []
    summaries = []

    start_time = time.time()
    failed_pages = []

    for idx, page_data in enumerate(new_pages, 1):
        try:
            page_start = time.time()

            print(f"\n[{idx}/{len(new_pages)}] Page {page_data['local_page_num']} from '{page_data['file_id']}'")
            print(f"  -> Calling API...", end=" ", flush=True)

            summary = write_summary(page_data['page_text'])

            page_duration = time.time() - page_start
            elapsed = time.time() - start_time
            avg_time = elapsed / idx
            remaining = (len(new_pages) - idx) * avg_time

            print(f"OK - Done in {page_duration:.1f}s")
            print(f"  -> Progress: {idx}/{len(new_pages)} | Elapsed: {elapsed:.0f}s | Est. remaining: {remaining:.0f}s")

            page_ids.append(page_data['page_id'])
            file_ids.append(page_data['file_id'])
            local_page_nums.append(page_data['local_page_num'])
            summaries.append(summary)

        except Exception as e:
            error_msg = str(e)[:150]
            print(f"FAILED: {error_msg}")
            failed_pages.append((page_data['page_id'], error_msg))

            # Add placeholder to keep lists aligned
            page_ids.append(page_data['page_id'])
            file_ids.append(page_data['file_id'])
            local_page_nums.append(page_data['local_page_num'])
            summaries.append(f"[ERROR: Summary generation failed]")

    total_duration = time.time() - start_time

    print(f"\n{'='*70}")
    print(f"Summary generation complete!")
    print(f"  Total time: {total_duration:.1f}s ({total_duration/len(new_pages):.1f}s avg per page)")
    print(f"  Success: {len(new_pages) - len(failed_pages)}/{len(new_pages)}")
    if failed_pages:
        print(f"  WARNING - Failed: {len(failed_pages)} pages")
        for page_id, error in failed_pages[:3]:
            print(f"    - {page_id}: {error}")
    print(f"{'='*70}\n")

    # Safety check: No summaries generated
    if not summaries:
        print("WARNING: No summaries generated, skipping page insertion.")
        return False

    # Generate embeddings for the summaries
    print(f"Generating embeddings for {len(summaries)} summaries...")
    try:
        summary_embeddings = embedding_provider.get_embeddings(summaries)
    except Exception as e:
        print(f"WARNING: Failed to generate summary embeddings: {e}")
        return False

    # Safety check: Embedding mismatch
    if not summary_embeddings or len(summary_embeddings) != len(summaries):
        print(f"WARNING: Summary embedding mismatch. Skipping page insertion.")
        return False

    entities = [
        page_ids,
        file_ids,
        local_page_nums,
        summaries,
        summary_embeddings
    ]

    page_collection.insert(entities)
    print(f"Inserted {len(new_pages)} page summaries into {PAGES_COLLECTION_NAME}.")
    return True


def write_summary(pdf, timeout=90, max_length=550):
    """Generate a summary using Claude API with timeout and length protection."""
    SYSTEMPROMPT = """You are a precise summarization assistant. Your task is to distill PDF page content into concise summaries.

CRITICAL REQUIREMENTS:
- Total length: MAXIMUM 500 characters (STRICT LIMIT - will be truncated if longer)
- Extract exactly 3 short bullet points (5-10 words each)
- Follow with a 2-3 sentence summary
- Use clear, direct language without filler words
- Focus on key insights only

FORMAT:
- Point 1
- Point 2
- Point 3

Summary: [2-3 sentences]

BE CONCISE. Every character counts."""

    truncated_pdf = pdf[:10000] if len(pdf) > 10000 else pdf

    try:
        client = anthropic.Anthropic(timeout=timeout)
        message = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=250,
            system=SYSTEMPROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Summarize this PDF page (MAX 500 chars):\n\n{truncated_pdf}"
                }
            ],
        )

        # Extract text from TextBlock only (ignore ThinkingBlock etc.)
        summary = ""
        for block in message.content:
            if hasattr(block, 'text'):
                summary += block.text  # type: ignore[union-attr]
        
        if not summary:
            raise Exception("No text content in API response")

        if len(summary) > max_length:
            print(f"Summary too long ({len(summary)} chars), truncating to {max_length}...")
            summary = summary[:max_length-3] + "..."

        return summary
    
    except anthropic.APITimeoutError:
        raise Exception(f"Claude API timeout after {timeout}s")
    except anthropic.APIError as e:
        raise Exception(f"Claude API error: {str(e)[:200]}")
    except Exception as e:
        raise Exception(f"Unexpected error: {str(e)[:200]}")


def main():
    collection = Collection(CHUNKS_COLLECTION_NAME)
    page_collection = Collection(PAGES_COLLECTION_NAME)

    existing_hashes = get_existing_hashes(collection)
    existing_page_ids = get_existing_page_ids(page_collection)
    embedding_provider = get_embedding_provider()

    next_chunk_id = get_max_chunk_id(collection) + 1

    pdf_files = [f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")]
    
    # Track results
    processed = []
    skipped = []
    failed = []

    for pdf_file in pdf_files:
        file_path = os.path.join(PDF_DIR, pdf_file)
        file_id = os.path.splitext(pdf_file)[0]

        try:
            file_hash = get_pdf_hash(file_path)

            if pdf_file in existing_hashes:
                if existing_hashes[pdf_file] == file_hash:
                    print(f"Skipping '{pdf_file}' (no changes).")
                    skipped.append(pdf_file)
                    continue
                else:
                    print(f"Updating changed file: {pdf_file}")
                    collection.delete(expr=f"filename == '{pdf_file}'")
                    page_collection.delete(expr=f"file_id == '{file_id}'")

            # Load PDF and get both chunks and page metadata
            chunks_data, pages_data = load_and_split_pdf(file_path, file_id)

            # Safety check: No content extracted
            if not chunks_data:
                print(f"WARNING: No content extracted from {pdf_file}, skipping.")
                failed.append((pdf_file, "No content extracted"))
                continue

            # Insert page summaries FIRST
            insert_page_summaries(page_collection, pages_data, existing_page_ids, embedding_provider)

            # Generate embeddings for chunks
            chunk_texts = [chunk['text'] for chunk in chunks_data]
            try:
                embeddings = embedding_provider.get_embeddings(chunk_texts)
            except Exception as e:
                print(f"WARNING: Failed to generate embeddings for {pdf_file}: {e}")
                failed.append((pdf_file, f"Embedding failed: {str(e)[:50]}"))
                continue

            # Safety check: No embeddings
            if not embeddings or len(embeddings) == 0:
                print(f"WARNING: No embeddings generated for {pdf_file}, skipping.")
                failed.append((pdf_file, "No embeddings generated"))
                continue

            # Insert chunks
            success = insert_embeddings(collection, pdf_file, file_hash, chunks_data, embeddings, next_chunk_id)

            if success:
                next_chunk_id += len(chunks_data)
                processed.append(pdf_file)
            else:
                failed.append((pdf_file, "Insertion failed"))

        except Exception as e:
            error_msg = str(e)[:100]
            print(f"\nERROR processing '{pdf_file}': {error_msg}")
            print(f"Continuing with next file...\n")
            failed.append((pdf_file, error_msg))
            continue

    # Final summary
    print(f"\n{'='*70}")
    print("PROCESSING COMPLETE")
    print(f"{'='*70}")
    print(f"  Processed: {len(processed)}")
    print(f"  Skipped (unchanged): {len(skipped)}")
    print(f"  Failed: {len(failed)}")
    if failed:
        print(f"\nFailed files:")
        for filename, reason in failed:
            print(f"  - {filename}: {reason}")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    main()
