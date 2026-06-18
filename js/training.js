// ══════════════════════════════════════════
// TRAINING
// ══════════════════════════════════════════
let currentCat = 'passes';
let pendingExCat = 'passes';

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
  let html = '<div class="exercise-list">';
  list.forEach(ex=>{
    const s = ts[ex.id]||{tried:0,ok:0};
    const pct = s.tried>0 ? Math.round(s.ok/s.tried*100) : null;
    const pc = pct===null?'':pct>=70?' good':pct>=40?' mid':' low';
    const [l1,l2] = labels[ex.type]||['Tentatives','Réussites'];
    html += `
    <div class="exercise-card">
      <div class="exercise-header">
        <div class="exercise-name">${ex.name}</div>
        <div class="exercise-pct${pc}" id="pct-${ex.id}">${pct===null?'—':pct+'%'}</div>
      </div>
      <div class="exercise-inputs">
        <div class="ex-input-wrap"><label>${l1}</label>
          <input type="number" id="tried-${ex.id}" placeholder="0" min="0" oninput="updatePct('${ex.id}','${ex.type}')">
        </div>
        <div class="ex-input-wrap"><label>${l2}</label>
          <input type="number" id="ok-${ex.id}" placeholder="0" min="0" oninput="updatePct('${ex.id}','${ex.type}')">
        </div>
      </div>
      <div class="ex-bar"><div class="ex-bar-fill" id="bar-${ex.id}" style="width:${pct||0}%"></div></div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">Total : ${s.tried} essais · ${s.ok} réussites</div>
      <button type="button" class="ex-save-btn" onclick="saveExercise('${ex.id}','${ex.type}')">Enregistrer +XP</button>
    </div>`;
  });
  html += '</div>';
  html += `<button type="button" class="add-exercise-btn" onclick="openAddExercise('${cat}')">+ Ajouter un exercice</button>`;
  document.getElementById('trainingContent').innerHTML = html;
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
  renderDashboard();
  checkBadges();
  autoCheckObjectives();
  updateCoach();
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
    {key:'saves',      label:'Arrêts'},
    {key:'passTried',  label:'Passes tentées'},
    {key:'passOk',     label:'Passes réussies'},
    {key:'lostRelance',label:'Relances perdues'},
    {key:'goalsConceded',label:'Buts encaissés'},
  ]
};

function selectRole(role) {
  matchRole = role;
  document.getElementById('role-att').classList.toggle('selected',role==='att');
  document.getElementById('role-def').classList.toggle('selected',role==='def');
  renderMatch(role);
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
  DB.push('history',{type:'match',ts:Date.now(),role:matchRole,counts:{...matchCounts},xp:xpGain});
  renderMatch(matchRole);
  renderDashboard();
  checkBadges();
  autoCheckObjectives();
  updateCoach();
  navTo('dash');
}
