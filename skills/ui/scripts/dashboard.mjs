#!/usr/bin/env node
/**
 * NotebookLM-style dashboard generator.
 * Reads source metadata + output directory state and produces a self-contained HTML dashboard.
 * Zero dependencies — uses only Node.js builtins.
 */
import { writeFileSync, readFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

// --- CLI args ---
const args = process.argv.slice(2);
let outDir = '.', name = 'notebook';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' && args[i + 1]) outDir = args[++i];
  if (args[i] === '--name' && args[i + 1]) name = args[++i];
}
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// --- Gather sources ---
const pluginDir = join(homedir(), '.notebook-plugin');
const storesDir = join(pluginDir, 'stores');
let sources = [];
let totalChunks = 0;
let storePath = '';

if (existsSync(storesDir)) {
  const projectHash = createHash('md5').update(process.cwd()).digest('hex').slice(0, 12);
  storePath = join(storesDir, projectHash);
  const metaPath = join(storePath, 'meta.json');
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      sources = meta.sources || [];
      totalChunks = meta.totalChunks || 0;
    } catch {}
  }
}

// --- Gather outputs ---
let outputs = [];
if (existsSync(outDir)) {
  try {
    const files = readdirSync(outDir).filter(f => !f.startsWith('_') && !f.startsWith('.'));
    outputs = files.map(f => {
      const fp = join(outDir, f);
      const st = statSync(fp);
      const ext = extname(f).slice(1);
      return {
        name: f,
        ext,
        size: st.size < 1024 ? `${st.size} B` : st.size < 1048576 ? `${(st.size / 1024).toFixed(1)} KB` : `${(st.size / 1048576).toFixed(1)} MB`,
        modifiedMs: st.mtime.getTime(),
        isHtml: ext === 'html' && f !== `${name}.html`,
      };
    }).sort((a, b) => b.modifiedMs - a.modifiedMs);
  } catch {}
}

// --- Output types ---
const outputTypes = [
  { id: 'audio-overview', icon: 'audio-lines', label: 'Audio Overview' },
  { id: 'slide-deck', icon: 'monitor', label: 'Slide Deck' },
  { id: 'report', icon: 'file-text', label: 'Report' },
  { id: 'mind-map', icon: 'git-fork', label: 'Mind Map' },
  { id: 'flashcards', icon: 'square-stack', label: 'Flashcards' },
  { id: 'quiz', icon: 'clipboard-list', label: 'Quiz' },
  { id: 'infographic', icon: 'bar-chart-3', label: 'Infographic' },
  { id: 'data-table', icon: 'table-2', label: 'Data Table' },
];

// --- Helpers ---
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- Build HTML sections ---
const sourcesHtml = sources.length === 0
  ? `<div class="sidebar-empty">
      <i data-lucide="file-text" class="sidebar-empty-icon"></i>
      <p class="sidebar-empty-title">Saved sources will appear here</p>
      <p class="sidebar-empty-desc">Run <code>/notebook:ingest</code> to add PDFs, text files, or other documents.</p>
    </div>`
  : sources.map(s => `
    <div class="source-item">
      <i data-lucide="${s.type === 'pdf' ? 'book-open' : 'file-text'}" class="source-icon"></i>
      <div class="source-details">
        <span class="source-name">${esc(s.name)}</span>
        <span class="source-meta">${s.pages ? s.pages + ' pg' : ''} ${s.chunks} chunks</span>
      </div>
    </div>`).join('\n');

const studioTilesHtml = outputTypes.map(t => `
  <div class="studio-tile" title="/notebook:generate ${t.id}">
    <i data-lucide="${t.icon}"></i>
    <span>${t.label}</span>
  </div>`).join('\n');

const studioOutputsHtml = outputs.length === 0
  ? `<div class="studio-empty">
      <i data-lucide="wand-sparkles" class="studio-empty-icon"></i>
      <p class="studio-empty-title">Studio output will be saved here.</p>
      <p class="studio-empty-desc">After adding sources, generate an Audio Overview, Report, Mind Map, and more.</p>
    </div>`
  : outputs.map(o => `
    <${o.isHtml ? 'a' : 'div'} class="output-item${o.isHtml ? ' output-item--link' : ''}" ${o.isHtml ? `href="${esc(o.name)}" target="_blank"` : ''}>
      <i data-lucide="${o.ext === 'html' ? 'globe' : o.ext === 'json' ? 'braces' : o.ext === 'pptx' ? 'presentation' : o.ext === 'aiff' ? 'audio-lines' : 'file-text'}" class="output-icon"></i>
      <span class="output-name">${esc(o.name)}</span>
      <span class="output-size">${o.size}</span>
    </${o.isHtml ? 'a' : 'div'}>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Notebook</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"><\/script>
<style>
  :root {
    --bg: #1a1a1e;
    --surface: #242428;
    --surface-hover: #2c2c32;
    --border: #333338;
    --border-light: #2a2a2f;
    --text: #e8e8ec;
    --text-2: #a0a0a8;
    --text-3: #68686f;
    --accent: #7c6aff;
    --accent-dim: rgba(124,106,255,0.08);
    --radius: 12px;
    --radius-sm: 8px;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --mono: 'SF Mono', 'Fira Code', monospace;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }
  a { color:inherit; text-decoration:none; }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:4px; }

  /* ── Header ── */
  .header {
    height: 56px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .header-left { display:flex; align-items:center; gap:12px; }
  .logo {
    width:32px; height:32px;
    background: linear-gradient(135deg, var(--accent), #a78bfa);
    border-radius: var(--radius-sm);
    display:flex; align-items:center; justify-content:center;
  }
  .logo i { width:16px; height:16px; color:#fff; }
  .header-title { font-size:15px; font-weight:600; letter-spacing:-0.01em; }
  .header-right { display:flex; align-items:center; gap:8px; }
  .header-stat {
    font-size:12px; color:var(--text-3);
    padding:4px 10px;
    background:var(--surface);
    border-radius:20px;
  }
  .header-stat strong { color:var(--text-2); font-weight:600; }

  /* ── Three-column layout ── */
  .layout {
    flex:1;
    display:grid;
    grid-template-columns:280px 1fr 280px;
    min-height:0;
  }

  /* ── Sidebar shared ── */
  .sidebar {
    border-right:1px solid var(--border);
    display:flex;
    flex-direction:column;
    overflow:hidden;
  }
  .sidebar:last-child { border-right:none; border-left:1px solid var(--border); }
  .sidebar-head {
    padding:16px 20px;
    font-size:13px;
    font-weight:600;
    color:var(--text-2);
    display:flex;
    align-items:center;
    justify-content:space-between;
    border-bottom:1px solid var(--border-light);
    flex-shrink:0;
  }
  .sidebar-head-right { display:flex; align-items:center; gap:4px; }
  .sidebar-head-right i { width:16px; height:16px; color:var(--text-3); cursor:pointer; opacity:0.6; }
  .sidebar-head-right i:hover { opacity:1; }
  .sidebar-body {
    flex:1;
    overflow-y:auto;
    padding:8px;
  }
  .sidebar-body::-webkit-scrollbar { width:4px; }
  .sidebar-body::-webkit-scrollbar-thumb { background:var(--border); border-radius:4px; }

  /* ── Sources ── */
  .source-item {
    display:flex;
    align-items:center;
    gap:10px;
    padding:10px 12px;
    border-radius:var(--radius-sm);
    transition:background 0.15s;
    cursor:default;
  }
  .source-item:hover { background:var(--surface); }
  .source-icon { width:18px; height:18px; color:var(--text-3); flex-shrink:0; }
  .source-details { min-width:0; }
  .source-name {
    display:block;
    font-size:13px; font-weight:500;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .source-meta { font-size:11px; color:var(--text-3); }

  /* ── Center panel ── */
  .center {
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    padding:40px;
    overflow-y:auto;
    position:relative;
  }
  .center-empty {
    text-align:center;
    max-width:420px;
  }
  .center-empty-icon {
    width:48px; height:48px;
    color:var(--accent);
    opacity:0.5;
    margin-bottom:20px;
  }
  .center-empty h2 {
    font-size:20px;
    font-weight:600;
    color:var(--text);
    margin-bottom:8px;
  }
  .center-empty p {
    font-size:14px;
    color:var(--text-3);
    line-height:1.6;
    margin-bottom:24px;
  }
  .center-empty-btn {
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:10px 24px;
    background:var(--surface);
    border:1px solid var(--border);
    border-radius:var(--radius);
    font-size:14px;
    color:var(--text-2);
    cursor:default;
    transition:all 0.15s;
  }
  .center-empty-btn:hover { border-color:var(--accent); color:var(--text); }
  .center-empty-btn i { width:16px; height:16px; }

  /* Center — with outputs */
  .center-outputs {
    align-items:stretch;
    justify-content:flex-start;
    padding:24px 32px;
  }
  .center-outputs-head {
    display:flex;
    align-items:center;
    justify-content:space-between;
    margin-bottom:16px;
  }
  .center-outputs-title { font-size:14px; font-weight:600; color:var(--text-2); }
  .center-outputs-count { font-size:12px; color:var(--text-3); }
  .output-list { display:flex; flex-direction:column; gap:2px; }
  .output-item {
    display:grid;
    grid-template-columns:20px 1fr auto;
    align-items:center;
    gap:10px;
    padding:10px 12px;
    border-radius:var(--radius-sm);
    transition:background 0.15s;
  }
  .output-item:hover { background:var(--surface); }
  .output-item--link { cursor:pointer; }
  .output-item--link:hover { background:var(--surface-hover); }
  .output-icon { width:16px; height:16px; color:var(--text-3); }
  .output-item:hover .output-icon { color:var(--text-2); }
  .output-name { font-size:13px; font-weight:400; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .output-size { font-size:11px; color:var(--text-3); font-variant-numeric:tabular-nums; }

  /* Bottom bar */
  .bottom-bar {
    padding:16px 20px;
    border-top:1px solid var(--border-light);
    display:flex;
    align-items:center;
    gap:12px;
    flex-shrink:0;
  }
  .bottom-bar-text { flex:1; font-size:13px; color:var(--text-3); }
  .bottom-bar-text strong { color:var(--text-2); }
  .bottom-bar-arrow {
    width:32px; height:32px;
    display:flex; align-items:center; justify-content:center;
    background:var(--surface);
    border-radius:50%;
    transition:background 0.15s;
    cursor:default;
  }
  .bottom-bar-arrow:hover { background:var(--surface-hover); }
  .bottom-bar-arrow i { width:16px; height:16px; color:var(--text-2); }

  /* ── Studio tiles ── */
  .studio-tiles {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:4px;
    padding:4px 0;
  }
  .studio-tile {
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:6px;
    padding:16px 8px;
    border-radius:var(--radius-sm);
    cursor:default;
    transition:background 0.15s;
    text-align:center;
  }
  .studio-tile:hover { background:var(--surface); }
  .studio-tile i { width:22px; height:22px; color:var(--text-2); }
  .studio-tile:hover i { color:var(--text); }
  .studio-tile span {
    font-size:11px; color:var(--text-3); font-weight:500;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    max-width:100%;
  }
  .studio-tile:hover span { color:var(--text-2); }

  .studio-divider {
    height:1px;
    background:var(--border-light);
    margin:4px 8px;
  }

  /* ── Sidebar empty states ── */
  .sidebar-empty, .studio-empty {
    text-align:center;
    padding:32px 16px;
  }
  .sidebar-empty-icon, .studio-empty-icon {
    width:28px; height:28px;
    color:var(--text-3);
    opacity:0.5;
    margin-bottom:12px;
  }
  .sidebar-empty-title, .studio-empty-title {
    font-size:13px; font-weight:500; color:var(--text-2);
    margin-bottom:4px;
  }
  .sidebar-empty-desc, .studio-empty-desc {
    font-size:12px; color:var(--text-3); line-height:1.5;
  }
  .sidebar-empty-desc code {
    font-family:var(--mono);
    font-size:11px;
    color:var(--accent);
    background:var(--accent-dim);
    padding:2px 6px;
    border-radius:4px;
  }

  /* ── Responsive ── */
  @media (max-width:960px) {
    .layout { grid-template-columns:1fr; grid-template-rows:auto 1fr auto; }
    .sidebar { border-right:none; border-bottom:1px solid var(--border); max-height:200px; }
    .sidebar:last-child { border-left:none; border-top:1px solid var(--border); border-bottom:none; max-height:240px; }
    .studio-tiles { grid-template-columns:repeat(4,1fr); }
  }
  @media (max-width:600px) {
    .studio-tiles { grid-template-columns:repeat(2,1fr); }
    .header-stat { display:none; }
  }
</style>
</head>
<body>

<header class="header">
  <div class="header-left">
    <div class="logo"><i data-lucide="notebook-pen"></i></div>
    <span class="header-title">Notebook</span>
  </div>
  <div class="header-right">
    <span class="header-stat"><strong>${sources.length}</strong> sources</span>
    <span class="header-stat"><strong>${totalChunks}</strong> chunks</span>
  </div>
</header>

<div class="layout">
  <!-- LEFT: Sources -->
  <div class="sidebar">
    <div class="sidebar-head">
      Sources
      <div class="sidebar-head-right"><i data-lucide="plus" title="Add source"></i></div>
    </div>
    <div class="sidebar-body">
      ${sourcesHtml}
    </div>
    <div class="bottom-bar">
      <span class="bottom-bar-text">${sources.length === 0 ? 'Upload a source to get started' : `<strong>${sources.length}</strong> source${sources.length !== 1 ? 's' : ''}`}</span>
      <div class="bottom-bar-arrow"><i data-lucide="arrow-right"></i></div>
    </div>
  </div>

  <!-- CENTER: Main content area -->
  <div class="center${outputs.length > 0 ? ' center-outputs' : ''}">
    ${outputs.length === 0 ? `
    <div class="center-empty">
      <i data-lucide="upload" class="center-empty-icon"></i>
      <h2>Add a source to get started</h2>
      <p>Ingest a PDF or text file, then generate Audio Overviews, Reports, Flashcards, Mind Maps, and more.</p>
      <div class="center-empty-btn"><i data-lucide="file-plus"></i> /notebook:ingest &lt;file&gt;</div>
    </div>
    ` : `
    <div class="center-outputs-head">
      <span class="center-outputs-title">Generated Outputs</span>
      <span class="center-outputs-count">${outputs.length} file${outputs.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="output-list">
      ${outputs.map(o => `
        <${o.isHtml ? 'a' : 'div'} class="output-item${o.isHtml ? ' output-item--link' : ''}" ${o.isHtml ? `href="${esc(o.name)}" target="_blank"` : ''}>
          <i data-lucide="${o.ext === 'html' ? 'globe' : o.ext === 'json' ? 'braces' : o.ext === 'pptx' ? 'presentation' : o.ext === 'aiff' ? 'audio-lines' : 'file-text'}" class="output-icon"></i>
          <span class="output-name">${esc(o.name)}</span>
          <span class="output-size">${o.size}</span>
        </${o.isHtml ? 'a' : 'div'}>`).join('\\n')}
    </div>
    `}
  </div>

  <!-- RIGHT: Studio -->
  <div class="sidebar">
    <div class="sidebar-head">
      Studio
      <div class="sidebar-head-right"><i data-lucide="panel-right-close" title="Toggle panel"></i></div>
    </div>
    <div class="sidebar-body">
      <div class="studio-tiles">
        ${studioTilesHtml}
      </div>
      <div class="studio-divider"></div>
      ${studioOutputsHtml}
    </div>
  </div>
</div>

<script>lucide.createIcons();<\/script>
</body>
</html>`;

const outPath = join(outDir, `${name}.html`);
writeFileSync(outPath, html);
console.log(JSON.stringify({ output: outPath, sources: sources.length, chunks: totalChunks, outputs: outputs.length }));
