#!/usr/bin/env node
/**
 * List all ingested sources in the vector store.
 * Usage: node list.mjs
 */
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const PLUGIN_DIR = join(homedir(), '.notebook-plugin');
const STORES_DIR = join(PLUGIN_DIR, 'stores');

function getStoreDir() {
  const project = process.cwd();
  const hash = createHash('md5').update(project).digest('hex').slice(0, 12);
  return join(STORES_DIR, hash);
}

function main() {
  const storeDir = getStoreDir();
  const metaPath = join(storeDir, 'meta.json');

  if (!existsSync(metaPath)) {
    console.log(JSON.stringify({ sources: [], message: 'No documents ingested yet.' }));
    return;
  }

  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  const sources = Object.values(meta.sources);

  if (sources.length === 0) {
    console.log(JSON.stringify({ sources: [], message: 'No documents ingested yet.' }));
    return;
  }

  console.log(JSON.stringify({ sources, store: storeDir }, null, 2));
}

main();
