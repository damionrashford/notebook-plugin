#!/usr/bin/env node
/**
 * NotebookLM-style dashboard — live local server.
 *
 * Serves an interactive dashboard at http://localhost:3456
 * with real-time updates via SSE when output files change.
 *
 * Usage: node dashboard.mjs -o <output-dir> [--name notebook] [--port 3456]
 *
 * Zero npm dependencies — Node.js builtins only.
 */
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, watch, unlinkSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let outDir = './output', name = 'notebook', port = 3456;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' && args[i + 1]) outDir = args[++i];
  if (args[i] === '--name' && args[i + 1]) name = args[++i];
  if (args[i] === '--port' && args[i + 1]) port = parseInt(args[++i], 10);
}
outDir = resolve(outDir);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// ── Data gathering ──────────────────────────────────────────────────
const pluginDir = join(homedir(), '.notebook-plugin');
const storesDir = join(pluginDir, 'stores');

function gatherSources() {
  let sources = [];
  let totalChunks = 0;
  if (existsSync(storesDir)) {
    const projectHash = createHash('md5').update(process.cwd()).digest('hex').slice(0, 12);
    const metaPath = join(storesDir, projectHash, 'meta.json');
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
        const raw = meta.sources || {};
        if (Array.isArray(raw)) {
          sources = raw;
        } else {
          sources = Object.values(raw).map(s => ({
            name: s.fileName || s.name || 'Unknown',
            type: (s.fileName || '').endsWith('.pdf') ? 'pdf' : 'text',
            pages: s.pageCount || s.pages || 0,
            chunks: s.chunkCount || s.chunks || 0,
          }));
        }
        totalChunks = meta.totalChunks || sources.reduce((sum, s) => sum + (s.chunks || 0), 0);
      } catch {}
    }
  }
  return { sources, totalChunks };
}

function gatherOutputs() {
  if (!existsSync(outDir)) return [];
  try {
    return readdirSync(outDir)
      .filter(f => !f.startsWith('_') && !f.startsWith('.') && f !== `${name}.html`)
      .map(f => {
        const fp = join(outDir, f);
        const st = statSync(fp);
        const ext = extname(f).slice(1);
        return {
          name: f,
          ext,
          size: st.size < 1024 ? `${st.size} B` : st.size < 1048576 ? `${(st.size / 1024).toFixed(1)} KB` : `${(st.size / 1048576).toFixed(1)} MB`,
          modifiedMs: st.mtime.getTime(),
          isHtml: ext === 'html',
        };
      })
      .sort((a, b) => b.modifiedMs - a.modifiedMs);
  } catch { return []; }
}

function getState() {
  const { sources, totalChunks } = gatherSources();
  return { sources, totalChunks, outputs: gatherOutputs() };
}

// ── SSE clients ─────────────────────────────────────────────────────
const sseClients = new Set();

function broadcast(data) {
  const jobState = {};
  for (const [type, job] of jobs) jobState[type] = job;
  const payload = { ...data, jobs: jobState };
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
}

// Watch output dir for changes
let debounce = null;
watch(outDir, { persistent: false }, () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => broadcast(getState()), 300);
});

// Also watch meta.json for source changes
const projectHash = createHash('md5').update(process.cwd()).digest('hex').slice(0, 12);
const metaDir = join(storesDir, projectHash);
if (existsSync(metaDir)) {
  watch(metaDir, { persistent: false }, (_, filename) => {
    if (filename === 'meta.json') {
      clearTimeout(debounce);
      debounce = setTimeout(() => broadcast(getState()), 300);
    }
  });
}

// ── Generation jobs ──────────────────────────────────────────────────
const jobs = new Map(); // type -> { status, startedAt, error? }
const PLUGIN_ROOT = resolve(__dirname, '..', '..', '..');
const QUERY_SCRIPT = join(PLUGIN_ROOT, 'skills', 'ingest', 'scripts', 'query.mjs');
const GENERATE_DIR = join(PLUGIN_ROOT, 'skills', 'generate', 'scripts');
const ASSETS_DIR = join(PLUGIN_ROOT, 'skills', 'generate', 'assets');

// Scripts that need bun (have npm deps auto-installed by bun)
const needsBun = new Set(['report', 'slide-deck', 'data-table']);

const TYPE_META = {
  flashcards:      { script: 'flashcards.mjs',  asset: 'flashcards.json' },
  quiz:            { script: 'quiz.mjs',         asset: 'quiz.json' },
  report:          { script: 'report.mjs',       asset: 'report-docx.json' },
  'slide-deck':    { script: 'slide-deck.mjs',   asset: 'slide-deck.json' },
  'mind-map':      { script: 'mind-map.mjs',     asset: 'mind-map.mmd' },
  infographic:     { script: 'infographic.mjs',  asset: 'infographic.json' },
  'data-table':    { script: 'data-table.mjs',   asset: 'data-table.json' },
  'audio-overview':{ script: 'audio-overview.py', asset: 'audio-overview.json' },
};

function broadcastJobs() {
  const jobState = {};
  for (const [type, job] of jobs) jobState[type] = job;
  const msg = `data: ${JSON.stringify({ ...getState(), jobs: jobState })}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
}

// ── Single-session generation pipeline ──────────────────────────────
// One claude session is created on the first generate request.
// All subsequent requests --resume into the same session.
// Source content is loaded ONCE via vector query in the first call.
// Each output type is a follow-up prompt in the same conversation.

let sessionId = null;
const jobQueue = [];
let isProcessing = false;
const claudeBin = process.env.CLAUDE_BIN || '/opt/homebrew/bin/claude';
const bunBin = process.env.BUN_BIN || join(homedir(), '.bun', 'bin', 'bun');
const claudeEnv = {
  ...process.env,
  PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${homedir()}/.bun/bin:${process.env.PATH || ''}`,
  CLAUDECODE: '',  // Allow nested invocation from dashboard server
};

function enqueueGeneration(type, topic) {
  if (jobs.has(type) && jobs.get(type).status === 'running') {
    return { error: `${type} is already generating` };
  }
  const meta = TYPE_META[type];
  if (!meta) return { error: `Unknown type: ${type}` };
  const { sources } = gatherSources();
  if (sources.length === 0) return { error: 'No sources ingested yet' };

  jobs.set(type, { status: 'queued', startedAt: Date.now() });
  broadcastJobs();
  jobQueue.push({ type, topic, meta });
  processQueue();
  return { status: 'queued', type, position: jobQueue.length };
}

async function processQueue() {
  if (isProcessing || jobQueue.length === 0) return;
  isProcessing = true;
  const { type, topic, meta } = jobQueue.shift();

  try {
    jobs.set(type, { status: 'running', startedAt: Date.now(), phase: 'querying' });
    broadcastJobs();

    // ── PHASE 1: Query vector store locally (~2s, no LLM) ──
    const chunks = await runCommand(bunBin, [QUERY_SCRIPT, topic || 'main concepts key ideas overview', '--top-k', '25']);
    if (!chunks.trim()) throw new Error('No content found in vector store');

    // ── PHASE 2: claude -p generates structured JSON (single LLM call) ──
    jobs.set(type, { ...jobs.get(type), phase: 'generating' });
    broadcastJobs();

    const assetPath = join(ASSETS_DIR, meta.asset);
    const template = existsSync(assetPath) ? readFileSync(assetPath, 'utf-8') : '';
    const inputFile = join(outDir, `_${type}_input.json`);
    const genScript = join(GENERATE_DIR, meta.script);
    const isAudio = type === 'audio-overview';
    const uvBin = process.env.UV_BIN || join(homedir(), '.local', 'bin', 'uv');
    const runner = isAudio ? uvBin : needsBun.has(type) ? bunBin : 'node';
    const runArgs = isAudio ? 'run --script' : '';
    const genCmd = `"${runner}" ${runArgs} "${genScript}" -i "${inputFile}" -o "${outDir}" --name ${type}${type === 'report' ? ' --format both' : ''}`;

    const qualityRules = getQualityRules(type);
    const topicStr = topic ? ` about "${topic}"` : '';

    // Build the prompt — if first call, include source material.
    // If resuming, source material is already in conversation context.
    let prompt;
    if (!sessionId) {
      prompt = `You are a content generator for the Notebook plugin. Your job is to produce structured JSON output from source material, then run the generator script.

SOURCE MATERIAL FROM VECTOR STORE:
${chunks.slice(0, 80000)}

---

Now generate ${type}${topicStr}.

INSTRUCTIONS:
1. Write the input JSON file to "${inputFile}". Schema:
\`\`\`
${template}
\`\`\`
Quality: ${qualityRules}
Ground ALL content in the source material above. Do NOT invent facts.

2. Run the generator:
\`\`\`bash
${genCmd}
\`\`\`

3. Confirm the output was created.`;
    } else {
      prompt = `Now generate ${type}${topicStr} from the same source material.

1. Write the input JSON to "${inputFile}". Schema:
\`\`\`
${template}
\`\`\`
Quality: ${qualityRules}

2. Run the generator:
\`\`\`bash
${genCmd}
\`\`\`

3. Confirm the output was created.`;
    }

    const result = await runClaude(prompt);

    // Capture session ID from the first call for --resume
    if (!sessionId && result.sessionId) {
      sessionId = result.sessionId;
    }

    // Clean up temp input file
    const tempInput = join(outDir, `_${type}_input.json`);
    try { if (existsSync(tempInput)) unlinkSync(tempInput); } catch {}

    jobs.set(type, { status: 'done', startedAt: jobs.get(type)?.startedAt, finishedAt: Date.now() });
    broadcastJobs();
    setTimeout(() => broadcast(getState()), 300);
  } catch (err) {
    jobs.set(type, { status: 'error', error: err.message, startedAt: jobs.get(type)?.startedAt, finishedAt: Date.now() });
    broadcastJobs();
  }

  isProcessing = false;
  processQueue(); // Process next in queue
}

// Run a local command and return stdout
function runCommand(cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { cwd: process.cwd(), env: claudeEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => code === 0 ? resolve(out) : reject(new Error(err.slice(-300) || `Exit ${code}`)));
    child.on('error', reject);
  });
}

// Run claude -p (or --resume) with the plugin loaded for agent access
function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const baseArgs = [
      '-p', prompt,
      '--allowedTools', 'Bash(*),Write(*),Read(*)',
      '--output-format', 'json',
      '--plugin-dir', PLUGIN_ROOT,
    ];
    // Resume into same session after first call
    const args = sessionId
      ? [...baseArgs, '--resume', sessionId]
      : baseArgs;

    const child = spawn(claudeBin, args, { cwd: process.cwd(), env: claudeEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => { try { child.kill(); } catch {} reject(new Error('Timed out after 4 minutes')); }, 240000);
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`Claude exited ${code}: ${err.slice(-300)}`));
      try {
        const parsed = JSON.parse(out);
        resolve({ result: parsed.result || '', sessionId: parsed.session_id || null });
      } catch {
        resolve({ result: out, sessionId: null });
      }
    });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

function getQualityRules(type) {
  const rules = {
    flashcards: '15-30 cards, no yes/no questions, tagged by topic. Front: specific question. Back: detailed answer.',
    quiz: '50 questions, 70% multiple_choice / 30% short_answer. MC answer is letter (A/B/C/D). Explanations for all.',
    report: 'Executive summary + 4-6 evidence-backed sections. Actionable conclusions.',
    'slide-deck': '8-15 slides, 3-5 bullets each. bullets and body are mutually exclusive. Speaker notes.',
    'mind-map': 'Valid Mermaid mindmap syntax. 3-6 main branches, 2-4 sub-topics. No ()[] in labels.',
    infographic: '5-8 sections with stats. Use emoji icons. Include stat values where possible.',
    'data-table': 'Specific data points from sources. Consistent columns. 10-30 rows.',
    'audio-overview': '8-15 alternating segments, af_heart and am_fenrir voices. Conversational. Strip URLs and special chars.',
  };
  return rules[type] || '';
}

// ── MIME types ───────────────────────────────────────────────────────
const MIME = {
  html: 'text/html', json: 'application/json', css: 'text/css',
  js: 'application/javascript', mjs: 'application/javascript',
  md: 'text/markdown', csv: 'text/csv', txt: 'text/plain',
  pdf: 'application/pdf', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  aiff: 'audio/aiff', mmd: 'text/plain', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif',
};

// ── HTTP server ─────────────────────────────────────────────────────
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const path = url.pathname;

  // API: state
  if (path === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(getState()));
    return;
  }

  // API: SSE events
  if (path === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    const jobState = {};
    for (const [type, job] of jobs) jobState[type] = job;
    res.write(`data: ${JSON.stringify({ ...getState(), jobs: jobState })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // API: generate
  if (path.startsWith('/api/generate/') && req.method === 'POST') {
    const type = decodeURIComponent(path.slice(14));
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      let topic = '';
      try { topic = JSON.parse(body).topic || ''; } catch {}
      const result = enqueueGeneration(type, topic);
      const status = result.error ? 400 : 200;
      res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  // API: jobs
  if (path === '/api/jobs') {
    const jobState = {};
    for (const [type, job] of jobs) jobState[type] = job;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(jobState));
    return;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  // Serve output files (with AIFF→WAV transcode for browser playback)
  if (path.startsWith('/outputs/')) {
    const fileName = decodeURIComponent(path.slice(9));
    const filePath = join(outDir, fileName);
    if (!existsSync(filePath) || !filePath.startsWith(outDir)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = extname(fileName).slice(1);
    // Browsers can't play AIFF — transcode to WAV on-the-fly via macOS afconvert
    if (ext === 'aiff') {
      const wavPath = filePath.replace(/\.aiff$/, '.wav');
      if (!existsSync(wavPath)) {
        try { execSync(`afconvert -f WAVE -d LEI16 "${filePath}" "${wavPath}"`, { stdio: 'pipe' }); }
        catch { /* serve original if transcode fails */ }
      }
      if (existsSync(wavPath)) {
        res.writeHead(200, { 'Content-Type': 'audio/wav' });
        res.end(readFileSync(wavPath));
        return;
      }
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
    return;
  }

  // Dashboard HTML
  if (path === '/' || path === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildDashboardHtml());
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(JSON.stringify({ server: url, outputDir: outDir }));
  console.error(`\n  Notebook dashboard running at ${url}\n`);
  // Auto-open in browser
  import('child_process').then(({ exec }) => exec(`open ${url}`));
});

// ── Dashboard HTML (SPA with live updates) ──────────────────────────
const dashboardDir = join(__dirname, '..', 'dashboard');
function buildDashboardHtml() {
  const css = readFileSync(join(dashboardDir, 'index.css'), 'utf8');
  const htmlTemplate = readFileSync(join(dashboardDir, 'index.html'), 'utf8');
  return htmlTemplate.replace('{{CSS}}', css);
}
