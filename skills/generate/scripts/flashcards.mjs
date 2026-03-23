#!/usr/bin/env node
/**
 * Generate flashcards from JSON input.
 * Usage: node generate.mjs -i <input.json> -o <output-dir> [--name flashcards]
 *
 * Input JSON format: [{ "front": "Q", "back": "A", "tags": ["t1"] }, ...]
 * Outputs: .json + .md + .html (interactive flip cards)
 *
 * Zero npm dependencies — Node builtins only.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: null, outputDir: './output', name: 'flashcards' };
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-i' || args[i] === '--input') && args[i + 1]) opts.input = args[++i];
    else if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) opts.outputDir = args[++i];
    else if ((args[i] === '--name') && args[i + 1]) opts.name = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node generate.mjs -i <input.json> -o <output-dir> [--name flashcards]');
      process.exit(0);
    }
  }
  return opts;
}


function buildHtml(cards) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flashcards (${cards.length})</title>
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
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--font);background:var(--bg-primary);color:var(--text-primary);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:40px 20px;-webkit-font-smoothing:antialiased}
@keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes cardEntrance{from{opacity:0;transform:scale(0.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}

.hero{text-align:center;margin-bottom:32px;animation:fadeInUp 0.5s var(--ease) both}
.hero-icon{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:var(--radius-md);background:var(--accent-soft);border:1px solid rgba(124,106,255,0.2);margin-bottom:16px;color:var(--accent)}
.hero-icon i{width:28px;height:28px}
.hero h1{font-size:2em;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,var(--accent),#a78bfa,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-badge{display:inline-flex;align-items:center;gap:6px;background:var(--accent-soft);color:var(--accent);padding:4px 14px;border-radius:20px;font-size:0.85em;font-weight:500;border:1px solid rgba(124,106,255,0.15)}

.filter-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;max-width:680px;width:100%;justify-content:center;animation:fadeInUp 0.5s var(--ease) 0.1s both}
.filter-btn{background:var(--bg-card);border:1px solid var(--border);color:var(--text-secondary);padding:6px 16px;border-radius:20px;cursor:pointer;font-size:0.82em;font-weight:500;font-family:var(--font);transition:all 0.2s var(--ease)}
.filter-btn:hover{background:var(--bg-card-hover);border-color:var(--border-hover);color:var(--text-primary)}
.filter-btn.active{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}
.filter-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

.progress-track{width:100%;max-width:680px;height:6px;background:var(--bg-elevated);border-radius:3px;margin-bottom:28px;overflow:hidden;animation:fadeInUp 0.5s var(--ease) 0.15s both}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--accent),#a78bfa);border-radius:3px;transition:width 0.4s var(--ease)}

.card-container{perspective:1200px;width:100%;max-width:680px;height:400px;cursor:pointer;margin-bottom:28px}
.card{width:100%;height:100%;position:relative;transition:transform 0.6s cubic-bezier(0.23,1,0.32,1);transform-style:preserve-3d}
.card.flipped{transform:rotateY(180deg)}
.card.entering{animation:cardEntrance 0.35s var(--ease) both}
.face{position:absolute;width:100%;height:100%;backface-visibility:hidden;border-radius:var(--radius-lg);display:flex;flex-direction:column;justify-content:center;align-items:center;padding:40px 36px;text-align:center;border:1px solid var(--border);box-shadow:var(--shadow-lg)}
.front{background:linear-gradient(160deg,var(--bg-card) 0%,var(--bg-secondary) 100%);backdrop-filter:blur(8px)}
.front::before{content:'';position:absolute;inset:0;border-radius:var(--radius-lg);background:linear-gradient(135deg,rgba(124,106,255,0.06) 0%,transparent 50%);pointer-events:none}
.back{background:linear-gradient(160deg,var(--bg-elevated) 0%,var(--bg-card) 100%);transform:rotateY(180deg)}
.back::before{content:'';position:absolute;inset:0;border-radius:var(--radius-lg);background:linear-gradient(135deg,rgba(167,139,250,0.06) 0%,transparent 50%);pointer-events:none}
.face-label{position:absolute;top:16px;right:20px;font-size:0.7em;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted)}
.face h2{font-size:1.35em;line-height:1.6;max-height:calc(100% - 40px);overflow-y:auto;font-weight:500;color:var(--text-primary)}
.back h2{color:var(--text-secondary)}
.tags-area{position:absolute;top:14px;left:18px;display:flex;gap:6px;flex-wrap:wrap}
.tag{background:var(--accent-soft);color:var(--accent);padding:3px 12px;border-radius:12px;font-size:0.72em;font-weight:500;border:1px solid rgba(124,106,255,0.15);transition:all 0.2s var(--ease)}
.tag:hover{background:var(--accent-glow);border-color:var(--accent)}

.toolbar{display:flex;gap:12px;align-items:center;margin-bottom:12px;animation:fadeInUp 0.5s var(--ease) 0.25s both}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:10px 24px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.9em;font-weight:500;font-family:var(--font);min-height:40px;transition:all 0.2s var(--ease);box-shadow:var(--shadow-sm)}
.btn:hover{background:var(--bg-card-hover);border-color:var(--border-hover);transform:translateY(-1px);box-shadow:var(--shadow-md)}
.btn:active{transform:translateY(0)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn:disabled{opacity:0.3;cursor:not-allowed;transform:none}
.btn i{width:16px;height:16px}
.counter{font-size:1em;font-weight:600;min-width:90px;text-align:center;color:var(--text-secondary);font-variant-numeric:tabular-nums}

.secondary-toolbar{display:flex;gap:10px;align-items:center;margin-bottom:20px;animation:fadeInUp 0.5s var(--ease) 0.3s both}
.btn-secondary{background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-secondary);padding:8px 18px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.82em;font-weight:500;font-family:var(--font);min-height:36px;display:inline-flex;align-items:center;gap:6px;transition:all 0.2s var(--ease)}
.btn-secondary:hover{background:var(--bg-card);color:var(--text-primary);border-color:var(--border-hover)}
.btn-secondary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn-secondary i{width:14px;height:14px}

.shortcuts-bar{display:flex;gap:16px;align-items:center;justify-content:center;margin-top:8px;animation:fadeInUp 0.5s var(--ease) 0.35s both}
.shortcut{display:inline-flex;align-items:center;gap:6px;color:var(--text-muted);font-size:0.8em}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:28px;padding:2px 8px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-xs);font-size:0.85em;font-weight:500;font-family:var(--mono);color:var(--text-secondary);line-height:1.4}

@media(max-width:768px){
  body{padding:20px 12px}
  .hero h1{font-size:1.5em}
  .card-container{height:320px}
  .face{padding:28px 20px}
  .face h2{font-size:1.15em}
  .toolbar{gap:8px}
  .btn{padding:8px 16px;font-size:0.85em}
  .shortcuts-bar{flex-wrap:wrap;gap:10px}
  .filter-bar{gap:6px}
}
</style>
</head>
<body>

<div class="hero">
  <div class="hero-icon"><i data-lucide="layers"></i></div>
  <h1>Flashcards</h1>
  <div class="hero-badge"><i data-lucide="hash" style="width:14px;height:14px"></i><span id="stats"></span></div>
</div>

<div class="filter-bar" id="filter"></div>

<div class="progress-track"><div class="progress-fill" id="progress"></div></div>

<div class="card-container" id="cardContainer" onclick="flip()">
  <div class="card entering" id="card">
    <div class="face front">
      <span class="face-label">Front</span>
      <div class="tags-area" id="tags"></div>
      <h2 id="frontText"></h2>
    </div>
    <div class="face back">
      <span class="face-label">Back</span>
      <h2 id="backText"></h2>
    </div>
  </div>
</div>

<div class="toolbar">
  <button class="btn" id="prevBtn" onclick="prev()"><i data-lucide="chevron-left"></i> Prev</button>
  <span class="counter" id="counter"></span>
  <button class="btn" id="nextBtn" onclick="next()">Next <i data-lucide="chevron-right"></i></button>
</div>

<div class="secondary-toolbar">
  <button class="btn-secondary" onclick="shuffle()"><i data-lucide="shuffle"></i> Shuffle</button>
  <button class="btn-secondary" onclick="reset()"><i data-lucide="rotate-ccw"></i> Reset</button>
</div>

<div class="shortcuts-bar">
  <div class="shortcut"><span class="kbd">&larr;</span> Prev</div>
  <div class="shortcut"><span class="kbd">&rarr;</span> Next</div>
  <div class="shortcut"><span class="kbd">Space</span> Flip</div>
</div>

<script>
const allCards=${JSON.stringify(cards)};
let filtered=[...allCards], idx=0;
const allTags=[...new Set(allCards.flatMap(c=>c.tags||[]))].sort();
let activeTag=null;

function animateCard(){
  const card=document.getElementById('card');
  card.classList.remove('entering');
  void card.offsetWidth;
  card.classList.add('entering');
}

function render(){
  const c=filtered[idx]||{front:'No cards',back:'',tags:[]};
  document.getElementById('frontText').textContent=c.front;
  document.getElementById('backText').textContent=c.back;
  document.getElementById('card').classList.remove('flipped');
  const tags=document.getElementById('tags');
  tags.innerHTML=(c.tags||[]).map(t=>'<span class="tag">'+t+'</span>').join('');
  document.getElementById('counter').textContent=(idx+1)+' / '+filtered.length;
  document.getElementById('progress').style.width=((idx+1)/filtered.length*100)+'%';
  document.getElementById('prevBtn').disabled=idx===0;
  document.getElementById('nextBtn').disabled=idx>=filtered.length-1;
  document.getElementById('stats').textContent=filtered.length+' cards'+(activeTag?' — '+activeTag:'');
  animateCard();
}
function flip(){document.getElementById('card').classList.toggle('flipped')}
function next(){if(idx<filtered.length-1){idx++;render()}}
function prev(){if(idx>0){idx--;render()}}
function shuffle(){for(let i=filtered.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[filtered[i],filtered[j]]=[filtered[j],filtered[i]]}idx=0;render()}
function reset(){filtered=[...allCards];activeTag=null;idx=0;renderFilters();render()}
function filterByTag(tag){
  if(activeTag===tag){activeTag=null;filtered=[...allCards]}
  else{activeTag=tag;filtered=allCards.filter(c=>(c.tags||[]).includes(tag))}
  idx=0;renderFilters();render();
}
function renderFilters(){
  if(!allTags.length){document.getElementById('filter').style.display='none';return}
  document.getElementById('filter').innerHTML=
    '<button class="filter-btn'+(activeTag===null?' active':'')+'" onclick="reset()">All</button>'+
    allTags.map(t=>
      '<button class="filter-btn'+(activeTag===t?' active':'')+'" onclick="filterByTag(\\''+t+'\\')">'+t+'</button>'
    ).join('');
}
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')next();else if(e.key==='ArrowLeft')prev();else if(e.key===' '){e.preventDefault();flip()}});
renderFilters();render();
lucide.createIcons();
</script>
</body></html>`;
}

function main() {
  const opts = parseArgs();
  if (!opts.input) { console.error('Error: -i <input.json> required'); process.exit(1); }

  const cards = JSON.parse(readFileSync(resolve(opts.input), 'utf-8'));
  const outDir = resolve(opts.outputDir);
  mkdirSync(outDir, { recursive: true });

  // JSON output
  const jsonPath = join(outDir, `${opts.name}.json`);
  writeFileSync(jsonPath, JSON.stringify(cards, null, 2));

  // Markdown output
  let md = `# Flashcards\n\n> ${cards.length} cards generated\n\n`;
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    md += `## Card ${i + 1}`;
    if (card.tags?.length) md += ` [${card.tags.join(', ')}]`;
    md += '\n\n';
    md += `**Q:** ${card.front}\n\n`;
    md += `<details>\n<summary>Show Answer</summary>\n\n${card.back}\n\n</details>\n\n`;
    md += `---\n\n`;
  }
  const mdPath = join(outDir, `${opts.name}.md`);
  writeFileSync(mdPath, md);

  // Interactive HTML output
  const htmlPath = join(outDir, `${opts.name}.html`);
  writeFileSync(htmlPath, buildHtml(cards));

  console.log(JSON.stringify({ status: 'success', json: jsonPath, markdown: mdPath, html: htmlPath, count: cards.length }, null, 2));
}

main();
