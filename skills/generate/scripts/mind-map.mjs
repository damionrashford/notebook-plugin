#!/usr/bin/env node
/**
 * Generate a mind map from JSON input.
 * Usage: node generate.mjs -i <input.json> -o <output-dir> [--name mind-map]
 *        node generate.mjs --mermaid -i <input.mmd> -o <output-dir>
 *
 * Input JSON: { "label": "Root", "children": [{ "label": "A", "children": [...] }] }
 * Or raw Mermaid syntax file with --mermaid flag.
 * Outputs: .mmd + .html (interactive viewer)
 *
 * Zero npm dependencies.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: null, outputDir: './output', name: 'mind-map', isMermaid: false };
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-i' || args[i] === '--input') && args[i + 1]) opts.input = args[++i];
    else if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) opts.outputDir = args[++i];
    else if ((args[i] === '--name') && args[i + 1]) opts.name = args[++i];
    else if (args[i] === '--mermaid') opts.isMermaid = true;
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node generate.mjs -i <input.json> -o <output-dir> [--name mind-map] [--mermaid]');
      process.exit(0);
    }
  }
  return opts;
}

function sanitizeLabel(label) {
  return label
    .replace(/[()[\]{}]/g, '')     // remove shape-syntax chars
    .replace(/—/g, '-')            // em-dash to hyphen
    .replace(/–/g, '-')            // en-dash to hyphen
    .replace(/'/g, '')             // remove smart quotes
    .replace(/'/g, '')
    .replace(/"/g, '')
    .replace(/"/g, '')
    .replace(/&/g, 'and')
    .replace(/</g, '')
    .replace(/>/g, '')
    .replace(/`/g, '')
    .trim();
}

function sanitizeMermaid(mmd) {
  return mmd.split('\n').map((line, i) => {
    if (i === 0) return line; // keep 'mindmap' directive
    const match = line.match(/^(\s*)(root\(\(.*\)\))?(.*)$/);
    if (match && match[2]) return line; // keep root((...)) as-is
    // Sanitize label part (preserve indentation)
    const indent = line.match(/^(\s*)/)[1];
    const label = line.slice(indent.length);
    if (!label) return line;
    return indent + sanitizeLabel(label);
  }).join('\n');
}

function nodeToMermaid(node, depth = 0) {
  const indent = '  '.repeat(depth);
  const label = depth === 1 ? node.label : sanitizeLabel(node.label);
  let result = `${indent}${label}\n`;
  if (node.children) {
    for (const child of node.children) {
      result += nodeToMermaid(child, depth + 1);
    }
  }
  return result;
}

function buildHtml(mermaidSyntax) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mind Map</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"><\/script>
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
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* --- Dot grid background --- */
    .canvas-wrap {
      flex: 1;
      position: relative;
      overflow: hidden;
      background-color: var(--bg-primary);
      background-image: radial-gradient(circle, var(--border) 1px, transparent 1px);
      background-size: 24px 24px;
    }

    /* --- Toolbar --- */
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      z-index: 10;
      flex-shrink: 0;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .toolbar-icon {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, var(--accent), #a78bfa);
      border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      flex-shrink: 0;
    }
    .toolbar-icon i { width: 20px; height: 20px; }
    .toolbar-title {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .tb-btn {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--border);
      border-radius: var(--radius-xs);
      background: var(--bg-card);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s var(--ease);
    }
    .tb-btn:hover {
      background: var(--bg-card-hover);
      border-color: var(--border-hover);
      color: var(--text-primary);
    }
    .tb-btn:active {
      background: var(--bg-elevated);
      transform: scale(0.95);
    }
    .tb-btn i { width: 16px; height: 16px; }
    .tb-divider {
      width: 1px;
      height: 20px;
      background: var(--border);
      margin: 0 6px;
    }
    .zoom-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      min-width: 44px;
      text-align: center;
      font-family: var(--mono);
      user-select: none;
    }

    /* --- Diagram container --- */
    .diagram-container {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
    }
    .diagram-container.dragging { cursor: grabbing; }
    .diagram-inner {
      transform-origin: center center;
      transition: transform 0.08s linear;
      padding: 60px;
    }
    .diagram-inner .mermaid svg {
      max-width: none !important;
    }

    /* --- Mermaid overrides --- */
    .mermaid {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 48px;
      box-shadow: var(--shadow-lg);
    }

    /* --- Responsive --- */
    @media (max-width: 600px) {
      .toolbar {
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px 12px;
      }
      .toolbar-left { flex: 1 1 100%; }
      .toolbar-right { flex: 1 1 100%; justify-content: flex-end; }
      .mermaid { padding: 24px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <div class="toolbar-icon"><i data-lucide="brain"></i></div>
      <span class="toolbar-title">Mind Map</span>
    </div>
    <div class="toolbar-right">
      <button class="tb-btn" id="zoomOut" title="Zoom out"><i data-lucide="zoom-out"></i></button>
      <span class="zoom-label" id="zoomLabel">100%</span>
      <button class="tb-btn" id="zoomIn" title="Zoom in"><i data-lucide="zoom-in"></i></button>
      <button class="tb-btn" id="zoomFit" title="Fit to view"><i data-lucide="maximize"></i></button>
      <div class="tb-divider"></div>
      <button class="tb-btn" id="fullscreen" title="Toggle fullscreen"><i data-lucide="maximize-2"></i></button>
    </div>
  </div>

  <div class="canvas-wrap" id="canvasWrap">
    <div class="diagram-container" id="container">
      <div class="diagram-inner" id="inner">
        <div class="mermaid">
${mermaidSyntax}
        </div>
      </div>
    </div>
  </div>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#7c6aff',
        primaryTextColor: '#f0f0f5',
        primaryBorderColor: '#3a3a4e',
        lineColor: '#3a3a4e',
        secondaryColor: '#252532',
        tertiaryColor: '#1a1a25',
        background: '#1a1a25',
        mainBkg: '#1a1a25',
        nodeBorder: '#3a3a4e',
        clusterBkg: '#111118',
        clusterBorder: '#2a2a3a',
        titleColor: '#f0f0f5',
        edgeLabelBackground: '#111118',
        nodeTextColor: '#f0f0f5'
      }
    });
    lucide.createIcons();

    // --- Pan & Zoom ---
    const container = document.getElementById('container');
    const inner = document.getElementById('inner');
    const zoomLabel = document.getElementById('zoomLabel');
    let scale = 1, panX = 0, panY = 0;
    let isDragging = false, startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    const ZOOM_STEP = 0.15;
    const MIN_ZOOM = 0.2;
    const MAX_ZOOM = 4;

    function applyTransform() {
      inner.style.transition = 'none';
      inner.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    }

    function smoothTransform() {
      inner.style.transition = 'transform 0.25s ' + getComputedStyle(document.documentElement).getPropertyValue('--ease');
      inner.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    }

    function clampScale(s) { return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s)); }

    // Mouse drag
    container.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      startPanX = panX; startPanY = panY;
      container.classList.add('dragging');
    });
    window.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      applyTransform();
    });
    window.addEventListener('mouseup', function() {
      isDragging = false;
      container.classList.remove('dragging');
    });

    // Scroll wheel zoom
    container.addEventListener('wheel', function(e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      scale = clampScale(scale + delta);
      applyTransform();
    }, { passive: false });

    // Double-click reset
    container.addEventListener('dblclick', function() {
      scale = 1; panX = 0; panY = 0;
      smoothTransform();
    });

    // Toolbar buttons
    document.getElementById('zoomIn').addEventListener('click', function() {
      scale = clampScale(scale + ZOOM_STEP);
      smoothTransform();
    });
    document.getElementById('zoomOut').addEventListener('click', function() {
      scale = clampScale(scale - ZOOM_STEP);
      smoothTransform();
    });
    document.getElementById('zoomFit').addEventListener('click', function() {
      scale = 1; panX = 0; panY = 0;
      smoothTransform();
    });
    document.getElementById('fullscreen').addEventListener('click', function() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function(){});
      } else {
        document.exitFullscreen();
      }
    });
  <\/script>
</body>
</html>`;
}

function main() {
  const opts = parseArgs();
  if (!opts.input) { console.error('Error: -i <input> required'); process.exit(1); }

  const outDir = resolve(opts.outputDir);
  mkdirSync(outDir, { recursive: true });

  let mermaid;
  if (opts.isMermaid) {
    mermaid = sanitizeMermaid(readFileSync(resolve(opts.input), 'utf-8'));
  } else {
    const root = JSON.parse(readFileSync(resolve(opts.input), 'utf-8'));
    mermaid = `mindmap\n${nodeToMermaid(root, 1)}`;
  }

  const mmdPath = join(outDir, `${opts.name}.mmd`);
  writeFileSync(mmdPath, mermaid);

  const htmlPath = join(outDir, `${opts.name}.html`);
  writeFileSync(htmlPath, buildHtml(mermaid));

  console.log(JSON.stringify({ status: 'success', mermaid: mmdPath, html: htmlPath }, null, 2));
}

main();
