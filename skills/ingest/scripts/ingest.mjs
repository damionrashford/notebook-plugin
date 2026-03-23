#!/usr/bin/env bun
/**
 * Ingest a PDF or text file into the local vector store.
 * Usage: bun ingest.mjs <file-path>
 *        bun ingest.mjs --help
 *
 * Deps auto-installed by Bun.
 */
import { readFile } from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

// ── Config ──────────────────────────────────────────────────────────
const PLUGIN_DIR = join(homedir(), '.notebook-plugin');
const STORES_DIR = join(PLUGIN_DIR, 'stores');
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMS = 384;
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

function getStoreDir() {
  const project = process.cwd();
  const hash = createHash('md5').update(project).digest('hex').slice(0, 12);
  const dir = join(STORES_DIR, hash);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureDirs() {
  mkdirSync(PLUGIN_DIR, { recursive: true });
  mkdirSync(STORES_DIR, { recursive: true });
}

// ── OCR (scanned PDF fallback) ──────────────────────────────────────
const MIN_TEXT_PER_PAGE = 50; // chars — below this, likely scanned

async function ocrPDF(filePath) {
  console.error('Text extraction found little content — trying OCR...');
  const { pdf } = await import('pdf-img-convert');
  const { createWorker } = await import('tesseract.js');

  // Convert PDF pages to PNG buffers
  const pages = await pdf(filePath, { scale: 2.0 });
  console.error(`Rendering ${pages.length} pages for OCR...`);

  const worker = await createWorker('eng');
  const texts = [];

  for (let i = 0; i < pages.length; i++) {
    console.error(`OCR page ${i + 1}/${pages.length}...`);
    const { data: { text } } = await worker.recognize(pages[i]);
    texts.push(text);
  }

  await worker.terminate();
  return texts.join('\n\n');
}

// ── PDF parsing ─────────────────────────────────────────────────────
async function parsePDF(filePath, skipOCR = false) {
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = await readFile(filePath);
  const data = await pdfParse(buffer);
  const fileName = filePath.split('/').pop() || filePath;

  let text = data.text;
  const avgCharsPerPage = data.numpages > 0 ? text.trim().length / data.numpages : 0;

  // If text extraction yielded too little, fall back to OCR
  if (avgCharsPerPage < MIN_TEXT_PER_PAGE && data.numpages > 0 && !skipOCR) {
    console.error(`Only ${Math.round(avgCharsPerPage)} chars/page — likely scanned PDF.`);
    text = await ocrPDF(filePath);
    console.error(`OCR extracted ${text.length} characters.`);
  }

  return { text, pageCount: data.numpages, fileName };
}

// ── Text chunking ───────────────────────────────────────────────────
function chunkText(text, source) {
  const cleaned = text.replace(/\n{3,}/g, '\n\n').trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\n+/);
  const chunks = [];
  let current = '';
  let index = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 > CHUNK_SIZE && current.length > 0) {
      chunks.push({ text: current.trim(), index, source });
      index++;
      const words = current.split(/\s+/);
      const overlapWords = Math.floor(CHUNK_OVERLAP / 5);
      current = words.slice(-overlapWords).join(' ') + '\n\n' + trimmed;
    } else {
      current = current ? current + '\n\n' + trimmed : trimmed;
    }
  }

  if (current.trim()) {
    chunks.push({ text: current.trim(), index, source });
  }

  // Split oversized chunks by sentence
  const finalChunks = [];
  let finalIndex = 0;
  for (const chunk of chunks) {
    if (chunk.text.length <= CHUNK_SIZE * 1.5) {
      finalChunks.push({ ...chunk, index: finalIndex++ });
    } else {
      const sentences = chunk.text.match(/[^.!?]+[.!?]+/g) || [chunk.text];
      let sub = '';
      for (const sentence of sentences) {
        if (sub.length + sentence.length > CHUNK_SIZE && sub.length > 0) {
          finalChunks.push({ text: sub.trim(), index: finalIndex++, source });
          sub = sentence;
        } else {
          sub += sentence;
        }
      }
      if (sub.trim()) {
        finalChunks.push({ text: sub.trim(), index: finalIndex++, source });
      }
    }
  }

  return finalChunks;
}

// ── Embeddings ──────────────────────────────────────────────────────
let pipelineInstance = null;

async function getExtractor() {
  if (!pipelineInstance) {
    console.error('Loading embedding model (first run downloads ~23MB)...');
    const { pipeline } = await import('@huggingface/transformers');
    pipelineInstance = await pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'fp32' });
    console.error('Embedding model loaded.');
  }
  return pipelineInstance;
}

async function embed(text) {
  const extractor = await getExtractor();
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data).slice(0, EMBEDDING_DIMS);
}

// ── Vector store ────────────────────────────────────────────────────
function getMetaPath() {
  return join(getStoreDir(), 'meta.json');
}

function loadMeta() {
  const p = getMetaPath();
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8'));
  return { sources: {} };
}

function saveMeta(meta) {
  writeFileSync(getMetaPath(), JSON.stringify(meta, null, 2));
}

async function getIndex() {
  ensureDirs();
  const { LocalIndex } = await import('vectra');
  const indexDir = join(getStoreDir(), 'index');
  const index = new LocalIndex(indexDir);
  if (!(await index.isIndexCreated())) {
    await index.createIndex();
  }
  return index;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`Usage: node ingest.mjs <file-path>

Ingest a PDF or text file into the local vector store for RAG retrieval.

Options:
  --help, -h    Show this help message
  --no-ocr      Skip OCR fallback for scanned PDFs

Supported formats: .pdf (text + scanned via OCR), .txt, .md, .csv, .json, .html
First run downloads a ~23MB embedding model (cached after).
OCR first run downloads Tesseract language data (~15MB, cached after).
Store location: ~/.notebook-plugin/stores/`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const noOCR = args.includes('--no-ocr');
  const filePath = resolve(args.find(a => !a.startsWith('--')));
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const isPDF = filePath.toLowerCase().endsWith('.pdf');
  let text, fileName, pageCount;

  if (isPDF) {
    console.error(`Parsing PDF: ${filePath}`);
    const parsed = await parsePDF(filePath, noOCR);
    text = parsed.text;
    fileName = parsed.fileName;
    pageCount = parsed.pageCount;
    console.error(`Extracted ${pageCount} pages, ${text.length} characters`);
  } else {
    text = await readFile(filePath, 'utf-8');
    fileName = filePath.split('/').pop() || filePath;
    pageCount = 0;
    console.error(`Read text file: ${fileName} (${text.length} characters)`);
  }

  const chunks = chunkText(text, fileName);
  console.error(`Created ${chunks.length} chunks`);

  const index = await getIndex();

  for (let i = 0; i < chunks.length; i++) {
    if (i % 10 === 0) {
      console.error(`Embedding chunk ${i + 1}/${chunks.length}...`);
    }
    const vector = await embed(chunks[i].text);
    await index.insertItem({
      vector,
      metadata: {
        text: chunks[i].text,
        source: chunks[i].source,
        chunkIndex: chunks[i].index,
      },
    });
  }

  const meta = loadMeta();
  meta.sources[fileName] = {
    fileName,
    pageCount,
    chunkCount: chunks.length,
    ingestedAt: new Date().toISOString(),
  };
  saveMeta(meta);

  // Structured output to stdout
  const result = {
    status: 'success',
    file: fileName,
    pages: pageCount,
    chunks: chunks.length,
    store: getStoreDir(),
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Ingest failed:', err.message);
  process.exit(1);
});
