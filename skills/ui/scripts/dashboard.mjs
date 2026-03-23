#!/usr/bin/env node
/**
 * NotebookLM-style dashboard generator.
 * Reads source metadata + output directory state and produces a self-contained HTML dashboard.
 * Zero dependencies — uses only Node.js builtins.
 */
import { writeFileSync, readFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';
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
        modified: st.mtime.toISOString().slice(0, 16).replace('T', ' '),
        isHtml: ext === 'html' && f !== `${name}.html`,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  } catch {}
}

// --- Output type cards ---
const outputTypes = [
  { id: 'flashcards', icon: 'layers', label: 'Flashcards', desc: 'Interactive study cards with flip animations, keyboard nav, and tag filtering', files: '.json + .md + .html' },
  { id: 'quiz', icon: 'clipboard-check', label: 'Quiz', desc: '50-question assessment with live scoring, progress tracking, and explanations', files: '.json + .md + .html' },
  { id: 'report', icon: 'file-text', label: 'Report', desc: 'Structured analysis with executive summary, evidence-backed findings, and recommendations', files: '.md + .docx' },
  { id: 'slide-deck', icon: 'presentation', label: 'Slide Deck', desc: 'Professional presentation with dark theme, speaker notes, and structured flow', files: '.pptx' },
  { id: 'mind-map', icon: 'brain', label: 'Mind Map', desc: 'Interactive Mermaid diagram showing concept relationships and hierarchies', files: '.mmd + .html' },
  { id: 'infographic', icon: 'bar-chart-3', label: 'Infographic', desc: 'Visual summary with gradient theme, key stats, and sectioned content', files: '.html' },
  { id: 'data-table', icon: 'table-2', label: 'Data Table', desc: 'Sortable, filterable table with CSV/JSON export and inline search', files: '.csv + .json + .md + .html' },
  { id: 'audio-overview', icon: 'mic', label: 'Audio Overview', desc: 'Podcast-style two-host discussion with alternating voices (macOS)', files: '.aiff' },
];

// --- Escape HTML ---
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- Generate HTML ---
const extToIcon = { html: 'globe', json: 'braces', md: 'file-text', pptx: 'presentation', docx: 'file-text', csv: 'table-2', mmd: 'brain', aiff: 'mic' };

const sourcesHtml = sources.length === 0
  ? '<div class="empty-state"><i data-lucide="inbox" class="empty-lucide"></i><p>No sources ingested yet</p><p class="hint">Run <code>/notebook:ingest &lt;file&gt;</code> to add a PDF or text file</p></div>'
  : sources.map(s => `
    <div class="source-card">
      <div class="source-icon-wrap"><i data-lucide="${s.type === 'pdf' ? 'book-open' : 'file-text'}"></i></div>
      <div class="source-info">
        <div class="source-name">${esc(s.name)}</div>
        <div class="source-meta">${s.pages ? s.pages + ' pages · ' : ''}${s.chunks} chunks · ${s.type?.toUpperCase() || 'TEXT'}</div>
      </div>
    </div>`).join('\n');

const outputCardsHtml = outputTypes.map(t => `
  <div class="gen-card" data-type="${t.id}">
    <div class="gen-icon-wrap"><i data-lucide="${t.icon}"></i></div>
    <div class="gen-info">
      <div class="gen-label">${t.label}</div>
      <div class="gen-desc">${t.desc}</div>
      <div class="gen-files">${t.files}</div>
    </div>
    <span class="gen-tooltip">/notebook:${t.id}</span>
  </div>`).join('\n');

const outputsHtml = outputs.length === 0
  ? '<div class="empty-state"><i data-lucide="inbox" class="empty-lucide"></i><p>No outputs generated yet</p><p class="hint">Choose an output type above to generate from your sources</p></div>'
  : outputs.map(o => `
    <div class="output-row${o.isHtml ? ' clickable' : ''}">
      <span class="output-icon-wrap"><i data-lucide="${extToIcon[o.ext] || 'file'}"></i></span>
      <span class="output-name">${esc(o.name)}</span>
      <span class="output-size">${o.size}</span>
      <span class="output-date">${o.modified}</span>
      ${o.isHtml ? '<span class="output-open"><i data-lucide="external-link"></i> Open</span>' : ''}
    </div>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Notebook — Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"><\/script>
<style>
  :root {
    --bg-primary: #0a0a0f;
    --bg-secondary: #111118;
    --bg-card: #1a1a25;
    --bg-card-hover: #22222f;
    --bg-elevated: #252532;
    --border: #2a2a3a;
    --border-hover: #3a3a4e;
    --text-primary: #f0f0f5;
    --text-secondary: #9090a8;
    --text-muted: #606078;
    --accent: #7c6aff;
    --accent-hover: #6c5ce7;
    --accent-glow: rgba(124, 106, 255, 0.12);
    --accent-soft: rgba(124, 106, 255, 0.08);
    --success: #10b981;
    --success-soft: rgba(16, 185, 129, 0.1);
    --danger: #ef4444;
    --danger-soft: rgba(239, 68, 68, 0.1);
    --warning: #f59e0b;
    --radius-lg: 16px;
    --radius-md: 12px;
    --radius-sm: 8px;
    --radius-xs: 6px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.4);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
    --ease: cubic-bezier(0.4, 0, 0.2, 1);
    --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--font);
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: radial-gradient(rgba(124, 106, 255, 0.03) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
    z-index: 0;
  }

  /* --- Animations --- */
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  /* --- Header --- */
  .header {
    background: rgba(17, 17, 24, 0.82);
    border-bottom: 1px solid var(--border);
    padding: 20px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(20px) saturate(1.2);
    -webkit-backdrop-filter: blur(20px) saturate(1.2);
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--accent), #a78bfa, var(--accent), #818cf8);
    background-size: 300% 100%;
    animation: gradientShift 6s ease infinite;
    opacity: 0.6;
  }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .logo {
    width: 40px; height: 40px;
    background: linear-gradient(135deg, var(--accent), #a78bfa);
    border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    color: #fff;
    box-shadow: 0 2px 12px rgba(124, 106, 255, 0.3);
    flex-shrink: 0;
  }
  .logo i { width: 22px; height: 22px; }
  .header-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
  .header-subtitle { font-size: 13px; color: var(--text-secondary); font-weight: 400; }
  .header-stats {
    display: flex; gap: 20px; font-size: 13px; color: var(--text-secondary);
  }
  .stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
  }
  .stat-item i { width: 14px; height: 14px; color: var(--accent); }
  .stat-value { color: var(--text-primary); font-weight: 600; font-variant-numeric: tabular-nums; }

  /* --- Layout --- */
  .container {
    max-width: 1320px;
    margin: 0 auto;
    padding: 32px;
    display: grid;
    grid-template-columns: 320px 1fr;
    grid-template-rows: auto auto;
    gap: 24px;
    position: relative;
    z-index: 1;
  }

  /* --- Panels --- */
  .panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.5s var(--ease), transform 0.5s var(--ease);
  }
  .panel.visible {
    opacity: 1;
    transform: translateY(0);
  }
  .panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .panel-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .panel-header-left i { width: 14px; height: 14px; color: var(--text-muted); }
  .panel-count {
    background: var(--accent-soft);
    color: var(--accent);
    padding: 2px 10px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }
  .panel-body { padding: 12px; }

  /* --- Sources panel --- */
  .sources-panel { grid-row: 1 / 3; }
  .source-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: var(--radius-sm);
    transition: all 0.2s var(--ease);
    border: 1px solid transparent;
  }
  .source-card:hover {
    background: var(--bg-card);
    border-color: var(--border);
  }
  .source-icon-wrap {
    width: 36px; height: 36px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: var(--text-secondary);
  }
  .source-icon-wrap i { width: 16px; height: 16px; }
  .source-card:hover .source-icon-wrap {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
  }
  .source-name { font-size: 14px; font-weight: 500; word-break: break-word; }
  .source-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

  /* --- Generate panel --- */
  .gen-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }
  .gen-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: default;
    transition: all 0.2s var(--ease);
    position: relative;
  }
  .gen-card:hover {
    border-color: var(--accent);
    background: var(--bg-card-hover);
    box-shadow: 0 0 0 1px var(--accent-glow), var(--shadow-md);
    transform: translateY(-2px);
  }
  .gen-icon-wrap {
    width: 40px; height: 40px;
    background: var(--accent-soft);
    border: 1px solid rgba(124, 106, 255, 0.15);
    border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: var(--accent);
    transition: all 0.2s var(--ease);
  }
  .gen-icon-wrap i { width: 20px; height: 20px; }
  .gen-card:hover .gen-icon-wrap {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
    box-shadow: 0 2px 12px rgba(124, 106, 255, 0.3);
  }
  .gen-label { font-size: 14px; font-weight: 600; }
  .gen-desc { font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5; }
  .gen-files {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 8px;
    font-family: var(--mono);
    letter-spacing: 0.02em;
  }
  .gen-tooltip {
    position: absolute;
    top: 8px;
    right: 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 10px;
    font-family: var(--mono);
    padding: 2px 8px;
    border-radius: var(--radius-xs);
    opacity: 0;
    transform: translateY(-4px);
    transition: all 0.2s var(--ease);
    pointer-events: none;
  }
  .gen-card:hover .gen-tooltip {
    opacity: 1;
    transform: translateY(0);
  }

  /* --- Outputs panel --- */
  .output-row {
    display: grid;
    grid-template-columns: 32px 1fr 72px 140px auto;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    transition: all 0.15s var(--ease);
    border: 1px solid transparent;
  }
  .output-row:hover {
    background: var(--bg-card);
    border-color: var(--border);
  }
  .output-row.clickable { cursor: pointer; }
  .output-row.clickable:hover { border-color: var(--accent); }
  .output-icon-wrap {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    color: var(--text-muted);
  }
  .output-icon-wrap i { width: 15px; height: 15px; }
  .output-row:hover .output-icon-wrap { color: var(--text-secondary); }
  .output-name { font-family: var(--mono); font-size: 13px; font-weight: 400; }
  .output-size { color: var(--text-muted); text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; }
  .output-date { color: var(--text-muted); font-size: 12px; }
  .output-open {
    color: var(--accent);
    font-size: 12px;
    font-weight: 500;
    opacity: 0;
    transition: opacity 0.15s var(--ease);
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .output-open i { width: 12px; height: 12px; }
  .output-row:hover .output-open { opacity: 1; }

  /* --- Empty states --- */
  .empty-state {
    text-align: center;
    padding: 48px 20px;
    color: var(--text-muted);
  }
  .empty-lucide {
    width: 40px; height: 40px;
    color: var(--text-muted);
    opacity: 0.4;
    margin-bottom: 16px;
  }
  .empty-state p { margin-bottom: 6px; font-size: 14px; }
  .hint { font-size: 12px; color: var(--text-muted); }
  .hint code {
    background: var(--bg-card);
    padding: 3px 8px;
    border-radius: var(--radius-xs);
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    border: 1px solid var(--border);
  }

  /* --- Responsive --- */
  @media (max-width: 900px) {
    .container {
      grid-template-columns: 1fr;
      padding: 16px;
    }
    .sources-panel { grid-row: auto; }
    .gen-grid { grid-template-columns: 1fr; }
    .header { padding: 16px; flex-direction: column; align-items: flex-start; gap: 12px; }
    .header-stats { flex-wrap: wrap; gap: 8px; }
    .output-row { grid-template-columns: 32px 1fr 72px; }
    .output-date, .output-open { display: none; }
    .gen-tooltip { display: none; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <div class="logo"><i data-lucide="notebook-pen"></i></div>
    <div>
      <div class="header-title">Notebook</div>
      <div class="header-subtitle">Research Assistant</div>
    </div>
  </div>
  <div class="header-stats">
    <div class="stat-item"><i data-lucide="file-text"></i><span class="stat-value">${sources.length}</span> source${sources.length !== 1 ? 's' : ''}</div>
    <div class="stat-item"><i data-lucide="database"></i><span class="stat-value">${totalChunks}</span> chunks</div>
    <div class="stat-item"><i data-lucide="folder-output"></i><span class="stat-value">${outputs.length}</span> output${outputs.length !== 1 ? 's' : ''}</div>
  </div>
</div>

<div class="container">
  <div class="panel sources-panel">
    <div class="panel-header">
      <div class="panel-header-left"><i data-lucide="library"></i> Sources</div>
      <span class="panel-count">${sources.length}</span>
    </div>
    <div class="panel-body">
      ${sourcesHtml}
    </div>
  </div>

  <div class="panel">
    <div class="panel-header">
      <div class="panel-header-left"><i data-lucide="sparkles"></i> Generate</div>
    </div>
    <div class="panel-body">
      <div class="gen-grid">
        ${outputCardsHtml}
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-header">
      <div class="panel-header-left"><i data-lucide="folder-open"></i> Outputs</div>
      <span class="panel-count">${outputs.length}</span>
    </div>
    <div class="panel-body">
      ${outputsHtml}
    </div>
  </div>
</div>

<script>
// Scroll-triggered fade-in for panels
document.querySelectorAll('.panel').forEach(function(panel, i) {
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        setTimeout(function() { panel.classList.add('visible'); }, i * 120);
        obs.unobserve(panel);
      }
    });
  }, { threshold: 0.05 });
  obs.observe(panel);
});
lucide.createIcons();
<\/script>
</body>
</html>`;

const outPath = join(outDir, `${name}.html`);
writeFileSync(outPath, html);
console.log(JSON.stringify({ output: outPath, sources: sources.length, chunks: totalChunks, outputs: outputs.length }));
