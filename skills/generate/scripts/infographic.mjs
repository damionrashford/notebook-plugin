#!/usr/bin/env node
/**
 * Generate an infographic HTML from JSON input.
 * Usage: node generate.mjs -i <input.json> -o <output-dir> [--name infographic]
 *
 * Input JSON: { "title": "...", "subtitle": "...", "sections": [{ "title": "...", "content": "...", "icon": "...", "stat": { "value": "...", "label": "..." } }], "footer": "..." }
 * Outputs: self-contained .html
 *
 * Zero npm dependencies.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: null, outputDir: './output', name: 'infographic' };
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-i' || args[i] === '--input') && args[i + 1]) opts.input = args[++i];
    else if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) opts.outputDir = args[++i];
    else if ((args[i] === '--name') && args[i + 1]) opts.name = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node generate.mjs -i <input.json> -o <output-dir> [--name infographic]');
      process.exit(0);
    }
  }
  return opts;
}

function buildHtml(data) {
  const escH = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const stats = data.sections.filter(s => s.stat);
  const statsRibbonHtml = stats.length >= 2 ? `
    <div class="stats-ribbon">
      <div class="stats-ribbon-inner">
        ${stats.map(s => `
          <div class="ribbon-stat">
            <span class="ribbon-stat-value" data-countup="${escH(s.stat.value)}">${escH(s.stat.value)}</span>
            <span class="ribbon-stat-label">${escH(s.stat.label)}</span>
          </div>
        `).join('')}
      </div>
    </div>` : '';

  const defaultIcons = ['info', 'layers', 'target', 'zap', 'bar-chart-3', 'shield', 'globe', 'cpu', 'rocket', 'star', 'lightbulb', 'trending-up'];

  const sectionsHtml = data.sections.map((s, i) => {
    const iconName = s.icon || defaultIcons[i % defaultIcons.length];
    const sectionId = 'section-' + i;
    return `
    <section class="section-wrapper observe-me" id="${sectionId}" style="--delay: ${i * 0.08}s" aria-labelledby="${sectionId}-title">
      <div class="section-card">
        <div class="section-icon-wrap">
          <i data-lucide="${escH(iconName)}"></i>
        </div>
        <div class="section-body">
          <h2 class="section-title" id="${sectionId}-title">${escH(s.title)}</h2>
          ${s.stat ? `
          <div class="stat-callout">
            <span class="stat-callout-value" data-countup="${escH(s.stat.value)}">${escH(s.stat.value)}</span>
            <span class="stat-callout-label">${escH(s.stat.label)}</span>
          </div>` : ''}
          <div class="section-content">${s.content}</div>
        </div>
      </div>
      ${i < data.sections.length - 1 ? '<div class="section-divider" aria-hidden="true"><div class="divider-line"></div></div>' : ''}
    </section>`;
  }).join('\n');

  const tocHtml = data.sections.map((s, i) => {
    const iconName = s.icon || defaultIcons[i % defaultIcons.length];
    return `<a href="#section-${i}" class="toc-link" data-index="${i}" aria-label="Go to ${escH(s.title)}"><i data-lucide="${escH(iconName)}"></i><span class="toc-label">${escH(s.title)}</span></a>`;
  }).join('\n        ');

  const heroStatsHtml = stats.length > 0 ? `
      <div class="hero-stats">
        ${stats.slice(0, 4).map(s => `
        <div class="hero-stat">
          <span class="hero-stat-value" data-countup="${escH(s.stat.value)}">${escH(s.stat.value)}</span>
          <span class="hero-stat-label">${escH(s.stat.label)}</span>
        </div>`).join('')}
      </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escH(data.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
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
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 24px; }
body {
  font-family: var(--font);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* ---- Hero ---- */
.hero {
  position: relative;
  padding: 80px 32px 64px;
  text-align: center;
  overflow: hidden;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 600px 400px at 20% 50%, rgba(124,106,255,0.08), transparent),
    radial-gradient(ellipse 500px 300px at 80% 30%, rgba(167,139,250,0.06), transparent);
  pointer-events: none;
}
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle 1px at 10% 20%, rgba(124,106,255,0.25) 0%, transparent 100%),
    radial-gradient(circle 1px at 30% 70%, rgba(167,139,250,0.2) 0%, transparent 100%),
    radial-gradient(circle 1px at 50% 40%, rgba(196,181,253,0.15) 0%, transparent 100%),
    radial-gradient(circle 1px at 70% 80%, rgba(124,106,255,0.2) 0%, transparent 100%),
    radial-gradient(circle 1px at 90% 30%, rgba(167,139,250,0.25) 0%, transparent 100%),
    radial-gradient(circle 1px at 15% 90%, rgba(124,106,255,0.15) 0%, transparent 100%),
    radial-gradient(circle 1px at 85% 60%, rgba(196,181,253,0.2) 0%, transparent 100%),
    radial-gradient(circle 1.5px at 40% 10%, rgba(124,106,255,0.3) 0%, transparent 100%),
    radial-gradient(circle 1.5px at 60% 90%, rgba(167,139,250,0.25) 0%, transparent 100%),
    radial-gradient(circle 0.5px at 25% 45%, rgba(196,181,253,0.35) 0%, transparent 100%),
    radial-gradient(circle 0.5px at 75% 15%, rgba(124,106,255,0.3) 0%, transparent 100%);
  pointer-events: none;
  opacity: 0.7;
}
.hero-content { position: relative; z-index: 1; max-width: 700px; margin: 0 auto; }
.hero h1 {
  font-size: clamp(2rem, 5vw, 3.2rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  background: linear-gradient(135deg, var(--accent), #a78bfa, #c4b5fd, #a78bfa);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 16px;
  animation: shimmer 6s ease-in-out infinite;
}
@keyframes shimmer {
  0%, 100% { background-position: 0% center; }
  50% { background-position: 200% center; }
}
.hero .subtitle {
  font-size: 1.125rem;
  color: var(--text-secondary);
  line-height: 1.7;
  max-width: 560px;
  margin: 0 auto;
}
.hero-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  flex-wrap: wrap;
  margin-top: 32px;
}
.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 24px;
  background: var(--accent-soft);
  border: 1px solid rgba(124, 106, 255, 0.12);
  border-radius: var(--radius-md);
  min-width: 120px;
}
.hero-stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.hero-stat-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ---- Stats Ribbon ---- */
.stats-ribbon {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 32px 24px;
}
.stats-ribbon-inner {
  display: flex;
  justify-content: center;
  gap: 48px;
  flex-wrap: wrap;
  max-width: 900px;
  margin: 0 auto;
}
.ribbon-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.ribbon-stat-value {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.ribbon-stat-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ---- Layout ---- */
.layout { display: flex; max-width: 1100px; margin: 0 auto; }
.main-content { flex: 1; min-width: 0; padding: 48px 24px; max-width: 860px; margin: 0 auto; }

/* ---- Floating TOC (sidebar) ---- */
.toc-nav {
  position: sticky;
  top: 24px;
  align-self: flex-start;
  width: 52px;
  flex-shrink: 0;
  margin-left: 12px;
  margin-top: 48px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 100;
  transition: width 0.3s var(--ease);
  overflow: hidden;
}
.toc-nav:hover, .toc-nav:focus-within {
  width: 220px;
}
.toc-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  text-decoration: none;
  transition: all 0.2s var(--ease);
  white-space: nowrap;
  overflow: hidden;
}
.toc-link i { width: 18px; height: 18px; flex-shrink: 0; }
.toc-label {
  font-size: 0.75rem;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.2s var(--ease);
  overflow: hidden;
  text-overflow: ellipsis;
}
.toc-nav:hover .toc-label, .toc-nav:focus-within .toc-label { opacity: 1; }
.toc-link:hover {
  background: var(--accent-soft);
  color: var(--accent);
}
.toc-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.toc-link.active {
  background: var(--accent-soft);
  color: var(--accent);
}

/* ---- Section entrance animation ---- */
.observe-me {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s var(--ease), transform 0.6s var(--ease);
  transition-delay: var(--delay, 0s);
}
.observe-me.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ---- Section card ---- */
.section-wrapper { margin-bottom: 0; }
.section-card {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  padding: 32px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: border-color 0.3s var(--ease), box-shadow 0.3s var(--ease), transform 0.3s var(--ease);
}
.section-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.section-icon-wrap {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--accent-soft);
  border: 1px solid rgba(124, 106, 255, 0.15);
  border-radius: var(--radius-md);
  color: var(--accent);
  transition: background 0.3s var(--ease), transform 0.3s var(--ease);
}
.section-icon-wrap i { width: 22px; height: 22px; }
.section-card:hover .section-icon-wrap {
  background: rgba(124, 106, 255, 0.15);
  transform: scale(1.05);
}

.section-body { flex: 1; min-width: 0; }
.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  position: relative;
  display: inline-block;
}
.section-title::after {
  content: '';
  display: block;
  width: 40px;
  height: 3px;
  background: linear-gradient(90deg, var(--accent), transparent);
  border-radius: 2px;
  margin-top: 8px;
}
.section-content {
  line-height: 1.8;
  letter-spacing: 0.01em;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

/* ---- Stat callout inside section ---- */
.stat-callout {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 28px;
  margin: 16px 0;
  background: linear-gradient(135deg, var(--accent-soft), rgba(124, 106, 255, 0.04));
  border: 1px solid rgba(124, 106, 255, 0.12);
  border-radius: var(--radius-md);
  position: relative;
  overflow: hidden;
}
.stat-callout::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(to bottom, var(--accent), var(--accent-hover));
  border-radius: 2px 0 0 2px;
}
.stat-callout-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.stat-callout-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ---- Section divider ---- */
.section-divider {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}
.divider-line {
  width: 2px;
  height: 32px;
  background: linear-gradient(to bottom, var(--border), transparent);
  border-radius: 1px;
}

/* ---- Footer ---- */
.infographic-footer {
  text-align: center;
  margin-top: 48px;
  padding: 32px 24px;
  color: var(--text-muted);
  font-size: 0.85rem;
  line-height: 1.7;
  border-top: 1px solid var(--border);
}

/* ---- Back to top ---- */
.back-to-top {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  opacity: 0;
  transform: translateY(8px);
  transition: all 0.3s var(--ease);
  z-index: 99;
  box-shadow: var(--shadow-md);
}
.back-to-top.visible { opacity: 1; transform: translateY(0); }
.back-to-top:hover { background: var(--accent-soft); color: var(--accent); border-color: var(--border-hover); }
.back-to-top:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.back-to-top i { width: 18px; height: 18px; }

/* ---- Scrollbar ---- */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: 3px; }
html { scrollbar-width: thin; scrollbar-color: var(--border-hover) transparent; }

/* ---- Responsive ---- */
@media (max-width: 900px) {
  .toc-nav { display: none; }
  .layout { display: block; }
}
@media (max-width: 640px) {
  .hero { padding: 56px 20px 44px; }
  .main-content { padding: 32px 16px; }
  .section-card { flex-direction: column; padding: 24px; }
  .stats-ribbon-inner { gap: 28px; }
  .ribbon-stat-value { font-size: 1.75rem; }
  .hero-stats { gap: 16px; }
  .hero-stat { min-width: 100px; padding: 12px 16px; }
  .hero-stat-value { font-size: 1.35rem; }
}

/* ---- Print ---- */
@media print {
  :root {
    --bg-primary: #fff;
    --bg-secondary: #fafafa;
    --bg-card: #fff;
    --bg-elevated: #f5f5f5;
    --border: #e0e0e0;
    --text-primary: #111;
    --text-secondary: #444;
    --text-muted: #888;
    --accent: #5b4fd6;
    --accent-soft: rgba(91, 79, 214, 0.06);
    --shadow-sm: none;
    --shadow-md: none;
    --shadow-lg: none;
  }
  body { background: #fff; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hero { background: #fafafa; break-after: avoid; }
  .hero h1 { -webkit-text-fill-color: var(--accent); background: none; animation: none; }
  .toc-nav, .back-to-top { display: none !important; }
  .observe-me { opacity: 1 !important; transform: none !important; transition: none !important; }
  .section-card { break-inside: avoid; box-shadow: none; border: 1px solid #e0e0e0; page-break-inside: avoid; }
  .section-card:hover { transform: none; }
  .stats-ribbon { break-inside: avoid; }
  a { color: var(--accent); }
}

/* ---- Focus / Accessibility ---- */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  html { scroll-behavior: auto; }
}
</style>
</head>
<body>

<header class="hero" role="banner">
  <div class="hero-content">
    <h1>${escH(data.title)}</h1>
    ${data.subtitle ? `<p class="subtitle">${escH(data.subtitle)}</p>` : ''}
    ${heroStatsHtml}
  </div>
</header>

${statsRibbonHtml}

<div class="layout">
  <main class="main-content" role="main">
    ${sectionsHtml}
    ${data.footer ? `<footer class="infographic-footer" role="contentinfo">${escH(data.footer)}</footer>` : ''}
  </main>

  <nav class="toc-nav" aria-label="Table of contents">
    ${tocHtml}
  </nav>
</div>

<button class="back-to-top" id="backToTop" aria-label="Back to top" tabindex="0">
  <i data-lucide="chevron-up"></i>
</button>

<script>
  lucide.createIcons();

  /* Scroll entrance animations */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.observe-me').forEach(el => observer.observe(el));

  /* Count-up animation for stat values */
  function animateCountUp(el) {
    const raw = el.getAttribute('data-countup');
    if (!raw) return;
    const match = raw.match(/([\\d,.]+)/);
    if (!match) return;
    const numStr = match[1].replace(/,/g, '');
    const target = parseFloat(numStr);
    if (isNaN(target)) return;
    const prefix = raw.substring(0, raw.indexOf(match[1]));
    const suffix = raw.substring(raw.indexOf(match[1]) + match[1].length);
    const hasDecimal = numStr.includes('.');
    const decimals = hasDecimal ? numStr.split('.')[1].length : 0;
    const duration = 1200;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      const formatted = hasDecimal ? current.toFixed(decimals) : Math.round(current).toLocaleString();
      el.textContent = prefix + formatted + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = raw;
    }
    requestAnimationFrame(step);
  }

  const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCountUp(entry.target);
        statObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-countup]').forEach(el => statObserver.observe(el));

  /* Active TOC tracking */
  const tocLinks = document.querySelectorAll('.toc-link');
  const sections = document.querySelectorAll('.section-wrapper');
  const tocObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = entry.target.id.replace('section-', '');
        tocLinks.forEach(l => l.classList.toggle('active', l.getAttribute('data-index') === idx));
      }
    });
  }, { threshold: 0.3, rootMargin: '-10% 0px -60% 0px' });
  sections.forEach(s => tocObserver.observe(s));

  /* Back to top button */
  const backBtn = document.getElementById('backToTop');
  window.addEventListener('scroll', () => {
    backBtn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  backBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
<\/script>
</body>
</html>`;
}

function main() {
  const opts = parseArgs();
  if (!opts.input) { console.error('Error: -i <input.json> required'); process.exit(1); }

  const data = JSON.parse(readFileSync(resolve(opts.input), 'utf-8'));
  const outDir = resolve(opts.outputDir);
  mkdirSync(outDir, { recursive: true });

  const htmlPath = join(outDir, `${opts.name}.html`);
  writeFileSync(htmlPath, buildHtml(data));

  console.log(JSON.stringify({ status: 'success', html: htmlPath }, null, 2));
}

main();
