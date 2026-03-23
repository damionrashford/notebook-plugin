#!/usr/bin/env node
/**
 * Generate a quiz from JSON input.
 * Usage: node generate.mjs -i <input.json> -o <output-dir> [--name quiz]
 *
 * Input JSON: { "title": "...", "questions": [{ "question": "...", "type": "multiple_choice"|"short_answer", "options": [...], "answer": "...", "explanation": "..." }] }
 * Outputs: .json + .md + .html (interactive quiz with scoring)
 *
 * Zero npm dependencies.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: null, outputDir: './output', name: 'quiz' };
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-i' || args[i] === '--input') && args[i + 1]) opts.input = args[++i];
    else if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) opts.outputDir = args[++i];
    else if ((args[i] === '--name') && args[i + 1]) opts.name = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node generate.mjs -i <input.json> -o <output-dir> [--name quiz]');
      process.exit(0);
    }
  }
  return opts;
}

function buildHtml(data) {
  const mcCount = data.questions.filter(q => q.type === 'multiple_choice').length;
  const saCount = data.questions.length - mcCount;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${data.title}</title>
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
  --warning-soft: rgba(245, 158, 11, 0.1);
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
@keyframes cardEntrance{from{opacity:0;transform:scale(0.96) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes countPulse{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
@keyframes gradeReveal{from{opacity:0;transform:scale(0.4) rotate(-10deg)}to{opacity:1;transform:scale(1) rotate(0)}}

.hero{text-align:center;margin-bottom:32px;animation:fadeInUp 0.5s var(--ease) both;width:100%;max-width:720px}
.hero-icon{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:var(--radius-md);background:var(--accent-soft);border:1px solid rgba(124,106,255,0.2);margin-bottom:16px;color:var(--accent)}
.hero-icon i{width:28px;height:28px}
.hero h1{font-size:2em;font-weight:700;margin-bottom:12px;background:linear-gradient(135deg,var(--accent),#a78bfa,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-stats{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.hero-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;border-radius:20px;font-size:0.85em;font-weight:500;border:1px solid rgba(124,106,255,0.15);background:var(--accent-soft);color:var(--accent)}
.hero-badge i{width:14px;height:14px}
.hero-badge.mc-badge{background:var(--success-soft);color:var(--success);border-color:rgba(16,185,129,0.15)}
.hero-badge.sa-badge{background:var(--warning-soft);color:var(--warning);border-color:rgba(245,158,11,0.15)}

.scoreboard{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;max-width:720px;width:100%;animation:fadeInUp 0.5s var(--ease) 0.1s both}
.stat-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px 12px;text-align:center;transition:all 0.2s var(--ease);box-shadow:var(--shadow-sm)}
.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);border-color:var(--border-hover)}
.stat-card .stat-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-sm);margin-bottom:8px}
.stat-card .stat-icon i{width:16px;height:16px}
.stat-card.correct-stat .stat-icon{background:var(--success-soft);color:var(--success)}
.stat-card.wrong-stat .stat-icon{background:var(--danger-soft);color:var(--danger)}
.stat-card.pending-stat .stat-icon{background:var(--warning-soft);color:var(--warning)}
.stat-card.score-stat .stat-icon{background:var(--accent-soft);color:var(--accent)}
.stat-card .stat-value{font-size:1.8em;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2;transition:transform 0.3s var(--ease)}
.stat-card .stat-value.pulse{animation:countPulse 0.3s var(--ease)}
.stat-card.correct-stat .stat-value{color:var(--success)}
.stat-card.wrong-stat .stat-value{color:var(--danger)}
.stat-card.pending-stat .stat-value{color:var(--warning)}
.stat-card.score-stat .stat-value{color:var(--accent)}
.stat-card .stat-label{font-size:0.72em;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-top:4px}

.progress-track{width:100%;max-width:720px;height:6px;background:var(--bg-elevated);border-radius:3px;margin-bottom:28px;overflow:hidden;animation:fadeInUp 0.5s var(--ease) 0.15s both}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--accent),#a78bfa);border-radius:3px;transition:width 0.4s var(--ease)}

#quizView{width:100%;max-width:720px}

.q-card{background:linear-gradient(160deg,var(--bg-card) 0%,var(--bg-secondary) 100%);border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px;box-shadow:var(--shadow-lg);position:relative;overflow:hidden}
.q-card.entering{animation:cardEntrance 0.35s var(--ease) both}
.q-card::before{content:'';position:absolute;inset:0;border-radius:var(--radius-lg);background:linear-gradient(135deg,rgba(124,106,255,0.04) 0%,transparent 50%);pointer-events:none}
.q-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.q-badge{display:inline-flex;align-items:center;gap:6px;font-size:0.78em;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted)}
.q-badge i{width:14px;height:14px}
.q-type{font-size:0.75em;font-weight:500;padding:4px 12px;border-radius:20px;background:var(--accent-soft);color:var(--accent);border:1px solid rgba(124,106,255,0.15)}
.q-type.sa-type{background:var(--warning-soft);color:var(--warning);border-color:rgba(245,158,11,0.15)}
.q-text{font-size:1.2em;line-height:1.7;font-weight:500;margin-bottom:24px;color:var(--text-primary)}

.options{display:flex;flex-direction:column;gap:10px}
.option{background:var(--bg-secondary);border:1.5px solid var(--border);border-radius:var(--radius-md);padding:14px 18px;cursor:pointer;transition:all 0.2s var(--ease);display:flex;align-items:center;gap:14px;position:relative}
.option:hover:not(.disabled){background:var(--bg-card-hover);border-color:var(--border-hover);transform:translateX(4px)}
.option:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.option.selected{border-color:var(--accent);background:var(--accent-soft)}
.option.correct-answer{border-color:var(--success);background:var(--success-soft)}
.option.correct-answer .option-letter{background:var(--success);color:#fff;border-color:var(--success)}
.option.wrong-answer{border-color:var(--danger);background:var(--danger-soft);animation:shake 0.4s var(--ease)}
.option.wrong-answer .option-letter{background:var(--danger);color:#fff;border-color:var(--danger)}
.option.disabled{cursor:default;pointer-events:none}
.option-letter{width:32px;height:32px;border-radius:var(--radius-xs);background:var(--bg-elevated);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:0.85em;flex-shrink:0;transition:all 0.2s var(--ease)}
.option:hover:not(.disabled) .option-letter{border-color:var(--border-hover);background:var(--bg-card)}
.option.selected .option-letter{background:var(--accent);color:#fff;border-color:var(--accent)}
.option-text{flex:1;font-size:0.95em;line-height:1.5}
.option-feedback{position:absolute;right:16px;display:none;align-items:center;justify-content:center;width:24px;height:24px}
.option-feedback i{width:18px;height:18px}
.option.correct-answer .option-feedback{display:flex;color:var(--success)}
.option.wrong-answer .option-feedback{display:flex;color:var(--danger)}

.sa-area{display:flex;flex-direction:column;gap:12px}
.sa-input{width:100%;background:var(--bg-secondary);border:1.5px solid var(--border);border-radius:var(--radius-md);padding:14px 18px;color:var(--text-primary);font-size:1em;font-family:var(--font);transition:all 0.2s var(--ease)}
.sa-input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.sa-input:disabled{opacity:0.6;cursor:not-allowed}
.sa-input.correct-input{border-color:var(--success);box-shadow:0 0 0 3px rgba(16,185,129,0.1)}
.sa-input.wrong-input{border-color:var(--danger);box-shadow:0 0 0 3px rgba(239,68,68,0.1)}

.explanation{margin-top:20px;padding:0;background:var(--accent-soft);border-radius:var(--radius-md);border-left:3px solid var(--accent);font-size:0.9em;line-height:1.6;overflow:hidden;max-height:0;opacity:0;transition:all 0.35s var(--ease)}
.explanation.visible{max-height:400px;opacity:1;padding:16px 20px}
.explanation .exp-header{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:600;color:var(--accent)}
.explanation .exp-header i{width:16px;height:16px}
.answer-label{font-weight:600;color:var(--success);margin-bottom:6px;display:flex;align-items:center;gap:8px}
.answer-label i{width:16px;height:16px}
.explanation .exp-text{color:var(--text-secondary)}

.toolbar{display:flex;gap:12px;align-items:center;justify-content:center;margin-top:28px;width:100%;max-width:720px;animation:fadeInUp 0.5s var(--ease) 0.2s both}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:10px 24px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.9em;font-weight:500;font-family:var(--font);min-height:42px;transition:all 0.2s var(--ease);box-shadow:var(--shadow-sm)}
.btn:hover{background:var(--bg-card-hover);border-color:var(--border-hover);transform:translateY(-1px);box-shadow:var(--shadow-md)}
.btn:active{transform:translateY(0)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn:disabled{opacity:0.3;cursor:not-allowed;transform:none}
.btn i{width:16px;height:16px}
.btn-accent{background:var(--accent);border-color:var(--accent);color:#fff}
.btn-accent:hover{background:var(--accent-hover);border-color:var(--accent-hover)}
.btn-accent:disabled{background:var(--accent);opacity:0.3}
.btn-success{background:var(--success);border-color:var(--success);color:#fff}
.btn-success:hover{background:#0ea572;border-color:#0ea572}
.counter{font-size:1em;font-weight:600;min-width:90px;text-align:center;color:var(--text-secondary);font-variant-numeric:tabular-nums}

.shortcuts-bar{display:flex;gap:16px;align-items:center;justify-content:center;margin-top:16px;flex-wrap:wrap;animation:fadeInUp 0.5s var(--ease) 0.3s both}
.shortcut{display:inline-flex;align-items:center;gap:6px;color:var(--text-muted);font-size:0.8em}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:28px;padding:2px 8px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-xs);font-size:0.85em;font-weight:500;font-family:var(--mono);color:var(--text-secondary);line-height:1.4}

/* End screen */
#endScreen{display:none;width:100%;max-width:720px;animation:fadeInUp 0.5s var(--ease) both}
.end-card{background:linear-gradient(160deg,var(--bg-card) 0%,var(--bg-secondary) 100%);border:1px solid var(--border);border-radius:var(--radius-lg);padding:40px;box-shadow:var(--shadow-lg);text-align:center;position:relative;overflow:hidden}
.end-card::before{content:'';position:absolute;inset:0;border-radius:var(--radius-lg);background:linear-gradient(135deg,rgba(124,106,255,0.06) 0%,transparent 50%);pointer-events:none}
.grade-circle{display:inline-flex;align-items:center;justify-content:center;width:100px;height:100px;border-radius:50%;font-size:2.5em;font-weight:700;margin-bottom:20px;animation:gradeReveal 0.5s var(--ease) 0.2s both}
.grade-a{background:var(--success-soft);color:var(--success);border:3px solid var(--success)}
.grade-b{background:rgba(124,106,255,0.1);color:var(--accent);border:3px solid var(--accent)}
.grade-c{background:var(--warning-soft);color:var(--warning);border:3px solid var(--warning)}
.grade-f{background:var(--danger-soft);color:var(--danger);border:3px solid var(--danger)}
.end-title{font-size:1.8em;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,var(--accent),#a78bfa,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.end-subtitle{color:var(--text-secondary);font-size:1em;margin-bottom:28px}
.end-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:28px}
.end-stat{background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px 12px;text-align:center}
.end-stat .es-val{font-size:1.6em;font-weight:700;font-variant-numeric:tabular-nums}
.end-stat .es-label{font-size:0.72em;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:2px}
.end-stat.es-score .es-val{color:var(--accent)}
.end-stat.es-correct .es-val{color:var(--success)}
.end-stat.es-wrong .es-val{color:var(--danger)}
.end-stat.es-mc .es-val{color:var(--text-primary)}
.end-stat.es-sa .es-val{color:var(--warning)}
.end-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}

.review-list{margin-top:24px;display:none;flex-direction:column;gap:12px;text-align:left}
.review-list.visible{display:flex}
.review-item{background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px 20px;display:flex;gap:14px;align-items:flex-start;animation:fadeInUp 0.3s var(--ease) both}
.review-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}
.review-icon i{width:16px;height:16px}
.review-icon.ri-correct{background:var(--success-soft);color:var(--success)}
.review-icon.ri-wrong{background:var(--danger-soft);color:var(--danger)}
.review-body{flex:1;min-width:0}
.review-q{font-weight:500;font-size:0.95em;margin-bottom:4px}
.review-a{font-size:0.85em;color:var(--text-secondary)}
.review-a strong{color:var(--success);font-weight:600}
.review-a .your-ans{color:var(--danger)}

@media(max-width:768px){
  body{padding:20px 12px}
  .hero h1{font-size:1.5em}
  .hero-stats{gap:8px}
  .scoreboard{grid-template-columns:repeat(2,1fr);gap:8px}
  .stat-card{padding:12px 8px}
  .stat-card .stat-value{font-size:1.4em}
  .q-card{padding:20px}
  .q-text{font-size:1.05em}
  .option{padding:12px 14px;gap:10px}
  .toolbar{gap:8px;flex-wrap:wrap}
  .btn{padding:8px 16px;font-size:0.85em}
  .shortcuts-bar{gap:10px}
  .end-card{padding:28px 20px}
  .end-title{font-size:1.4em}
  .end-stats{grid-template-columns:repeat(2,1fr)}
}
</style>
</head>
<body>

<div class="hero">
  <div class="hero-icon"><i data-lucide="brain"></i></div>
  <h1>${data.title}</h1>
  <div class="hero-stats">
    <div class="hero-badge"><i data-lucide="hash"></i><span>${data.questions.length} questions</span></div>
    ${mcCount > 0 ? '<div class="hero-badge mc-badge"><i data-lucide="list-checks"></i><span>' + mcCount + ' multiple choice</span></div>' : ''}
    ${saCount > 0 ? '<div class="hero-badge sa-badge"><i data-lucide="pencil-line"></i><span>' + saCount + ' short answer</span></div>' : ''}
  </div>
</div>

<div class="scoreboard">
  <div class="stat-card correct-stat">
    <div class="stat-icon"><i data-lucide="check-circle"></i></div>
    <div class="stat-value" id="correctCount">0</div>
    <div class="stat-label">Correct</div>
  </div>
  <div class="stat-card wrong-stat">
    <div class="stat-icon"><i data-lucide="x-circle"></i></div>
    <div class="stat-value" id="wrongCount">0</div>
    <div class="stat-label">Wrong</div>
  </div>
  <div class="stat-card pending-stat">
    <div class="stat-icon"><i data-lucide="clock"></i></div>
    <div class="stat-value" id="pendingCount">${data.questions.length}</div>
    <div class="stat-label">Remaining</div>
  </div>
  <div class="stat-card score-stat">
    <div class="stat-icon"><i data-lucide="percent"></i></div>
    <div class="stat-value" id="scorePercent">0%</div>
    <div class="stat-label">Score</div>
  </div>
</div>

<div class="progress-track"><div class="progress-fill" id="progress"></div></div>

<div id="quizView">
  <div class="q-card entering" id="questionCard"></div>
  <div class="toolbar">
    <button class="btn" id="prevBtn" aria-label="Previous question"><i data-lucide="chevron-left"></i> Prev</button>
    <span class="counter" id="counter"></span>
    <button class="btn btn-accent" id="checkBtn" aria-label="Check answer"><i data-lucide="check"></i> Check Answer</button>
    <button class="btn btn-success" id="nextBtn" style="display:none" aria-label="Next question">Next <i data-lucide="chevron-right"></i></button>
  </div>
  <div class="shortcuts-bar">
    <div class="shortcut"><span class="kbd">1</span>-<span class="kbd">4</span> Select</div>
    <div class="shortcut"><span class="kbd">Enter</span> Check / Next</div>
    <div class="shortcut"><span class="kbd">&larr;</span> Prev</div>
    <div class="shortcut"><span class="kbd">&rarr;</span> Next</div>
  </div>
</div>

<div id="endScreen">
  <div class="end-card">
    <div class="grade-circle" id="gradeCircle">-</div>
    <div class="end-title" id="endTitle">Quiz Complete!</div>
    <div class="end-subtitle" id="endSubtitle"></div>
    <div class="end-stats" id="endStats"></div>
    <div class="end-actions">
      <button class="btn btn-accent" onclick="toggleReview()" id="reviewBtn"><i data-lucide="eye"></i> Review Answers</button>
      <button class="btn" onclick="resetQuiz()"><i data-lucide="rotate-ccw"></i> Retake Quiz</button>
    </div>
    <div class="review-list" id="reviewList"></div>
  </div>
</div>

<script>
const questions=${JSON.stringify(data.questions)};
const letters=['A','B','C','D','E','F'];
const totalQ=questions.length;
let idx=0;
let scores={correct:0,wrong:0};
let answered=new Array(totalQ).fill(false);
let selected=new Array(totalQ).fill(-1);
let saValues=new Array(totalQ).fill('');
let results=new Array(totalQ).fill(null);

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function escAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

function pulseValue(el){el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse')}

function renderQuestion(){
  const q=questions[idx];
  const card=document.getElementById('questionCard');
  card.classList.remove('entering');void card.offsetWidth;card.classList.add('entering');
  const isMC=q.type==='multiple_choice'&&q.options;
  let html='<div class="q-header">';
  html+='<div class="q-badge"><i data-lucide="help-circle"></i> Question '+(idx+1)+' of '+totalQ+'</div>';
  html+='<div class="q-type'+(isMC?'':' sa-type')+'">'+(isMC?'Multiple Choice':'Short Answer')+'</div></div>';
  html+='<div class="q-text">'+esc(q.question)+'</div>';
  if(isMC){
    html+='<div class="options" role="radiogroup" aria-label="Answer options">';
    const correctIdx=q.options.findIndex(function(_,k){return letters[k]===q.answer.trim().toUpperCase()});
    q.options.forEach(function(opt,j){
      let cls='option';
      if(answered[idx]){
        cls+=' disabled';
        if(j===correctIdx)cls+=' correct-answer';
        if(selected[idx]===j&&j!==correctIdx)cls+=' wrong-answer';
      }else if(selected[idx]===j){cls+=' selected'}
      const checked=selected[idx]===j?'true':'false';
      html+='<div class="'+cls+'" role="radio" aria-checked="'+checked+'" tabindex="0" onclick="selectOpt('+j+')" onkeydown="optKey(event,'+j+')">';
      html+='<span class="option-letter">'+letters[j]+'</span>';
      html+='<span class="option-text">'+esc(opt)+'</span>';
      html+='<span class="option-feedback">';
      if(answered[idx]&&j===correctIdx)html+='<i data-lucide="check-circle-2"></i>';
      if(answered[idx]&&selected[idx]===j&&j!==correctIdx)html+='<i data-lucide="x-circle"></i>';
      html+='</span></div>';
    });
    html+='</div>';
  }else{
    html+='<div class="sa-area">';
    let inputCls='sa-input';
    if(answered[idx])inputCls+=results[idx]?' correct-input':' wrong-input';
    html+='<input type="text" class="'+inputCls+'" id="saInput" placeholder="Type your answer..." value="'+escAttr(saValues[idx])+'" '+(answered[idx]?'disabled':'')+' autocomplete="off" aria-label="Your answer">';
    html+='</div>';
  }
  html+='<div class="explanation'+(answered[idx]?' visible':'')+'" id="explanation">';
  html+='<div class="exp-header"><i data-lucide="info"></i> Explanation</div>';
  html+='<div class="answer-label"><i data-lucide="check-circle-2"></i> Answer: '+esc(q.answer)+'</div>';
  if(q.explanation)html+='<div class="exp-text">'+esc(q.explanation)+'</div>';
  html+='</div>';
  card.innerHTML=html;
  document.getElementById('counter').textContent=(idx+1)+' / '+totalQ;
  document.getElementById('prevBtn').disabled=idx===0;
  const allDone=scores.correct+scores.wrong===totalQ;
  document.getElementById('checkBtn').style.display=answered[idx]?'none':'inline-flex';
  const isMCQ=q.type==='multiple_choice'&&q.options;
  document.getElementById('checkBtn').disabled=isMCQ?selected[idx]<0:false;
  if(answered[idx]){
    if(allDone){
      document.getElementById('nextBtn').innerHTML='Finish <i data-lucide="flag"></i>';
      document.getElementById('nextBtn').style.display='inline-flex';
    }else if(idx<totalQ-1){
      document.getElementById('nextBtn').innerHTML='Next <i data-lucide="chevron-right"></i>';
      document.getElementById('nextBtn').style.display='inline-flex';
    }else{
      document.getElementById('nextBtn').style.display='none';
    }
  }else{
    document.getElementById('nextBtn').style.display='none';
  }
  const pct=totalQ>0?((scores.correct+scores.wrong)/totalQ*100):0;
  document.getElementById('progress').style.width=pct+'%';
  lucide.createIcons();
  if(!answered[idx]&&!isMCQ){var inp=document.getElementById('saInput');if(inp)setTimeout(function(){inp.focus()},120)}
}

function selectOpt(j){if(answered[idx])return;selected[idx]=j;renderQuestion()}
function optKey(e,j){if(e.key==='Enter'||e.key===' '){e.preventDefault();selectOpt(j)}}

function checkAnswer(){
  if(answered[idx])return;
  var q=questions[idx];
  var isMC=q.type==='multiple_choice'&&q.options;
  if(isMC){
    if(selected[idx]<0)return;
    var correct=q.answer.trim().toUpperCase()===letters[selected[idx]];
    results[idx]=correct;
    if(correct)scores.correct++;else scores.wrong++;
  }else{
    var inp=document.getElementById('saInput');
    var val=(inp?inp.value:'').trim();
    saValues[idx]=val;
    if(!val)return;
    var correct=val.toLowerCase()===q.answer.trim().toLowerCase();
    results[idx]=correct;
    if(correct)scores.correct++;else scores.wrong++;
  }
  answered[idx]=true;
  updateScores();
  renderQuestion();
}

function goNext(){
  if(!answered[idx])return;
  if(scores.correct+scores.wrong===totalQ){showEnd();return}
  if(idx<totalQ-1){idx++;renderQuestion()}
}
function goPrev(){if(idx>0){idx--;renderQuestion()}}

function updateScores(){
  var ce=document.getElementById('correctCount');
  var we=document.getElementById('wrongCount');
  var pe=document.getElementById('pendingCount');
  var se=document.getElementById('scorePercent');
  ce.textContent=scores.correct;pulseValue(ce);
  we.textContent=scores.wrong;pulseValue(we);
  pe.textContent=totalQ-scores.correct-scores.wrong;
  var done=scores.correct+scores.wrong;
  se.textContent=done>0?Math.round(scores.correct/done*100)+'%':'0%';
  pulseValue(se);
}

function showEnd(){
  document.getElementById('quizView').style.display='none';
  var end=document.getElementById('endScreen');
  end.style.display='block';
  var pct=totalQ>0?Math.round(scores.correct/totalQ*100):0;
  var grade,cls;
  if(pct>=90){grade='A';cls='grade-a'}else if(pct>=80){grade='B';cls='grade-b'}else if(pct>=70){grade='C';cls='grade-c'}else{grade='F';cls='grade-f'}
  var circle=document.getElementById('gradeCircle');
  circle.textContent=grade;circle.className='grade-circle '+cls;
  document.getElementById('endTitle').textContent=pct===100?'Perfect Score!':pct>=80?'Great Job!':pct>=60?'Good Effort!':'Keep Practicing!';
  document.getElementById('endSubtitle').textContent='You scored '+scores.correct+' out of '+totalQ+' ('+pct+'%)';
  var mcTotal=questions.filter(function(q){return q.type==='multiple_choice'}).length;
  var saTotal=totalQ-mcTotal;
  var mcCorrect=questions.filter(function(q,i){return q.type==='multiple_choice'&&results[i]===true}).length;
  var saCorrect=questions.filter(function(q,i){return q.type!=='multiple_choice'&&results[i]===true}).length;
  var sh='';
  sh+='<div class="end-stat es-score"><div class="es-val">'+pct+'%</div><div class="es-label">Final Score</div></div>';
  sh+='<div class="end-stat es-correct"><div class="es-val">'+scores.correct+'</div><div class="es-label">Correct</div></div>';
  sh+='<div class="end-stat es-wrong"><div class="es-val">'+scores.wrong+'</div><div class="es-label">Incorrect</div></div>';
  if(mcTotal>0)sh+='<div class="end-stat es-mc"><div class="es-val">'+mcCorrect+'/'+mcTotal+'</div><div class="es-label">Multiple Choice</div></div>';
  if(saTotal>0)sh+='<div class="end-stat es-sa"><div class="es-val">'+saCorrect+'/'+saTotal+'</div><div class="es-label">Short Answer</div></div>';
  document.getElementById('endStats').innerHTML=sh;
  document.getElementById('reviewList').classList.remove('visible');
  lucide.createIcons();
}

function toggleReview(){
  var list=document.getElementById('reviewList');
  if(list.classList.contains('visible')){list.classList.remove('visible');return}
  var html='';
  questions.forEach(function(q,i){
    var correct=results[i]===true;
    var isMC=q.type==='multiple_choice'&&q.options;
    var yours=isMC?(selected[i]>=0?letters[selected[i]]+'. '+q.options[selected[i]]:'No answer'):(saValues[i]||'No answer');
    html+='<div class="review-item" style="animation-delay:'+(i*0.04)+'s">';
    html+='<div class="review-icon '+(correct?'ri-correct':'ri-wrong')+'"><i data-lucide="'+(correct?'check':'x')+'"></i></div>';
    html+='<div class="review-body">';
    html+='<div class="review-q">'+(i+1)+'. '+esc(q.question)+'</div>';
    html+='<div class="review-a"><strong>Answer: '+esc(q.answer)+'</strong>';
    if(!correct)html+=' &mdash; <span class="your-ans">You answered: '+esc(yours)+'</span>';
    html+='</div></div></div>';
  });
  list.innerHTML=html;
  list.classList.add('visible');
  lucide.createIcons();
}

function resetQuiz(){
  idx=0;scores={correct:0,wrong:0};
  answered=new Array(totalQ).fill(false);
  selected=new Array(totalQ).fill(-1);
  saValues=new Array(totalQ).fill('');
  results=new Array(totalQ).fill(null);
  document.getElementById('endScreen').style.display='none';
  document.getElementById('quizView').style.display='block';
  document.getElementById('reviewList').classList.remove('visible');
  updateScores();renderQuestion();
  window.scrollTo({top:0,behavior:'smooth'});
}

document.getElementById('prevBtn').addEventListener('click',goPrev);
document.getElementById('nextBtn').addEventListener('click',goNext);
document.getElementById('checkBtn').addEventListener('click',checkAnswer);

document.addEventListener('keydown',function(e){
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'){
    if(e.key==='Enter'){e.preventDefault();if(!answered[idx])checkAnswer();else goNext()}
    return;
  }
  if(e.key==='ArrowRight'){if(answered[idx])goNext()}
  else if(e.key==='ArrowLeft'){goPrev()}
  else if(e.key==='Enter'){e.preventDefault();if(!answered[idx])checkAnswer();else goNext()}
  else if(e.key>='1'&&e.key<='9'){
    var n=parseInt(e.key)-1;var q=questions[idx];
    if(q.type==='multiple_choice'&&q.options&&n<q.options.length&&!answered[idx])selectOpt(n);
  }
});

updateScores();renderQuestion();
lucide.createIcons();
<\/script>
</body></html>`;
}

function main() {
  const opts = parseArgs();
  if (!opts.input) { console.error('Error: -i <input.json> required'); process.exit(1); }

  const data = JSON.parse(readFileSync(resolve(opts.input), 'utf-8'));
  const outDir = resolve(opts.outputDir);
  mkdirSync(outDir, { recursive: true });

  // JSON
  const jsonPath = join(outDir, `${opts.name}.json`);
  writeFileSync(jsonPath, JSON.stringify(data, null, 2));

  // Markdown
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  let md = `# ${data.title}\n\n> ${data.questions.length} questions\n\n`;
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    md += `### ${i + 1}. ${q.question}\n\n`;
    if (q.type === 'multiple_choice' && q.options) {
      for (let j = 0; j < q.options.length; j++) {
        md += `- **${letters[j]}.** ${q.options[j]}\n`;
      }
      md += '\n';
    }
    md += `<details>\n<summary>Show Answer</summary>\n\n`;
    md += `**Answer:** ${q.answer}\n\n`;
    if (q.explanation) md += `**Explanation:** ${q.explanation}\n\n`;
    md += `</details>\n\n---\n\n`;
  }
  const mdPath = join(outDir, `${opts.name}.md`);
  writeFileSync(mdPath, md);

  // Interactive HTML
  const htmlPath = join(outDir, `${opts.name}.html`);
  writeFileSync(htmlPath, buildHtml(data));

  console.log(JSON.stringify({ status: 'success', json: jsonPath, markdown: mdPath, html: htmlPath, count: data.questions.length }, null, 2));
}

main();
