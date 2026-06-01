// Browser-side LLM + RAG client.
//
// IMPORTANT: This module runs in the user's browser ONLY. It is the single
// place where the user's LLM API key is read and sent over the network – and
// it is sent DIRECTLY to the configured LLM provider, never to our own
// Next.js server.
//
// Our server only ever sees the search query (sent to /api/milvus to look up
// vector matches) and the resulting document metadata. The key, the full
// prompt and the LLM's answer never touch our backend.
//
// For this to work the LLM provider must accept browser requests:
//   - Anthropic (api.anthropic.com): requires the request header
//       "anthropic-dangerous-direct-browser-access: true"
//     and a CORS-aware response (Anthropic sends it when the header above is
//     set).
//   - Self-hosted / proxy endpoints (LongCat, vLLM, custom gateways): the
//     operator MUST configure CORS to allow this origin, otherwise the
//     browser will block the response (the request itself goes out, but the
//     answer is not readable from JS).

const DEFAULT_ANTHROPIC_BASE = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Retrieve top page + chunk hits from Milvus by hitting our own server's
 * /api/milvus endpoint. Only the search query leaves the browser here.
 *
 * @param {string} query
 * @returns {Promise<{pages: Array, chunks: Array}>}
 */
export async function retrieveContext(query, { pageLimit = 4, chunkLimit = 8 } = {}) {
  const [pagesRes, chunksRes] = await Promise.all([
    fetch('/api/milvus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'searchText',
        query,
        collection: 'pages',
        limit: pageLimit,
      }),
    }).then((r) => r.json()),
    fetch('/api/milvus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'searchText',
        query,
        collection: 'chunks',
        limit: chunkLimit,
      }),
    }).then((r) => r.json()),
  ]);

  return {
    pages: pagesRes?.results || [],
    chunks: chunksRes?.results || [],
  };
}

/**
 * Turn raw Milvus results into the structured shape that the UI's
 * <MilvusResults /> component expects.
 */
export function structureResults({ pages, chunks }, { minScore = 0.25, maxItems = 5 } = {}) {
  const structured = [];

  (pages || []).forEach((r) => {
    structured.push({
      type: 'page',
      score: r.score || 0,
      metadata: {
        page_id: r.page_id,
        file_id: r.file_id,
        local_page_num: r.local_page_num,
      },
      content: r.summary || 'No summary available',
    });
  });

  (chunks || []).forEach((r) => {
    structured.push({
      type: 'chunk',
      score: r.score || 0,
      metadata: {
        fileID: r.fileID,
        filename: r.filename,
        page: r.page,
        chunk_index: r.chunk_index,
        location: r.location,
      },
      content: r.chunk_text || 'No content available',
    });
  });

  structured.sort((a, b) => b.score - a.score);
  return structured.filter((r) => r.score >= minScore).slice(0, maxItems);
}

/**
 * Build a numbered context block matching the citation marks (e.g. [1], [2])
 * we tell the LLM to use.
 */
function buildContextText(structured) {
  if (!structured || structured.length === 0) {
    return '(Keine relevanten Dokumente in der Wissensdatenbank gefunden.)';
  }
  return structured
    .map((r, i) => {
      const meta = r.metadata || {};
      const source =
        r.type === 'chunk'
          ? `${meta.filename || meta.fileID || 'Unbekannt'}${
              meta.page ? `, Seite ${meta.page}` : ''
            }`
          : `${meta.file_id || 'Unbekannt'}${
              meta.local_page_num ? `, Seite ${meta.local_page_num}` : ''
            }`;
      return `[${i + 1}] Quelle: ${source}\n${r.content || ''}`.trim();
    })
    .join('\n\n---\n\n');
}

function buildSystemPrompt(contextText) {
  return `Du bist der StuV-Copilot, ein hilfsbereiter Assistent für DHBW-Studierende.

Beantworte die Frage des Nutzers ausschließlich auf Basis des unten bereitgestellten Kontexts aus der Wissensdatenbank.
- Wenn der Kontext keine ausreichende Information enthält, sage das ehrlich und rate nicht.
- Erfinde keine Fakten, Paragraphen, Links oder Zahlen.
- Antworte auf Deutsch, klar und kompakt.
- Zitiere genutzte Quellen am Satzende mit eckigen Klammern entsprechend der Nummerierung, z. B. [1], [2].

KONTEXT:
${contextText}`;
}

/**
 * Call an Anthropic-compatible LLM directly from the browser.
 *
 * @param {Object} args
 * @param {Array}  args.messages  conversation history [{role, content}]
 * @param {Array}  args.structured the structured Milvus results used as context
 * @param {Object} args.llmConfig {apiKey, baseURL?, model?}
 * @param {AbortSignal} [args.signal]
 * @returns {Promise<{text: string, model: string, usage: {input_tokens:number, output_tokens:number}}>}
 */
export async function askLLMDirect({ messages, structured, llmConfig, signal }) {
  if (!llmConfig?.apiKey) {
    throw new Error('Kein API-Key bereitgestellt');
  }

  const baseURL = (llmConfig.baseURL || DEFAULT_ANTHROPIC_BASE).replace(/\/+$/, '');
  const model = llmConfig.model || DEFAULT_MODEL;

  const cleaned = (messages || [])
    .filter(
      (m) =>
        m &&
        typeof m.role === 'string' &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
    )
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

  if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== 'user') {
    throw new Error('Keine Nutzerfrage erkannt.');
  }

  const systemPrompt = buildSystemPrompt(buildContextText(structured));

  // Hard caps – the API key is the user's, so we want to avoid runaway cost
  // due to a bug or a malicious page hijacking the tab.
  const safeMessages = cleaned.slice(-20).map((m) => ({
    role: m.role,
    content: m.content.length > 8000 ? m.content.slice(0, 8000) : m.content,
  }));

  const response = await fetch(`${baseURL}/v1/messages`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': llmConfig.apiKey,
      'anthropic-version': '2023-06-01',
      // Required by Anthropic for browser-originating requests so they
      // actually return a CORS-allowed response. Custom proxies typically
      // ignore this header.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: safeMessages,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message || body?.message || JSON.stringify(body);
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(`LLM ${response.status} ${response.statusText}: ${detail}`.trim());
  }

  const data = await response.json();
  const text = (data.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  return {
    text: text || '(Keine Antwort vom LLM erhalten.)',
    model: data.model || model,
    usage: {
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    },
  };
}