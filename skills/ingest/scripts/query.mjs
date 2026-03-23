#!/usr/bin/env bun
/**
 * Query the vector store for relevant chunks.
 * Usage: bun query.mjs "<question>" [--top-k N]
 *
 * Deps auto-installed by Bun.
 */
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

// ── Config ──────────────────────────────────────────────────────────
const PLUGIN_DIR = join(homedir(), '.notebook-plugin');
const STORES_DIR = join(PLUGIN_DIR, 'stores');
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMS = 384;

function getStoreDir() {
  const project = process.cwd();
  const hash = createHash('md5').update(project).digest('hex').slice(0, 12);
  const dir = join(STORES_DIR, hash);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Embeddings ──────────────────────────────────────────────────────
let pipelineInstance = null;

async function getExtractor() {
  if (!pipelineInstance) {
    console.error('Loading embedding model...');
    const { pipeline } = await import('@huggingface/transformers');
    pipelineInstance = await pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'fp32' });
  }
  return pipelineInstance;
}

async function embed(text) {
  const extractor = await getExtractor();
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data).slice(0, EMBEDDING_DIMS);
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`Usage: node query.mjs "<question>" [--top-k N]

Query the vector store for relevant document chunks.

Options:
  --top-k N     Number of results to return (default: 10)
  --help, -h    Show this help message`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  let topK = 10;
  let question = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--top-k' && args[i + 1]) {
      topK = parseInt(args[i + 1], 10);
      i++;
    } else if (!args[i].startsWith('--')) {
      question = args[i];
    }
  }

  if (!question) {
    console.error('No question provided.');
    process.exit(1);
  }

  const storeDir = getStoreDir();
  const indexDir = join(storeDir, 'index');

  if (!existsSync(indexDir)) {
    console.error('No documents ingested yet. Run ingest first.');
    process.exit(1);
  }

  const { LocalIndex } = await import('vectra');
  const index = new LocalIndex(indexDir);

  if (!(await index.isIndexCreated())) {
    console.error('Vector index not found. Ingest documents first.');
    process.exit(1);
  }

  console.error(`Querying: "${question}" (top-k: ${topK})`);
  const vector = await embed(question);
  const results = await index.queryItems(vector, question, topK);

  const output = results.map((r, i) => ({
    rank: i + 1,
    score: Math.round(r.score * 1000) / 1000,
    source: r.item.metadata.source,
    chunkIndex: r.item.metadata.chunkIndex,
    text: r.item.metadata.text,
  }));

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error('Query failed:', err.message);
  process.exit(1);
});
