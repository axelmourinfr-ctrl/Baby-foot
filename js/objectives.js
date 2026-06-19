// ══════════════════════════════════════════
// MISSIONS ROTATIVES
// ══════════════════════════════════════════
const MISSION_BANK = {
  daily: [
    { id:'d_pass50',    title:'Réussir 50 passes',           type:'passOk',      target:50,  xp:20 },
    { id:'d_pass100',   title:'Réussir 100 passes',          type:'passOk',      target:100, xp:35 },
    { id:'d_goals10',   title:'Marquer 10 buts',             type:'goalOk',      target:10,  xp:25 },
    { id:'d_goals20',   title:'Marquer 20 buts',             type:'goalOk',      target:20,  xp:40 },
    { id:'d_tries50',   title:'Faire 50 tentatives de tir',  type:'goalTried',   target:50,  xp:20 },
    { id:'d_session1',  title:'Faire 1 session',             type:'sessionsDay', target:1,   xp:15 },
    { id:'d_session2',  title:'Faire 2 sessions',            type:'sessionsDay', target:2,   xp:30 },
    { id:'d_match1',    title:'Jouer 1 match',               type:'matchesDay',  target:1,   xp:15 },
    { id:'d_match2',    title:'Jouer 2 matchs',              type:'matchesDay',  target:2,   xp:25 },
    { id:'d_saves10',   title:'Réaliser 10 arrêts',          type:'saveOk',      target:10,  xp:20 },
    { id:'d_bande30',   title:'30 passes bande',             type:'passOk',      target:30,  xp:15 },
    { id:'d_croisee30', title:'30 passes croisées',          type:'passOk',      target:30,  xp:15 },
  ],
  weekly: [
    { id:'w_sessions5', title:"5 sessions d'entraînement",   type:'sessionsWeek',target:5,   xp:50 },
    { id:'w_sessions7', title:"7 sessions d'entraînement",   type:'sessionsWeek',target:7,   xp:80 },
    { id:'w_pass500',   title:'500 passes réussies',         type:'passOk',      target:500, xp:60 },
    { id:'w_goals50',   title:'50 buts marqués',             type:'goalOk',      target:50,  xp:55 },
    { id:'w_matches5',  title:'5 matchs joués',              type:'matchesWeek', target:5,   xp:50 },
    { id:'w_matches10', title:'10 matchs joués',             type:'matchesWeek', target:10,  xp:80 },
    { id:'w_saves50',   title:'50 arrêts réalisés',          type:'saveOk',      target:50,  xp:55 },
    { id:'w_tries200',  title:'200 tirs tentés',             type:'goalTried',   target:200, xp:45 },
    { id:'w_streak5',   title:'5 jours consécutifs',         type:'streak',      target:5,   xp:100 },
  ],
  monthly: [
    { id:'m_pass2000',  title:'2000 passes réussies',        type:'passOk',      target:2000,xp:150 },
    { id:'m_goals200',  title:'200 buts marqués',            type:'goalOk',      target:200, xp:120 },
    { id:'m_sessions20',title:"20 sessions d'entraînement",  type:'sessionsMonth',target:20, xp:100 },
    { id:'m_matches20', title:'20 matchs joués',             type:'matchesMonth',target:20,  xp:100 },
    { id:'m_saves200',  title:'200 arrêts réalisés',         type:'saveOk',      target:200, xp:120 },
    { id:'m_xp1000',    title:'Gagner 1000 XP',              type:'xpMonth',     target:1000,xp:80  },
    { id:'m_streak15',  title:'15 jours consécutifs',        type:'streak',      target:15,  xp:200 },
    { id:'m_video3',    title:'Analyser 3 vidéos',           type:'videoSessions',target:3,  xp:80  },
  ],
};

// Rotation periods in ms
const ROTATION = { daily:24*3600*1000, weekly:7*24*3600*1000, monthly:30*24*3600*1000 };
const MISSIONS_PER_PERIOD = { daily:3, weekly:3, monthly:3 };

function getMissions() {
  const now = Date.now();
  let missions = DB.get('missions') || {};
  let changed = false;

  ['daily','weekly','monthly'].forEach(period => {
    const last = missions[period+'_generated'] || 0;
    if (now - last > ROTATION[period]) {
      // Rotate — pick random missions
      const bank = MISSION_BANK[period];
      const shuffled = [...bank].sort(()=>Math.random()-0.5);
      missions[period] = shuffled.slice(0, MISSIONS_PER_PERIOD[period]).map(m => ({
        ...m, done:false, progress:0, period, generatedAt:now
      }));
      missions[period+'_generated'] = now;
      changed = true;
    }
  });

  // Custom missions persist
  if (!missions.custom) missions.custom = [];

  if (changed) DB.set('missions', missions);
  return missions;
}

function getCurrentStats() {
  const ts = DB.get('trainStats') || {};
  const ms = DB.get('matchStats') || {att:{},def:{}};
  const history = DB.get('history') || [];
  const now = Date.now();
  const todayStr = new Date().toDateString();
  const weekAgo = now - 7*24*3600*1000;
  const monthAgo = now - 30*24*3600*1000;
  const monthStart = now - ROTATION.monthly;

  let passOk=0, goalOk=0, goalTried=0, saveOk=0;
  Object.values(ts).forEach(ex => {
    if(ex.type==='passes'){ passOk+=ex.ok||0; }
    if(ex.type==='goals'){ goalOk+=ex.ok||0; goalTried+=ex.tried||0; }
    if(ex.type==='saves'){ saveOk+=ex.ok||0; }
  });
  passOk  += 0; // training only
  goalOk  += ms.att?.goals||0;
  saveOk  += ms.def?.saves||0;

  const sessionsDay   = history.filter(h=>h.type==='training'&&new Date(h.ts).toDateString()===todayStr).length;
  const matchesDay    = history.filter(h=>h.type==='match'&&new Date(h.ts).toDateString()===todayStr).length;
  const sessionsWeek  = history.filter(h=>h.type==='training'&&h.ts>weekAgo).length;
  const matchesWeek   = history.filter(h=>h.type==='match'&&h.ts>weekAgo).length;
  const sessionsMonth = history.filter(h=>h.type==='training'&&h.ts>monthAgo).length;
  const matchesMonth  = history.filter(h=>h.type==='match'&&h.ts>monthAgo).length;
  const videoSessions = history.filter(h=>h.type==='video'&&h.ts>monthAgo).length;
  const xpMonth       = history.filter(h=>h.ts>monthAgo).reduce((s,h)=>s+(h.xp||0),0);

  // Streak
  const trainDays = [...new Set(history.filter(h=>h.type==='training').map(h=>new Date(h.ts).toDateString()))];
  let streak = 0;
  const today = new Date();
  for(let i=0;i<60;i++){
    const d=new Date(today); d.setDate(d.getDate()-i);
    if(trainDays.includes(d.toDateString())) streak++; else if(streak>0) break;
  }

  return { passOk, goalOk, goalTried, saveOk, sessionsDay, matchesDay, sessionsWeek, matchesWeek, sessionsMonth, matchesMonth, videoSessions, xpMonth, streak };
}

function getStatForType(type, stats) {
  const map = {
    passOk: stats.passOk, goalOk: stats.goalOk, goalTried: stats.goalTried,
    saveOk: stats.saveOk, sessionsDay: stats.sessionsDay, matchesDay: stats.matchesDay,
    sessionsWeek: stats.sessionsWeek, matchesWeek: stats.matchesWeek,
    sessionsMonth: stats.sessionsMonth, matchesMonth: stats.matchesMonth,
    videoSessions: stats.videoSessions, xpMonth: stats.xpMonth, streak: stats.streak,
  };
  return map[type] || 0;
}

function autoCheckMissions() {
  const missions = getMissions();
  const stats = getCurrentStats();
  let changed = false;

  ['daily','weekly','monthly','custom'].forEach(period => {
    (missions[period]||[]).forEach(m => {
      if (m.done) return;
      const val = getStatForType(m.type, stats);
      m.progress = Math.min(m.target, val);
      if (val >= m.target) {
        m.done = true; changed = true;
        setTimeout(()=>{
          showToast('🎯 Mission accomplie : '+m.title, '#0A2A0A');
          addXP(m.xp, 'Mission : '+m.title);
          checkMissionBadges();
        }, 400);
      }
    });
  });

  if (changed) DB.set('missions', missions);
  checkMissionBadges();
  if (document.getElementById('screen-objectives')?.classList.contains('active')) renderObjectives();
}

function checkMissionBadges() {
  const missions = DB.get('missions') || {};
  let total = 0;
  ['daily','weekly','monthly','custom'].forEach(p => {
    total += (missions[p]||[]).filter(m=>m.done).length;
  });
  total += DB.get('totalMissionsDone') || 0;

  const milestones = [
    {n:5,   id:'missions5',   label:'Discipliné',   icon:'📋'},
    {n:20,  id:'missions20',  label:'Régulier',      icon:'🔄'},
    {n:50,  id:'missions50',  label:'Acharné',       icon:'💪'},
    {n:100, id:'missions100', label:'Obsessionnel',  icon:'🔥'},
    {n:200, id:'missions200', label:'Légende Vivante',icon:'👑'},
  ];
  const unlocked = DB.get('badges') || {};
  milestones.forEach(m => {
    if (total >= m.n && !unlocked[m.id]) {
      unlocked[m.id] = true;
      DB.set('badges', unlocked);
      showToast('🏅 Badge : '+m.label, '#1A3A1A');
    }
  });
}

let currentObjTab = 'daily';

function switchObjTab(tab, el) {
  currentObjTab = tab;
  document.querySelectorAll('.obj-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderObjectives();
}

function renderObjectives() {
  const missions = getMissions();
  const stats = getCurrentStats();
  const list = missions[currentObjTab] || [];
  const el = document.getElementById('objList'); if(!el) return;

  // Time remaining
  const last = missions[currentObjTab+'_generated'] || Date.now();
  const rotation = ROTATION[currentObjTab] || 0;
  const remaining = rotation > 0 ? Math.max(0, Math.ceil((last + rotation - Date.now()) / 3600000)) : null;
  const timeLabel = remaining !== null ? (remaining > 24 ? Math.ceil(remaining/24)+'j' : remaining+'h') : null;

  // Mission badge progress
  let totalDone = 0;
  ['daily','weekly','monthly','custom'].forEach(p => { totalDone += (missions[p]||[]).filter(m=>m.done).length; });
  totalDone += DB.get('totalMissionsDone') || 0;
  const nextBadge = [5,20,50,100,200].find(n=>n>totalDone) || 200;

  let html = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
      <div style="font-size:24px;">🎯</div>
      <div style="flex:1;">
        <div style="font-size:11px;color:var(--text-secondary);font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Missions accomplies</div>
        <div style="font-size:20px;font-weight:900;color:var(--gold);">${totalDone} <span style="font-size:13px;color:var(--text-muted);">/ ${nextBadge} pour prochain badge</span></div>
        <div style="height:4px;background:var(--border);border-radius:2px;margin-top:6px;overflow:hidden;">
          <div style="height:100%;background:var(--gold);border-radius:2px;width:${Math.min(100,Math.round(totalDone/nextBadge*100))}%;transition:width 0.5s;"></div>
        </div>
      </div>
    </div>`;

  if (timeLabel && currentObjTab !== 'custom') {
    html += `<div style="font-size:11px;color:var(--text-muted);text-align:right;margin-bottom:8px;">🔄 Nouvelles missions dans ${timeLabel}</div>`;
  }

  if (!list.length) {
    html += `<div class="empty-state"><div class="empty-state-icon">🎯</div><div class="empty-state-text">Aucune mission</div></div>`;
  } else {
    list.forEach(m => {
      const val = getStatForType(m.type, stats);
      const prog = Math.min(m.target, val);
      const pct = Math.round(prog/m.target*100);
      html += `
      <div class="obj-item ${m.done?'done':''}">
        <div class="obj-check">${m.done?'✓':''}</div>
        <div class="obj-info">
          <div class="obj-title">${m.title}</div>
          <div style="margin-top:6px;">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:3px;">
              <span>${prog} / ${m.target}</span><span>${pct}%</span>
            </div>
            <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;">
              <div style="height:100%;background:${m.done?'var(--green)':'var(--gold)'};border-radius:2px;width:${pct}%;transition:width 0.4s;"></div>
            </div>
          </div>
          ${m.done?'<div style="font-size:10px;color:var(--green);margin-top:3px;">✅ Accompli automatiquement</div>':''}
        </div>
        <div class="obj-xp">+${m.xp} XP</div>
      </div>`;
    });
  }

  if (currentObjTab === 'custom') {
    html += `<button type="button" class="add-obj-btn" onclick="openAddObj()">+ Ajouter une mission perso</button>`;
  }

  el.innerHTML = html;
}

function openAddObj() {
  document.getElementById('newObjTitle').value='';
  document.getElementById('newObjXP').value='50';
  document.getElementById('addObjModal').classList.add('open');
}

function confirmAddObj() {
  const title = document.getElementById('newObjTitle').value.trim();
  const xp = parseInt(document.getElementById('newObjXP').value)||50;
  if(!title) return;
  const missions = getMissions();
  if(!missions.custom) missions.custom=[];
  missions.custom.push({id:'custom_'+Date.now(), title, type:'manual', target:1, xp, done:false, progress:0, period:'custom'});
  DB.set('missions', missions);
  closeModal('addObjModal');
  renderObjectives();
}

function toggleCustomMission(id) {
  const missions = DB.get('missions')||{};
  const m = (missions.custom||[]).find(x=>x.id===id);
  if(m && !m.done){ m.done=true; addXP(m.xp,'Mission perso accomplie'); DB.set('missions',missions); renderObjectives(); }
}

function deleteCustomMission(id) {
  const missions = DB.get('missions')||{};
  missions.custom = (missions.custom||[]).filter(x=>x.id!==id);
  DB.set('missions', missions);
  renderObjectives();
}

// ══════════════════════════════════════════
// CHARTS
// ══════════════════════════════════════════
function drawChart(canvasId, data, color) {
  const canvas = document.getElementById(canvasId); if(!canvas||data.length<2) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth; const H = canvas.height = 120;
  ctx.clearRect(0,0,W,H);
  const max = Math.max(...data,1);
  const pad = {t:10,b:20,l:10,r:10};
  const cw = W-pad.l-pad.r; const ch = H-pad.t-pad.b;
  ctx.strokeStyle='#1E2D40'; ctx.lineWidth=1;
  [0,0.5,1].forEach(f=>{ const y=pad.t+ch*(1-f); ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke(); });
  const pts = data.map((v,i)=>({x:pad.l+(i/(data.length-1))*cw, y:pad.t+ch*(1-v/max)}));
  ctx.beginPath(); ctx.moveTo(pts[0].x,H-pad.b);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.lineTo(pts[pts.length-1].x,H-pad.b); ctx.closePath();
  const g=ctx.createLinearGradient(0,pad.t,0,H); g.addColorStop(0,color+'55'); g.addColorStop(1,color+'00');
  ctx.fillStyle=g; ctx.fill();
  ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
  ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.stroke();
  pts.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); });
}

function renderCharts() {
  const history = DB.get('history')||[];
  const dayMap = {};
  history.filter(h=>h.type==='training').slice(-14).forEach(h=>{
    const d=new Date(h.ts).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit'});
    dayMap[d]=(dayMap[d]||0)+(h.xp||0);
  });
  const dayData = Object.values(dayMap).slice(-7);
  setTimeout(()=>drawChart('chartXP', dayData.length>1?dayData:[0,0], '#C9A84C'), 150);
  const passHist = history.filter(h=>h.type==='training'&&(h.tried||0)>0).slice(-10);
  const pctData = passHist.map(h=>h.ok&&h.tried?Math.round(h.ok/h.tried*100):0);
  setTimeout(()=>drawChart('chartPass', pctData.length>1?pctData:[0,0], '#00D4FF'), 150);
}

// ══════════════════════════════════════════
// CAREER
// ══════════════════════════════════════════
function renderCareer() {
  const el = document.getElementById('careerContent'); if(!el) return;
  const career = DB.get('career')||{};
  el.innerHTML = `
    <div class="section-title" style="margin-bottom:4px">Mode Carrière</div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">Jalons de ta carrière — de débutant à international.</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
    ${CAREER_MILESTONES.map(m=>{
      const done = career[m.id];
      const doneDate = done ? new Date(done).toLocaleDateString('fr-BE') : null;
      return `<div class="obj-item ${done?'done':''}" onclick="${done?'':'toggleCareer(\''+m.id+'\')'}">
        <div class="obj-check" style="font-size:18px;">${done?'✓':m.icon}</div>
        <div class="obj-info">
          <div class="obj-title">${m.label}</div>
          <div class="obj-meta">${m.desc}</div>
          ${doneDate?`<div style="font-size:10px;color:var(--green);margin-top:2px;">Accompli le ${doneDate}</div>`:''}
        </div>
        ${done?'':`<div style="font-size:11px;color:var(--text-muted);">+150 XP</div>`}
      </div>`;
    }).join('')}
    </div>`;
}

function toggleCareer(id) {
  const career = DB.get('career')||{};
  if(!career[id]){
    career[id] = Date.now();
    DB.set('career', career);
    const m = CAREER_MILESTONES.find(x=>x.id===id);
    addXP(150, 'Jalon : '+(m?.label||id));
    showToast('🏆 Jalon accompli !', '#1A2A00');
    renderCareer();
  }
}
