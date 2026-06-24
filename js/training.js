// ══════════════════════════════════════════
// TRAINING — Mode classique + Mode chrono
// ══════════════════════════════════════════
let currentCat = 'passes';

// ══════════════════════════════════════════
// MENTAL & PERFORMANCE — check-in optionnel avant/après session
// ══════════════════════════════════════════

let mentalCheckinOpen = false;
const MENTAL_SLIDERS = [
  {key:'confidence', label:'Confiance', icon:'💪'},
  {key:'fatigue',     label:'Fatigue',   icon:'😴'},
  {key:'stress',      label:'Stress',    icon:'😬'},
];

function toggleMentalCheckin() {
  mentalCheckinOpen = !mentalCheckinOpen;
  document.getElementById('mentalCheckinPanel').style.display = mentalCheckinOpen ? 'block' : 'none';
  document.getElementById('mentalCheckinArrow').textContent = mentalCheckinOpen ? '▴' : '▾';
  if(mentalCheckinOpen) renderMentalSliders();
}

function renderMentalSliders() {
  const today = new Date().toISOString().slice(0,10);
  const checkins = DB.get('mentalCheckins') || {};
  const todayData = checkins[today] || {};

  MENTAL_SLIDERS.forEach(s => {
    const val = todayData[s.key] ?? 5;
    const el = document.getElementById('mentalSlider'+s.key.charAt(0).toUpperCase()+s.key.slice(1));
    if(!el) return;
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">
        <span>${s.icon} ${s.label}</span>
        <span id="mentalVal-${s.key}" style="color:var(--gold);font-weight:700;">${val}/10</span>
      </div>
      <input type="range" min="1" max="10" value="${val}" oninput="document.getElementById('mentalVal-${s.key}').textContent=this.value+'/10'" id="mentalRange-${s.key}" style="width:100%;margin-bottom:12px;">
    `;
  });
}

function saveMentalCheckin() {
  const today = new Date().toISOString().slice(0,10);
  const checkins = DB.get('mentalCheckins') || {};
  const entry = {};
  MENTAL_SLIDERS.forEach(s => {
    const rangeEl = document.getElementById('mentalRange-'+s.key);
    entry[s.key] = rangeEl ? parseInt(rangeEl.value) : 5;
  });
  checkins[today] = entry;
  DB.set('mentalCheckins', checkins);
  document.getElementById('mentalCheckinLabel').textContent = '🧠 État enregistré aujourd\'hui ✓';
  showToast('🧠 État enregistré','#1A3A1A');
}
let pendingExCat = 'passes';

// ── Mode chrono state ──
let chronoState = {
  active: false,
  exerciseId: null,
  exerciseName: null,
  exerciseType: null,
  table: 'other',
  totalReps: 20,
  currentRep: 0,
  results: [], // {success, time, penalty}
  timerLimit: 35,
  timerStart: null,
  timerInterval: null,
  waiting: true // waiting for "Prêt" press
};

function getTimerLimit(cat, table) {
  // Le bouton "Prêt" gère déjà le temps de manipulation.
  // Temps réel réglementaire une fois "Prêt" pressé :
  if(table === 'jupiter') return 15; // Jupiter : 15 sec partout
  return cat === 'passes' ? 10 : 15; // Autres tables : 10 sec milieu, 15 sec attaque/défense
}

function switchCat(cat, el) {
  document.querySelectorAll('.cat-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  currentCat = cat;
  renderTraining(cat);
}

function renderTraining(cat) {
  const exercises = DB.get('exercises') || DEFAULT_EXERCISES;
  const list = exercises[cat] || [];
  const ts = DB.get('trainStats') || {};
  const labels = { passes:['Tentatives','Réussites'], goals:['Tentatives','Buts'], saves:['Tentatives','Arrêts'] };

  let html = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
    <div class="qa-btn accent" onclick="showChronoSetup('${cat}')">
      <div class="qa-btn-icon">⏱️</div>
      <div class="qa-btn-label">Mode Chrono</div>
      <div class="qa-btn-sub">Avec timer réaliste</div>
    </div>
    <div class="qa-btn" onclick="document.getElementById('classicMode').style.display='block';document.getElementById('chronoSetup').style.display='none';">
      <div class="qa-btn-icon">📋</div>
      <div class="qa-btn-label">Mode Classique</div>
      <div class="qa-btn-sub">Saisie totaux</div>
    </div>
  </div>
  <div id="chronoSetup" style="display:none;"></div>
  <div id="chronoSession" style="display:none;"></div>
  <div id="classicMode">
    <div class="exercise-list">`;

  list.forEach(ex => {
    const s = ts[ex.id]||{tried:0,ok:0};
    const pct = s.tried>0 ? Math.round(s.ok/s.tried*100) : null;
    const pc = pct===null?'':pct>=70?' good':pct>=40?' mid':' low';
    const [l1,l2] = labels[ex.type]||['Tentatives','Réussites'];
    html += `
    <div class="exercise-card">
      <div class="exercise-header">
        <div class="exercise-name">${ex.name}</div>
        <div class="exercise-pct${pc}">${pct===null?'—':pct+'%'}</div>
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">Total : ${s.tried} essais · ${s.ok} réussites</div>
      <div class="exercise-inputs">
        <div class="ex-input-wrap"><label>${l1}</label>
          <input type="number" id="tried-${ex.id}" placeholder="0" min="0" oninput="updatePct('${ex.id}','${ex.type}')">
        </div>
        <div class="ex-input-wrap"><label>${l2}</label>
          <input type="number" id="ok-${ex.id}" placeholder="0" min="0" oninput="updatePct('${ex.id}','${ex.type}')">
        </div>
      </div>
      <div class="ex-bar"><div class="ex-bar-fill" id="bar-${ex.id}" style="width:${pct||0}%"></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;">
        <button type="button" class="ex-save-btn" onclick="saveExercise('${ex.id}','${ex.type}')">💾 Enregistrer</button>
        <button type="button" class="ex-save-btn" style="border-color:var(--cyan-dim);color:var(--cyan);" onclick="showChronoSetup('${currentCat}','${ex.id}')">⏱️ Chrono</button>
      </div>
    </div>`;
  });

  html += `</div>
    <button type="button" class="add-exercise-btn" onclick="openAddExercise('${cat}')">+ Ajouter un exercice</button>
  </div>`;

  document.getElementById('trainingContent').innerHTML = html;
}

function showChronoSetup(cat, preselectedId) {
  document.getElementById('classicMode').style.display = 'none';
  document.getElementById('chronoSession').style.display = 'none';
  const exercises = DB.get('exercises') || DEFAULT_EXERCISES;
  const list = exercises[cat] || [];

  const setupEl = document.getElementById('chronoSetup');
  setupEl.style.display = 'block';
  setupEl.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--gold-dim);border-radius:8px;padding:16px;margin-bottom:12px;">
      <div class="section-title" style="margin-bottom:12px;">⏱️ Configuration Chrono</div>

      <div class="modal-field" style="margin-bottom:12px;">
        <label>Table pratiquée</label>
        <select id="chrono-table" style="width:100%;background:var(--bg-surface);border:1px solid var(--border-bright);color:var(--text-primary);font-size:15px;padding:10px 12px;border-radius:4px;outline:none;" onchange="updateChronoTimer()">
          <option value="jupiter">Jupiter (15 sec · passe à l'arrêt OK)</option>
          <option value="other" selected>Bonzini / Tornado / Autre (10-15 sec · passe en mouvement)</option>
        </select>
      </div>

      <div class="modal-field" style="margin-bottom:12px;">
        <label>Exercice</label>
        <select id="chrono-exercise" style="width:100%;background:var(--bg-surface);border:1px solid var(--border-bright);color:var(--text-primary);font-size:15px;padding:10px 12px;border-radius:4px;outline:none;">
          ${list.map(ex => `<option value="${ex.id}" data-type="${ex.type}" ${ex.id===preselectedId?'selected':''}>${ex.name}</option>`).join('')}
        </select>
      </div>

      <div class="modal-field" style="margin-bottom:12px;">
        <label>Nombre de tentatives</label>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
          ${[10,20,30,50].map(n=>`<button type="button" id="reps-${n}" onclick="selectReps(${n})" style="padding:10px;background:${n===20?'var(--gold)':'var(--bg-surface)'};color:${n===20?'#000':'var(--text-primary)'};border:1px solid var(--border-bright);border-radius:4px;font-size:15px;font-weight:700;cursor:pointer;">${n}</button>`).join('')}
        </div>
      </div>

      <div style="background:var(--bg-surface);border-radius:6px;padding:10px;margin-bottom:14px;font-size:12px;color:var(--text-secondary);">
        ⏱️ Timer : <span id="chrono-timer-info" style="color:var(--gold);font-weight:700;">35 secondes</span> par tentative
        <div style="margin-top:4px;font-size:11px;color:var(--text-muted);">Le timer démarre quand tu appuies sur "Prêt !"</div>
      </div>

      <button type="button" class="btn-primary" onclick="startChronoSession()">🚀 Lancer la session</button>
      <button type="button" class="add-exercise-btn" style="margin-top:8px;" onclick="renderTraining(currentCat)">← Retour</button>
    </div>`;

  // Default selected reps
  window._chronoReps = 20;
  updateChronoTimer();
}

function selectReps(n) {
  window._chronoReps = n;
  [10,20,30,50].forEach(r => {
    const btn = document.getElementById('reps-'+r);
    if(btn) {
      btn.style.background = r===n ? 'var(--gold)' : 'var(--bg-surface)';
      btn.style.color = r===n ? '#000' : 'var(--text-primary)';
    }
  });
}

function updateChronoTimer() {
  const table = document.getElementById('chrono-table')?.value || 'other';
  const cat = currentCat;
  const limit = getTimerLimit(cat, table);
  const infoEl = document.getElementById('chrono-timer-info');
  if(infoEl) infoEl.textContent = limit + ' secondes';
}

function startChronoSession() {
  const exSelect = document.getElementById('chrono-exercise');
  const exId = exSelect?.value;
  const exName = exSelect?.options[exSelect.selectedIndex]?.text;
  const exType = exSelect?.options[exSelect.selectedIndex]?.dataset.type || 'passes';
  const table = document.getElementById('chrono-table')?.value || 'other';
  const totalReps = window._chronoReps || 20;
  const timerLimit = getTimerLimit(currentCat, table);

  chronoState = {
    active: true,
    exerciseId: exId,
    exerciseName: exName,
    exerciseType: exType,
    cat: currentCat,
    table,
    totalReps,
    currentRep: 0,
    results: [],
    timerLimit,
    timerStart: null,
    timerInterval: null,
    waiting: true
  };

  document.getElementById('chronoSetup').style.display = 'none';
  renderChronoSession();
}

function renderChronoSession() {
  const s = chronoState;
  const sessionEl = document.getElementById('chronoSession');
  sessionEl.style.display = 'block';

  const resultDots = Array(s.totalReps).fill(null).map((_, i) => {
    if(i >= s.results.length) return `<div style="width:12px;height:12px;border-radius:50%;background:var(--border);display:inline-block;margin:2px;"></div>`;
    const r = s.results[i];
    const color = r.success ? (r.penalty ? '#FF9500' : 'var(--green)') : 'var(--red)';
    return `<div style="width:12px;height:12px;border-radius:50%;background:${color};display:inline-block;margin:2px;" title="${r.success?'✓':'✗'}${r.penalty?' (pénalité)':''}"></div>`;
  }).join('');

  const successCount = s.results.filter(r=>r.success).length;
  const pct = s.results.length > 0 ? Math.round(successCount/s.results.length*100) : 0;

  sessionEl.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px;">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">⏱️ Mode Chrono</div>
          <div style="font-size:18px;font-weight:900;color:var(--text-primary);">${s.exerciseName}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:28px;font-weight:900;color:var(--gold);">${s.currentRep}/${s.totalReps}</div>
          <div style="font-size:13px;color:var(--text-muted);">${successCount} réussites · ${pct}%</div>
        </div>
      </div>

      <!-- Result dots -->
      <div style="text-align:center;margin-bottom:16px;padding:8px;background:var(--bg-surface);border-radius:6px;">
        ${resultDots}
      </div>

      <!-- Timer display -->
      <div id="chrono-display" style="text-align:center;margin-bottom:16px;">
        ${s.waiting && s.currentRep === 0 ? `
          <div style="font-size:14px;color:var(--text-secondary);margin-bottom:12px;">Place ta balle et prépare-toi</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Tu as <strong style="color:var(--gold);">${s.timerLimit} secondes</strong> par tentative</div>
          <button type="button" onclick="chronoReady()" style="width:100%;padding:18px;background:var(--green);border:none;color:#000;font-size:22px;font-weight:900;letter-spacing:2px;text-transform:uppercase;border-radius:8px;cursor:pointer;">
            ✋ PRÊT !
          </button>
        ` : s.waiting ? `
          <div style="font-size:14px;color:var(--text-secondary);margin-bottom:12px;">Replace la balle et prépare la tentative ${s.currentRep+1}</div>
          <button type="button" onclick="chronoReady()" style="width:100%;padding:18px;background:var(--green);border:none;color:#000;font-size:22px;font-weight:900;letter-spacing:2px;text-transform:uppercase;border-radius:8px;cursor:pointer;">
            ✋ PRÊT !
          </button>
        ` : `
          <div style="background:var(--bg-surface);border-radius:8px;padding:16px;margin-bottom:12px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;letter-spacing:2px;text-transform:uppercase;">TEMPS RESTANT</div>
            <div id="chrono-timer-val" style="font-size:64px;font-weight:900;color:var(--gold);line-height:1;">${s.timerLimit}</div>
            <div style="height:6px;background:var(--border);border-radius:3px;margin-top:8px;overflow:hidden;">
              <div id="chrono-timer-bar" style="height:100%;background:var(--green);border-radius:3px;width:100%;transition:width 0.1s;"></div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button type="button" onclick="chronoRecord(true)" style="padding:20px;background:rgba(0,230,118,0.1);border:2px solid var(--green);border-radius:8px;color:var(--green);font-size:24px;font-weight:900;cursor:pointer;">✓ Réussi</button>
            <button type="button" onclick="chronoRecord(false)" style="padding:20px;background:rgba(255,59,48,0.1);border:2px solid var(--red);border-radius:8px;color:var(--red);font-size:24px;font-weight:900;cursor:pointer;">✗ Raté</button>
          </div>
        `}
      </div>

      <!-- Stop button -->
      <button type="button" onclick="stopChronoSession()" style="width:100%;padding:10px;background:transparent;border:1px solid var(--border-bright);color:var(--text-muted);font-size:13px;font-weight:700;text-transform:uppercase;border-radius:4px;cursor:pointer;margin-top:8px;">
        Arrêter la session
      </button>
    </div>`;
}

function chronoReady() {
  chronoState.waiting = false;
  chronoState.timerStart = Date.now();

  // Start countdown
  let elapsed = 0;
  chronoState.timerInterval = setInterval(() => {
    elapsed = (Date.now() - chronoState.timerStart) / 1000;
    const remaining = Math.max(0, chronoState.timerLimit - elapsed);
    const pct = (remaining / chronoState.timerLimit) * 100;

    const timerVal = document.getElementById('chrono-timer-val');
    const timerBar = document.getElementById('chrono-timer-bar');
    if(timerVal) timerVal.textContent = Math.ceil(remaining);
    if(timerBar) {
      timerBar.style.width = pct + '%';
      timerBar.style.background = remaining > chronoState.timerLimit*0.5 ? 'var(--green)' : remaining > chronoState.timerLimit*0.25 ? '#FF9500' : 'var(--red)';
    }
    if(timerVal) timerVal.style.color = remaining > chronoState.timerLimit*0.5 ? 'var(--gold)' : remaining > chronoState.timerLimit*0.25 ? '#FF9500' : 'var(--red)';

    if(remaining <= 0) {
      clearInterval(chronoState.timerInterval);
      // Temps dépassé - vibrer si possible
      if(navigator.vibrate) navigator.vibrate([100,50,100]);
    }
  }, 100);

  renderChronoSession();
}

function chronoRecord(success) {
  clearInterval(chronoState.timerInterval);

  const elapsed = chronoState.timerStart ? (Date.now() - chronoState.timerStart) / 1000 : 0;
  const penalty = elapsed > chronoState.timerLimit;

  // Score avec pénalité si dépassement
  const effectiveSuccess = success && !penalty ? true : success && penalty ? 'penalty' : false;

  chronoState.results.push({
    success: success,
    penalty: penalty,
    time: Math.round(elapsed * 10) / 10,
    rep: chronoState.currentRep + 1
  });

  chronoState.currentRep++;
  chronoState.waiting = true;
  chronoState.timerStart = null;

  if(chronoState.currentRep >= chronoState.totalReps) {
    finishChronoSession();
  } else {
    renderChronoSession();
  }
}

function finishChronoSession() {
  const s = chronoState;
  clearInterval(s.timerInterval);

  // Calculate stats
  const total = s.results.length;
  const successes = s.results.filter(r=>r.success && !r.penalty).length;
  const successesPenalty = s.results.filter(r=>r.success && r.penalty).length;
  const fails = s.results.filter(r=>!r.success).length;
  const pct = Math.round(successes/total*100);
  const avgTime = Math.round(s.results.reduce((a,r)=>a+r.time,0)/total*10)/10;

  // Constance score
  const first5 = s.results.slice(0,5).filter(r=>r.success).length;
  const last5  = s.results.slice(-5).filter(r=>r.success).length;
  const mid    = s.results.slice(5,-5).filter(r=>r.success).length;
  const midTotal = Math.max(1, total - 10);
  const constanceBonus = last5 >= first5 ? 3 : last5 < first5 - 2 ? -5 : 0;
  const regularityBonus = Math.abs(last5 - first5) <= 1 ? 5 : 0;
  const adjustedPct = Math.min(100, Math.max(0, pct + constanceBonus + regularityBonus));

  // Heat map
  const heatmap = s.results.map(r => {
    const color = !r.success ? 'var(--red)' : r.penalty ? '#FF9500' : 'var(--green)';
    return `<div style="width:14px;height:14px;border-radius:3px;background:${color};display:inline-block;margin:2px;" title="T${r.rep}: ${r.success?'✓':'✗'} (${r.time}s)"></div>`;
  }).join('');

  // Save to trainStats
  const ts = DB.get('trainStats') || {};
  const prev = ts[s.exerciseId] || { tried:0, ok:0, type:s.exerciseType };
  ts[s.exerciseId] = { tried:prev.tried+total, ok:prev.ok+successes+successesPenalty, type:s.exerciseType };
  DB.set('trainStats', ts);

  // XP
  const xpGain = Math.max(10, Math.round(total*0.5) + (pct>=70?15:0) + regularityBonus*2);
  addXP(xpGain, 'Chrono · '+s.exerciseName+' · '+pct+'%');
  DB.push('history', {type:'training',ts:Date.now(),exerciseId:s.exerciseId,tried:total,ok:successes,xp:xpGain,chrono:true,avgTime});

  // Save chrono history for comparison
  const chronoHist = DB.get('chronoHistory') || [];
  chronoHist.push({ exerciseId:s.exerciseId, name:s.exerciseName, date:Date.now(), pct, adjustedPct, avgTime, results:s.results });
  if(chronoHist.length > 50) chronoHist.shift();
  DB.set('chronoHistory', chronoHist);

  // Previous best for comparison
  const prevSessions = chronoHist.slice(0,-1).filter(h=>h.exerciseId===s.exerciseId);
  const prevBest = prevSessions.length > 0 ? Math.max(...prevSessions.map(h=>h.pct)) : null;
  const prevAvg  = prevSessions.length > 0 ? Math.round(prevSessions.reduce((a,h)=>a+h.avgTime,0)/prevSessions.length*10)/10 : null;

  const sessionEl = document.getElementById('chronoSession');
  sessionEl.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--gold-dim);border-radius:8px;padding:16px;margin-bottom:12px;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Session terminée</div>
        <div style="font-size:22px;font-weight:900;color:var(--text-primary);">${s.exerciseName}</div>
        <div style="font-size:48px;font-weight:900;color:${pct>=70?'var(--green)':pct>=40?'#FF9500':'var(--red)'};">${pct}%</div>
        ${constanceBonus !== 0 || regularityBonus !== 0 ? `<div style="font-size:12px;color:var(--cyan);margin-top:4px;">Score ajusté : ${adjustedPct}% (constance ${constanceBonus>=0?'+':''}${constanceBonus}% ${regularityBonus>0?'régularité +'+regularityBonus+'%':''})</div>` : ''}
      </div>

      <!-- Stats grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">
        <div class="stats-pill"><div class="stats-pill-val" style="color:var(--green);">${successes}</div><div class="stats-pill-lbl">Réussites</div></div>
        <div class="stats-pill"><div class="stats-pill-val" style="color:#FF9500;">${successesPenalty}</div><div class="stats-pill-lbl">Pénalités</div></div>
        <div class="stats-pill"><div class="stats-pill-val" style="color:var(--red);">${fails}</div><div class="stats-pill-lbl">Ratés</div></div>
      </div>

      <!-- Timing -->
      <div style="background:var(--bg-surface);border-radius:6px;padding:10px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <span style="color:var(--text-secondary);">Temps moyen</span>
          <span style="color:var(--gold);font-weight:700;">${avgTime}s</span>
        </div>
        ${prevAvg ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;">
          <span style="color:var(--text-muted);">Session précédente</span>
          <span style="color:${avgTime<prevAvg?'var(--green)':'var(--red)'};font-weight:700;">${prevAvg}s ${avgTime<prevAvg?'↓ plus rapide':'↑ plus lent'}</span>
        </div>` : ''}
        ${prevBest !== null ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;">
          <span style="color:var(--text-muted);">Meilleur % précédent</span>
          <span style="color:${pct>=prevBest?'var(--green)':'var(--text-muted)'};font-weight:700;">${prevBest}% ${pct>=prevBest?'🏆 Nouveau record !':''}</span>
        </div>` : ''}
      </div>

      <!-- Constance analysis -->
      <div style="background:var(--bg-surface);border-radius:6px;padding:10px;margin-bottom:12px;">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Analyse constance</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
          <span style="color:var(--text-secondary);">5 premières (chauffe)</span>
          <span style="color:var(--gold);">${first5}/5</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
          <span style="color:var(--text-secondary);">Milieu de série</span>
          <span style="color:var(--gold);">${mid}/${midTotal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <span style="color:var(--text-secondary);">5 dernières (niveau réel)</span>
          <span style="color:${last5>=first5?'var(--green)':'var(--red)'}">${last5}/5 ${last5>=first5?'✓':last5<first5-2?'⚠️ chute':''}</span>
        </div>
      </div>

      <!-- Heatmap -->
      <div style="background:var(--bg-surface);border-radius:6px;padding:10px;margin-bottom:16px;">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Carte des tentatives</div>
        <div style="text-align:center;">${heatmap}</div>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:6px;font-size:10px;color:var(--text-muted);">
          <span>🟢 Réussi</span><span>🟠 Réussi+pénalité</span><span>🔴 Raté</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button type="button" onclick="showChronoSetup(currentCat)" style="padding:12px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:700;text-transform:uppercase;border-radius:6px;cursor:pointer;">🔄 Refaire</button>
        <button type="button" onclick="renderTraining(currentCat)" style="padding:12px;background:transparent;border:1px solid var(--border-bright);color:var(--text-secondary);font-size:14px;font-weight:700;text-transform:uppercase;border-radius:6px;cursor:pointer;">← Retour</button>
      </div>
    </div>`;

  autoCheckObjectives();
  checkBadges();
  updateCoach();
  renderDashboard();
}

function stopChronoSession() {
  clearInterval(chronoState.timerInterval);
  chronoState.active = false;
  renderTraining(currentCat);
}

function updatePct(id, type) {
  const tried = parseInt(document.getElementById('tried-'+id)?.value)||0;
  const ok    = parseInt(document.getElementById('ok-'+id)?.value)||0;
  const pct = tried>0 ? Math.round(ok/tried*100) : null;
  const pEl = document.getElementById('pct-'+id);
  const bEl = document.getElementById('bar-'+id);
  if(pEl){ pEl.textContent=pct===null?'—':pct+'%'; pEl.className='exercise-pct'+(pct===null?'':pct>=70?' good':pct>=40?' mid':' low'); }
  if(bEl) bEl.style.width=(pct||0)+'%';
}

function saveExercise(id, type) {
  const tried = parseInt(document.getElementById('tried-'+id)?.value)||0;
  const ok    = parseInt(document.getElementById('ok-'+id)?.value)||0;
  if(!tried) return;
  const ts = DB.get('trainStats')||{};
  const prev = ts[id]||{tried:0,ok:0,type};
  ts[id] = { tried:prev.tried+tried, ok:prev.ok+ok, type };
  DB.set('trainStats',ts);
  document.getElementById('tried-'+id).value='';
  document.getElementById('ok-'+id).value='';
  updatePct(id,type);
  const xpGain = Math.max(5, Math.round(tried*0.5)+(ok>=tried*0.7?10:0));
  addXP(xpGain, 'Entraînement · '+tried+' rép.');
  DB.push('history',{type:'training',ts:Date.now(),exerciseId:id,tried,ok,xp:xpGain});
  if(tried>0) updateLeagueFromTraining(Math.round(ok/tried*100));
  renderDashboard(); checkBadges(); autoCheckObjectives(); updateCoach();
}

function openAddExercise(cat) {
  pendingExCat = cat;
  document.getElementById('newExName').value='';
  document.getElementById('addExModal').classList.add('open');
}

function confirmAddExercise() {
  const name = document.getElementById('newExName').value.trim();
  const type = document.getElementById('newExType').value;
  if(!name) return;
  const exercises = DB.get('exercises')||DEFAULT_EXERCISES;
  const id = 'custom_'+Date.now();
  exercises[pendingExCat] = exercises[pendingExCat]||[];
  exercises[pendingExCat].push({id,name,type});
  DB.set('exercises',exercises);
  closeModal('addExModal');
  renderTraining(pendingExCat);
}

// ══════════════════════════════════════════
// MATCH
// ══════════════════════════════════════════
let matchRole = 'att';
let matchCounts = {};

const matchFields = {
  att:[
    {key:'passTried',  label:'Passes tentées'},
    {key:'passOk',     label:'Passes réussies'},
    {key:'shotTried',  label:'Tirs tentés'},
    {key:'goals',      label:'Buts marqués'},
    {key:'recovered',  label:'Balles récupérées'},
  ],
  def:[
    {key:'saves',        label:'Arrêts'},
    {key:'passTried',    label:'Passes tentées'},
    {key:'passOk',       label:'Passes réussies'},
    {key:'lostRelance',  label:'Relances perdues'},
    {key:'goalsConceded',label:'Buts encaissés'},
  ]
};

function selectRole(role) {
  matchRole = role;
  document.getElementById('role-att').classList.toggle('selected',role==='att');
  document.getElementById('role-def').classList.toggle('selected',role==='def');
  const entryBtn = document.getElementById('matchDetailedEntry');
  if(entryBtn) entryBtn.style.display = (role==='att') ? 'block' : 'none';
  renderMatch(role);
}

let matchDetailsOpen = false;
let matchSelectedResult = null;

function toggleMatchDetails() {
  matchDetailsOpen = !matchDetailsOpen;
  document.getElementById('matchDetailsPanel').style.display = matchDetailsOpen ? 'block' : 'none';
  document.getElementById('matchDetailsArrow').textContent = matchDetailsOpen ? '▴' : '▾';
  if(matchDetailsOpen) fillOpponentSuggestions();
}

function fillOpponentSuggestions() {
  const list = document.getElementById('matchOpponentSuggestions');
  const known = DB.get('knownOpponents') || [];
  list.innerHTML = known.map(name => `<option value="${name}"></option>`).join('');
}

function selectMatchResult(result) {
  matchSelectedResult = (matchSelectedResult === result) ? null : result;
  document.getElementById('matchResultWin').classList.toggle('selected', matchSelectedResult==='victoire');
  document.getElementById('matchResultLoss').classList.toggle('selected', matchSelectedResult==='defaite');
}

function renderMatch(role) {
  matchCounts = {};
  matchFields[role].forEach(f=>matchCounts[f.key]=0);
  document.getElementById('matchForm').innerHTML = matchFields[role].map(f=>`
    <div class="match-stat-input">
      <div class="msi-label">${f.label}</div>
      <div class="msi-controls">
        <div class="msi-btn" onclick="matchAdj('${f.key}',-1)">−</div>
        <div class="msi-val" id="msi-${f.key}">0</div>
        <div class="msi-btn" onclick="matchAdj('${f.key}',1)">+</div>
      </div>
    </div>`).join('');
}

function matchAdj(key, delta) {
  matchCounts[key] = Math.max(0,(matchCounts[key]||0)+delta);
  document.getElementById('msi-'+key).textContent = matchCounts[key];
}

function saveMatch() {
  const xpGain = 30+(matchRole==='att'?(matchCounts.goals||0)*5:(matchCounts.saves||0)*3);
  addXP(xpGain,'Match · '+(matchRole==='att'?'Attaquant':'Défenseur'));
  const ms = DB.get('matchStats')||{att:{},def:{}};
  Object.entries(matchCounts).forEach(([k,v])=>{ ms[matchRole][k]=(ms[matchRole][k]||0)+v; });
  DB.set('matchStats',ms);

  // Détails optionnels — n'empêchent jamais la saisie rapide, purement additifs
  const opponentName = (document.getElementById('matchOpponentInput')?.value || '').trim();
  const guardType = document.getElementById('matchGuardType')?.value || '';
  const hasDetails = opponentName || guardType || matchSelectedResult;

  if(hasDetails) {
    const matchHistory = DB.get('matchHistory') || [];
    matchHistory.push({
      ts: Date.now(),
      role: matchRole,
      opponent: opponentName || null,
      guardType: guardType || null,
      result: matchSelectedResult,
      counts: {...matchCounts}
    });
    DB.set('matchHistory', matchHistory);

    if(opponentName) {
      const known = DB.get('knownOpponents') || [];
      if(!known.includes(opponentName)) { known.push(opponentName); DB.set('knownOpponents', known); }
    }
  }

  DB.push('history',{type:'match',ts:Date.now(),role:matchRole,counts:{...matchCounts},xp:xpGain});
  renderMatch(matchRole);

  // Reset des champs optionnels pour le prochain match
  if(document.getElementById('matchOpponentInput')) document.getElementById('matchOpponentInput').value = '';
  if(document.getElementById('matchGuardType')) document.getElementById('matchGuardType').value = '';
  matchSelectedResult = null;
  document.getElementById('matchResultWin')?.classList.remove('selected');
  document.getElementById('matchResultLoss')?.classList.remove('selected');
  matchDetailsOpen = false;
  if(document.getElementById('matchDetailsPanel')) document.getElementById('matchDetailsPanel').style.display = 'none';
  if(document.getElementById('matchDetailsArrow')) document.getElementById('matchDetailsArrow').textContent = '▾';

  renderDashboard(); checkBadges(); autoCheckObjectives(); updateCoach();
  navTo('dash');
}

// ══════════════════════════════════════════
// ADVERSAIRES (SCOUTING) — basé sur matchHistory saisi manuellement
// ══════════════════════════════════════════

function renderOpponents() {
  const el = document.getElementById('opponentsContent');
  if(!el) return;
  const matchHistory = DB.get('matchHistory') || [];
  const notes = DB.get('opponentNotes') || {};

  const named = matchHistory.filter(m => m.opponent);
  const byOpponent = {};
  named.forEach(m => {
    if(!byOpponent[m.opponent]) byOpponent[m.opponent] = [];
    byOpponent[m.opponent].push(m);
  });

  const names = Object.keys(byOpponent).sort();

  if(names.length === 0) {
    el.innerHTML = `
      <div class="section-title" style="margin-bottom:4px">Adversaires</div>
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">Aucun adversaire enregistré</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">Renseigne le nom de l'adversaire dans les détails optionnels d'un match pour commencer le suivi.</div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="section-title" style="margin-bottom:4px">Adversaires</div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">${names.length} adversaire(s) suivi(s)</div>
    ${names.map(name => {
      const matches = byOpponent[name];
      const wins = matches.filter(m => m.result === 'victoire').length;
      const losses = matches.filter(m => m.result === 'defaite').length;
      const guardCounts = {};
      matches.forEach(m => { if(m.guardType) guardCounts[m.guardType] = (guardCounts[m.guardType]||0)+1; });
      const mainGuard = Object.entries(guardCounts).sort((a,b)=>b[1]-a[1])[0];
      const guardLabels = {normale:'Normale',inversee:'Inversée',switch:'Switch constant',piege_timing:'Piège timing',reflexe:'Réflexe pur',hybride:'Hybride'};

      return `
      <div class="history-item" style="cursor:pointer;flex-direction:column;align-items:stretch;" onclick="toggleOpponentDetail('${name.replace(/'/g,"\\'")}')">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--text-primary);">${name}</div>
            <div style="font-size:11px;color:var(--text-muted);">${matches.length} match(s)${mainGuard ? ' · Garde habituelle : '+(guardLabels[mainGuard[0]]||mainGuard[0]) : ''}</div>
          </div>
          <div style="text-align:right;">
            <span style="color:var(--green);font-weight:700;">${wins}V</span> <span style="color:var(--text-muted);">-</span> <span style="color:var(--red);font-weight:700;">${losses}D</span>
          </div>
        </div>
        <div id="opp-detail-${name.replace(/[^a-zA-Z0-9]/g,'_')}" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <div class="section-title" style="font-size:11px;">Tendances observées</div>
          <textarea id="opp-notes-${name.replace(/[^a-zA-Z0-9]/g,'_')}" placeholder="Ex: ferme la tirer croisée après 3 buts, passe en garde inversée quand mené..." style="width:100%;min-height:70px;padding:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:13px;margin-bottom:8px;" onclick="event.stopPropagation()">${notes[name]||''}</textarea>
          <button type="button" onclick="event.stopPropagation();saveOpponentNotes('${name.replace(/'/g,"\\'")}')" style="width:100%;padding:9px;background:var(--gold-dim);border:none;border-radius:6px;color:var(--bg-primary);font-weight:700;font-size:13px;cursor:pointer;">💾 Sauvegarder les notes</button>
        </div>
      </div>`;
    }).join('')}
  `;
}

function toggleOpponentDetail(name) {
  const id = 'opp-detail-'+name.replace(/[^a-zA-Z0-9]/g,'_');
  const elDetail = document.getElementById(id);
  if(elDetail) elDetail.style.display = elDetail.style.display==='none' ? 'block' : 'none';
}

function saveOpponentNotes(name) {
  const id = 'opp-notes-'+name.replace(/[^a-zA-Z0-9]/g,'_');
  const textarea = document.getElementById(id);
  if(!textarea) return;
  const notes = DB.get('opponentNotes') || {};
  notes[name] = textarea.value;
  DB.set('opponentNotes', notes);
  showToast('📝 Notes sauvegardées','#1A3A1A');
}

// ══════════════════════════════════════════
// MATCH DÉTAILLÉ (Attaquant uniquement) — tir par tir avec garde adverse
// 3 taps par tir : type de tir → garde adverse → résultat
// ══════════════════════════════════════════

const GUARD_TYPES = [
  {id:'normale',label:'Normale'},
  {id:'inversee',label:'Inversée'},
  {id:'switch',label:'Switch'},
  {id:'piege_timing',label:'Piège timing'},
  {id:'reflexe',label:'Réflexe pur'},
  {id:'hybride',label:'Hybride'},
];

let mdEvents = [];      // tirs loggés pour cette session en cours
let mdStep = 'shot';    // 'shot' | 'guard' | 'result'
let mdPendingShot = null;
let mdPendingGuard = null;

function initMatchDetail() {
  mdEvents = [];
  mdStep = 'shot';
  mdPendingShot = null;
  mdPendingGuard = null;
  renderMatchDetail();
}

function renderMatchDetail() {
  const el = document.getElementById('matchDetailContent');
  if(!el) return;

  const shotOptions = DEFAULT_EXERCISES.attack;

  let stepHTML = '';
  if(mdStep === 'shot') {
    stepHTML = `
      <div class="section-title" style="font-size:12px;">1/3 — Quel tir ?</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        ${shotOptions.map(s => `<button type="button" onclick="mdSelectShot('${s.name.replace(/'/g,"\\'")}')" style="padding:14px 8px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;font-weight:700;cursor:pointer;">${s.name}</button>`).join('')}
      </div>`;
  } else if(mdStep === 'guard') {
    stepHTML = `
      <div class="section-title" style="font-size:12px;">2/3 — Garde adverse sur ce tir</div>
      <div style="font-size:13px;color:var(--gold);margin-bottom:10px;">Tir : <strong>${mdPendingShot}</strong></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${GUARD_TYPES.map(g => `<button type="button" onclick="mdSelectGuard('${g.id}')" style="padding:14px 8px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;font-weight:700;cursor:pointer;">${g.label}</button>`).join('')}
      </div>
      <button type="button" onclick="mdBackToShot()" style="margin-top:10px;width:100%;padding:9px;background:transparent;border:none;color:var(--text-muted);font-size:12px;cursor:pointer;">← Changer le tir</button>`;
  } else if(mdStep === 'result') {
    const guardLabel = GUARD_TYPES.find(g=>g.id===mdPendingGuard)?.label || mdPendingGuard;
    stepHTML = `
      <div class="section-title" style="font-size:12px;">3/3 — Résultat</div>
      <div style="font-size:13px;color:var(--gold);margin-bottom:10px;">${mdPendingShot} · contre garde ${guardLabel}</div>
      <div style="display:flex;gap:10px;">
        <button type="button" onclick="mdRecordResult(true)" style="flex:1;padding:22px;background:rgba(0,230,118,0.1);border:2px solid var(--green);border-radius:8px;color:var(--green);font-size:24px;font-weight:900;cursor:pointer;">✓ But</button>
        <button type="button" onclick="mdRecordResult(false)" style="flex:1;padding:22px;background:rgba(255,59,48,0.1);border:2px solid var(--red);border-radius:8px;color:var(--red);font-size:24px;font-weight:900;cursor:pointer;">✗ Raté</button>
      </div>`;
  }

  const logHTML = mdEvents.length === 0 ? '' : `
    <div class="section-title" style="font-size:11px;margin-top:20px;">Tirs loggés (${mdEvents.length})</div>
    <div style="max-height:180px;overflow-y:auto;margin-top:6px;">
      ${mdEvents.slice().reverse().map(e => `
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--bg-card);border-radius:6px;margin-bottom:4px;font-size:12px;">
          <span style="color:var(--text-secondary);">${e.shot} <span style="color:var(--text-muted);">vs ${GUARD_TYPES.find(g=>g.id===e.guardType)?.label||e.guardType}</span></span>
          <span style="color:${e.success?'var(--green)':'var(--red)'};font-weight:700;">${e.success?'✓ But':'✗ Raté'}</span>
        </div>`).join('')}
    </div>`;

  el.innerHTML = `
    <div class="section-title" style="margin-bottom:4px">Match détaillé — Attaquant</div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">Tir par tir, avec garde adverse associée.</div>
    ${stepHTML}
    ${logHTML}
    <button type="button" onclick="finishMatchDetail()" ${mdEvents.length===0?'disabled':''} style="width:100%;margin-top:20px;padding:13px;background:var(--gold-dim);border:none;border-radius:6px;color:var(--bg-primary);font-weight:700;font-size:14px;cursor:pointer;${mdEvents.length===0?'opacity:0.4;':''}">🏁 Terminer le match (${mdEvents.length} tirs)</button>
    <button type="button" onclick="navTo('match')" style="width:100%;margin-top:8px;padding:11px;background:transparent;border:1px solid var(--border-bright);color:var(--text-secondary);font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;">Annuler et revenir au mode rapide</button>
  `;
}

function mdSelectShot(shotName) {
  mdPendingShot = shotName;
  mdStep = 'guard';
  renderMatchDetail();
}

function mdSelectGuard(guardId) {
  mdPendingGuard = guardId;
  mdStep = 'result';
  renderMatchDetail();
}

function mdBackToShot() {
  mdStep = 'shot';
  mdPendingGuard = null;
  renderMatchDetail();
}

function mdRecordResult(success) {
  mdEvents.push({
    ts: Date.now(),
    shot: mdPendingShot,
    guardType: mdPendingGuard,
    success: success
  });
  mdPendingShot = null;
  mdPendingGuard = null;
  mdStep = 'shot';
  renderMatchDetail();
}

function finishMatchDetail() {
  if(mdEvents.length === 0) { navTo('match'); return; }

  const allEvents = DB.get('matchDetailEvents') || [];
  const sessionId = Date.now();
  mdEvents.forEach(e => allEvents.push({...e, sessionId}));
  DB.set('matchDetailEvents', allEvents);

  // Reflète aussi dans matchStats (buts/tirs) pour rester cohérent avec le reste de l'app
  const ms = DB.get('matchStats') || {att:{},def:{}};
  ms.att.shotTried = (ms.att.shotTried||0) + mdEvents.length;
  ms.att.goals = (ms.att.goals||0) + mdEvents.filter(e=>e.success).length;
  DB.set('matchStats', ms);

  const xpGain = 30 + mdEvents.filter(e=>e.success).length*5;
  addXP(xpGain, 'Match détaillé · '+mdEvents.length+' tirs');
  DB.push('history',{type:'match',ts:Date.now(),role:'att',counts:{shotTried:mdEvents.length,goals:mdEvents.filter(e=>e.success).length},xp:xpGain});

  showToast('🏁 Match détaillé enregistré : '+mdEvents.length+' tirs','#1A3A1A');
  renderDashboard(); checkBadges(); autoCheckObjectives(); updateCoach();
  navTo('dash');
}
