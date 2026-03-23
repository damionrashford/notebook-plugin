#!/usr/bin/env node
/**
 * Generate data table outputs from JSON input.
 * Usage: node generate.mjs -i <input.json> -o <output-dir> [--name data-table]
 *
 * Input JSON: { "title": "...", "headers": ["A","B"], "rows": [["a1","b1"], ...] }
 * Outputs: .csv + .json + .md + .html (interactive sortable/filterable table)
 *
 * Requires: csv-stringify (installed via skill's package.json)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: null, outputDir: './output', name: 'data-table' };
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-i' || args[i] === '--input') && args[i + 1]) opts.input = args[++i];
    else if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) opts.outputDir = args[++i];
    else if ((args[i] === '--name') && args[i + 1]) opts.name = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node generate.mjs -i <input.json> -o <output-dir> [--name data-table]');
      process.exit(0);
    }
  }
  return opts;
}

function buildHtml(data) {
  const title = data.title || 'Data Table';
  const rowCount = data.rows.length;
  const colCount = data.headers.length;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
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
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: var(--font);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Hero */
.hero {
  position: relative;
  padding: 48px 32px 40px;
  text-align: center;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}
.hero::before {
  content: '';
  position: absolute;
  top: -50%;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  pointer-events: none;
}
.hero h1 {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, var(--accent), #a78bfa, #c4b5fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 16px;
  position: relative;
}
.hero-badges {
  display: flex;
  gap: 10px;
  justify-content: center;
  position: relative;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--accent-soft);
  border: 1px solid rgba(124, 106, 255, 0.15);
  border-radius: 100px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--accent);
}
.badge i { width: 14px; height: 14px; }

/* Container */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

/* Toolbar */
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}
.search-wrap {
  flex: 1;
  min-width: 240px;
  position: relative;
}
.search-wrap i {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  pointer-events: none;
}
.search-input {
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 16px 10px 40px;
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 0.875rem;
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.search-input::placeholder { color: var(--text-muted); }
.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.toolbar-stats {
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}
.export-group {
  display: flex;
  gap: 8px;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font);
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s var(--ease);
}
.btn:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}
.btn i { width: 14px; height: 14px; }

/* Table wrapper with scroll shadows */
.table-container {
  position: relative;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-card);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}
.table-scroll {
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border-hover) transparent;
}
.table-scroll::-webkit-scrollbar { height: 6px; }
.table-scroll::-webkit-scrollbar-track { background: transparent; }
.table-scroll::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: 3px; }
.shadow-left, .shadow-right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 32px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s var(--ease);
  z-index: 2;
}
.shadow-left {
  left: 0;
  background: linear-gradient(to right, rgba(10,10,15,0.6), transparent);
}
.shadow-right {
  right: 0;
  background: linear-gradient(to left, rgba(10,10,15,0.6), transparent);
}
.shadow-left.visible, .shadow-right.visible { opacity: 1; }

/* Table */
table { width: 100%; border-collapse: collapse; }
thead { position: sticky; top: 0; z-index: 3; }
th {
  background: var(--bg-elevated);
  padding: 12px 16px;
  text-align: left;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}
th:hover { background: var(--bg-card-hover); color: var(--text-primary); }
th.sorted { color: var(--accent); }
th .sort-icon {
  display: inline-flex;
  margin-left: 6px;
  vertical-align: middle;
  opacity: 0.4;
  transition: opacity 0.15s var(--ease);
}
th:hover .sort-icon, th.sorted .sort-icon { opacity: 1; }
th .sort-icon i { width: 14px; height: 14px; }
td {
  padding: 11px 16px;
  border-bottom: 1px solid rgba(42, 42, 58, 0.5);
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: background 0.1s var(--ease);
}
tbody tr { transition: background 0.1s var(--ease); }
tbody tr:nth-child(even) td { background: rgba(255,255,255,0.015); }
tbody tr:hover td { background: var(--accent-soft); }
tbody tr.hidden { display: none; }

/* No results */
.no-results {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 56px 24px;
  text-align: center;
}
.no-results i { width: 40px; height: 40px; color: var(--text-muted); }
.no-results span { color: var(--text-muted); font-size: 0.95rem; }

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 20px;
  flex-wrap: wrap;
}
.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s var(--ease);
}
.page-btn:hover:not(:disabled) {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}
.page-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.page-btn i { width: 14px; height: 14px; }
.page-info {
  color: var(--text-muted);
  font-size: 0.8rem;
  margin: 0 8px;
}

/* Footer */
.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
</head>
<body>

<div class="hero">
  <h1>${title}</h1>
  <div class="hero-badges">
    <span class="badge"><i data-lucide="rows-3"></i>${rowCount} rows</span>
    <span class="badge"><i data-lucide="columns-3"></i>${colCount} columns</span>
  </div>
</div>

<div class="container">
  <div class="toolbar">
    <div class="search-wrap">
      <i data-lucide="search"></i>
      <input class="search-input" id="search" placeholder="Search across all columns..." oninput="filterRows()">
    </div>
    <div class="toolbar-stats" id="stats"></div>
    <div class="export-group">
      <button class="btn" onclick="exportCSV()"><i data-lucide="file-spreadsheet"></i>CSV</button>
      <button class="btn" onclick="exportJSON()"><i data-lucide="file-json"></i>JSON</button>
    </div>
  </div>

  <div class="table-container">
    <div class="shadow-left" id="shadowLeft"></div>
    <div class="shadow-right" id="shadowRight"></div>
    <div class="table-scroll" id="tableScroll">
      <table>
        <thead><tr id="thead"></tr></thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>
    <div class="no-results" id="noResults">
      <i data-lucide="search-x"></i>
      <span>No matching rows found</span>
    </div>
    <div class="table-footer" id="tableFooter"></div>
  </div>

  <div class="pagination" id="pagination"></div>
</div>

<script>
const headers=${JSON.stringify(data.headers)};
const allRows=${JSON.stringify(data.rows)};
let sortCol=-1, sortAsc=true;
let currentPage=1;
const PAGE_SIZE=25;
const PAGINATE_THRESHOLD=50;
let filteredRows=[...allRows];

function getSortedRows(){
  const sorted=[...filteredRows];
  if(sortCol>=0){
    sorted.sort((a,b)=>{
      const va=a[sortCol]||'', vb=b[sortCol]||'';
      const na=parseFloat(va), nb=parseFloat(vb);
      if(!isNaN(na)&&!isNaN(nb)) return sortAsc?na-nb:nb-na;
      return sortAsc?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));
    });
  }
  return sorted;
}

function renderTable(){
  const thead=document.getElementById('thead');
  thead.innerHTML=headers.map((h,i)=>{
    const isSorted=i===sortCol;
    const cls=isSorted?' class="sorted"':'';
    let iconName='chevrons-up-down';
    if(isSorted) iconName=sortAsc?'chevron-up':'chevron-down';
    return '<th'+cls+' onclick="sortBy('+i+')">'+escH(h)+'<span class="sort-icon"><i data-lucide="'+iconName+'"></i></span></th>';
  }).join('');

  const sorted=getSortedRows();
  const usePagination=allRows.length>PAGINATE_THRESHOLD;
  let pageRows=sorted;
  if(usePagination){
    const totalPages=Math.max(1,Math.ceil(sorted.length/PAGE_SIZE));
    if(currentPage>totalPages) currentPage=totalPages;
    const start=(currentPage-1)*PAGE_SIZE;
    pageRows=sorted.slice(start,start+PAGE_SIZE);
    renderPagination(totalPages,sorted.length);
  } else {
    document.getElementById('pagination').innerHTML='';
  }

  const tbody=document.getElementById('tbody');
  tbody.innerHTML=pageRows.map(row=>
    '<tr>'+row.map(cell=>'<td>'+escH(String(cell))+'</td>').join('')+'</tr>'
  ).join('');

  const noRes=document.getElementById('noResults');
  noRes.style.display=filteredRows.length===0?'flex':'none';

  const footer=document.getElementById('tableFooter');
  if(usePagination){
    const start=(currentPage-1)*PAGE_SIZE+1;
    const end=Math.min(currentPage*PAGE_SIZE,sorted.length);
    footer.textContent='Showing '+start+' - '+end+' of '+sorted.length+' rows';
  } else {
    footer.textContent=filteredRows.length+' of '+allRows.length+' rows \\u00B7 '+headers.length+' columns';
  }

  document.getElementById('stats').textContent=filteredRows.length===allRows.length
    ? allRows.length+' rows'
    : filteredRows.length+' of '+allRows.length+' rows';

  lucide.createIcons();
  updateScrollShadows();
}

function renderPagination(totalPages,totalRows){
  const pg=document.getElementById('pagination');
  if(totalPages<=1){pg.innerHTML='';return;}
  let html='';
  html+='<button class="page-btn" onclick="goPage(1)" '+(currentPage===1?'disabled':'')+'><i data-lucide="chevrons-left"></i></button>';
  html+='<button class="page-btn" onclick="goPage('+(currentPage-1)+')" '+(currentPage===1?'disabled':'')+'><i data-lucide="chevron-left"></i></button>';
  const range=getPageRange(currentPage,totalPages);
  if(range[0]>1){html+='<button class="page-btn" onclick="goPage(1)">1</button>';if(range[0]>2)html+='<span class="page-info">...</span>';}
  for(let p=range[0];p<=range[1];p++){
    html+='<button class="page-btn'+(p===currentPage?' active':'')+'" onclick="goPage('+p+')">'+p+'</button>';
  }
  if(range[1]<totalPages){if(range[1]<totalPages-1)html+='<span class="page-info">...</span>';html+='<button class="page-btn" onclick="goPage('+totalPages+')">'+totalPages+'</button>';}
  html+='<button class="page-btn" onclick="goPage('+(currentPage+1)+')" '+(currentPage===totalPages?'disabled':'')+'><i data-lucide="chevron-right"></i></button>';
  html+='<button class="page-btn" onclick="goPage('+totalPages+')" '+(currentPage===totalPages?'disabled':'')+'><i data-lucide="chevrons-right"></i></button>';
  pg.innerHTML=html;
}

function getPageRange(cur,total){
  const delta=2;
  let start=Math.max(1,cur-delta);
  let end=Math.min(total,cur+delta);
  if(cur-delta<1) end=Math.min(total,end+(1-(cur-delta)));
  if(cur+delta>total) start=Math.max(1,start-(cur+delta-total));
  return[start,end];
}

function goPage(p){
  const totalPages=Math.max(1,Math.ceil(filteredRows.length/PAGE_SIZE));
  currentPage=Math.max(1,Math.min(p,totalPages));
  renderTable();
}

function sortBy(col){
  if(sortCol===col) sortAsc=!sortAsc; else {sortCol=col;sortAsc=true;}
  currentPage=1;
  renderTable();
}

function filterRows(){
  const q=document.getElementById('search').value.toLowerCase().trim();
  if(!q){
    filteredRows=[...allRows];
  } else {
    filteredRows=allRows.filter(row=>row.some(cell=>String(cell).toLowerCase().includes(q)));
  }
  currentPage=1;
  renderTable();
}

function escH(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function exportCSV(){
  let csv=headers.join(',')+String.fromCharCode(10);
  allRows.forEach(r=>{csv+=r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')+String.fromCharCode(10)});
  download(csv,'data-table.csv','text/csv');
}

function exportJSON(){
  const data=allRows.map(r=>{const o={};headers.forEach((h,i)=>{o[h]=r[i]||''});return o});
  download(JSON.stringify(data,null,2),'data-table.json','application/json');
}

function download(content,name,type){
  const blob=new Blob([content],{type});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
}

function updateScrollShadows(){
  const el=document.getElementById('tableScroll');
  const sl=document.getElementById('shadowLeft');
  const sr=document.getElementById('shadowRight');
  if(!el)return;
  sl.classList.toggle('visible',el.scrollLeft>0);
  sr.classList.toggle('visible',el.scrollLeft<el.scrollWidth-el.clientWidth-1);
}
document.getElementById('tableScroll').addEventListener('scroll',updateScrollShadows);

renderTable();
</script>
</body></html>`;
}

async function main() {
  const opts = parseArgs();
  if (!opts.input) { console.error('Error: -i <input.json> required'); process.exit(1); }

  const data = JSON.parse(readFileSync(resolve(opts.input), 'utf-8'));
  const outDir = resolve(opts.outputDir);
  mkdirSync(outDir, { recursive: true });

  // CSV
  const { stringify } = await import(join(SKILL_DIR, 'node_modules', 'csv-stringify', 'lib', 'sync.js'));
  const csvContent = stringify([data.headers, ...data.rows]);
  const csvPath = join(outDir, `${opts.name}.csv`);
  writeFileSync(csvPath, csvContent);

  // JSON (row objects)
  const jsonRows = data.rows.map((row) => {
    const obj = {};
    data.headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
  const jsonPath = join(outDir, `${opts.name}.json`);
  writeFileSync(jsonPath, JSON.stringify(jsonRows, null, 2));

  // Markdown table
  let md = data.title ? `# ${data.title}\n\n` : '';
  md += `| ${data.headers.join(' | ')} |\n`;
  md += `| ${data.headers.map(() => '---').join(' | ')} |\n`;
  for (const row of data.rows) {
    md += `| ${row.join(' | ')} |\n`;
  }
  const mdPath = join(outDir, `${opts.name}.md`);
  writeFileSync(mdPath, md);

  // Interactive HTML
  const htmlPath = join(outDir, `${opts.name}.html`);
  writeFileSync(htmlPath, buildHtml(data));

  console.log(JSON.stringify({ status: 'success', csv: csvPath, json: jsonPath, markdown: mdPath, html: htmlPath, rows: data.rows.length }, null, 2));
}

main().catch((err) => { console.error('Data table generation failed:', err.message); process.exit(1); });
