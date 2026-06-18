// ══════════════════════════════════════════
// XP SYSTEM
// ══════════════════════════════════════════
function addXP(amount, label) {
  const prev = DB.get('xp') || 0;
  const newXP = prev + amount;
  DB.set('xp', newXP);
  const toast = document.getElementById('xpToast');
  if(toast){ toast.textContent = '+'+amount+' XP — '+label; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),2500); }
  renderTopbar();
}

function showToast(msg, color) {
  const toast = document.getElementById('xpToast');
  if(!toast) return;
  toast.textContent = msg;
  toast.style.background = color||'';
  toast.classList.add('show');
  setTimeout(()=>{ toast.classList.remove('show'); toast.style.background=''; },3000);
}

// ══════════════════════════════════════════
// BADGES
// ══════════════════════════════════════════
const BADGES = [
  // Premiers pas
  { id:'firsttrain',  label:'Première fois',    icon:'👶', cat:'Débuts',      check:(ts,ms,h)=>h.filter(x=>x.type==='training').length>=1 },
  { id:'firstmatch',  label:'Premier match',     icon:'⚽', cat:'Débuts',      check:(ts,ms,h)=>h.filter(x=>x.type==='match').length>=1 },
  { id:'placement',   label:'Placé',             icon:'🎯', cat:'Débuts',      check:()=>!!DB.get('rankGlobal') },
  // Régularité
  { id:'streak3',     label:'3 jours d\'affilée',icon:'🔥', cat:'Régularité',  check:(ts,ms,h)=>checkStreak(h,3) },
  { id:'streak7',     label:'7 jours d\'affilée',icon:'⚡', cat:'Régularité',  check:(ts,ms,h)=>checkStreak(h,7) },
  { id:'sessions10',  label:'10 sessions',       icon:'📋', cat:'Régularité',  check:(ts,ms,h)=>h.filter(x=>x.type==='training').length>=10 },
  { id:'sessions50',  label:'50 sessions',       icon:'🏃', cat:'Régularité',  check:(ts,ms,h)=>h.filter(x=>x.type==='training').length>=50 },
  // Heures
  { id:'early',       label:'Lève-tôt',          icon:'🌅', cat:'Fun',         check:(ts,ms,h)=>h.some(x=>new Date(x.ts).getHours()<8) },
  { id:'night',       label:'Nocturne',           icon:'🦉', cat:'Fun',         check:(ts,ms,h)=>h.some(x=>new Date(x.ts).getHours()>=22) },
  // Performance passes
  { id:'facteur',     label:'Le Facteur',         icon:'📬', cat:'Passes',      check:(ts)=>{ let t=0; Object.values(ts).forEach(e=>{if(e.type==='passes')t+=e.ok||0;}); return t>=1000; }},
  { id:'pass500',     label:'500 passes',         icon:'✋', cat:'Passes',      check:(ts)=>{ let t=0; Object.values(ts).forEach(e=>{if(e.type==='passes')t+=e.ok||0;}); return t>=500; }},
  { id:'perfect',     label:'Parfait',            icon:'💯', cat:'Performance', check:(ts)=>Object.values(ts).some(e=>e.tried>=10&&e.ok>=e.tried) },
  // Performance tirs
  { id:'machine',     label:'Machine à Buts',     icon:'🔥', cat:'Attaque',     check:(ts,ms)=>{ let t=(ms?.att?.goals||0); Object.values(ts).forEach(e=>{if(e.type==='goals')t+=e.ok||0;}); return t>=1000; }},
  { id:'goals100',    label:'100 buts',           icon:'⚽', cat:'Attaque',     check:(ts,ms)=>{ let t=(ms?.att?.goals||0); Object.values(ts).forEach(e=>{if(e.type==='goals')t+=e.ok||0;}); return t>=100; }},
  // Performance défense
  { id:'mur',         label:'Mur Défensif',       icon:'🧱', cat:'Défense',     check:(ts,ms)=>{ let t=(ms?.def?.saves||0); Object.values(ts).forEach(e=>{if(e.type==='saves')t+=e.ok||0;}); return t>=1000; }},
  { id:'saves50',     label:'50 arrêts',          icon:'🛡️', cat:'Défense',     check:(ts,ms)=>{ let t=(ms?.def?.saves||0); Object.values(ts).forEach(e=>{if(e.type==='saves')t+=e.ok||0;}); return t>=50; }},
  // Matchs
  { id:'polyvalent',  label:'Polyvalent',         icon:'⚡', cat:'Matchs',      check:(ts,ms,h)=>h.filter(x=>x.type==='match'&&x.role==='att').length>=10&&h.filter(x=>x.type==='match'&&x.role==='def').length>=10 },
  { id:'matches10',   label:'10 matchs',          icon:'🏅', cat:'Matchs',      check:(ts,ms,h)=>h.filter(x=>x.type==='match').length>=10 },
  { id:'globe',       label:'Globe-Trotter',      icon:'🌍', cat:'Matchs',      check:(ts,ms,h)=>{ const tables=(DB.get('profile')?.tables||'').split(',').filter(Boolean); return tables.length>=2&&h.filter(x=>x.type==='match').length>=10; }},
  // Rang
  { id:'level5',      label:'Décollage',          icon:'🚀', cat:'Rang',        check:()=>RPG.getLevel(DB.get('xp')||0)>=5 },
  { id:'gold_rank',   label:'Rang Or+',           icon:'🥇', cat:'Rang',        check:()=>{ const r=DB.get('rankGlobal'); return r&&r.leagueIdx>=2; }},
  { id:'diamond_rank',label:'Rang Diamant+',      icon:'💠', cat:'Rang',        check:()=>{ const r=DB.get('rankGlobal'); return r&&r.leagueIdx>=4; }},
  // Carrière
  { id:'validated',   label:'Homologué',          icon:'✅', cat:'Carrière',    check:()=>!!DB.get('validated') },
  { id:'video1',      label:'Analyste',           icon:'🎬', cat:'Carrière',    check:(ts,ms,h)=>h.filter(x=>x.type==='video').length>=1 },
];

function checkStreak(history, days) {
  const trainDays = [...new Set(history.filter(h=>h.type==='training').map(h=>new Date(h.ts).toDateString()))];
  if(trainDays.length<days) return false;
  const today = new Date(); let streak=0;
  for(let i=0;i<days+3;i++){
    const d=new Date(today); d.setDate(d.getDate()-i);
    if(trainDays.includes(d.toDateString())) streak++; else if(streak>0) break;
  }
  return streak>=days;
}

function checkBadges() {
  const ts = DB.get('trainStats')||{};
  const ms = DB.get('matchStats')||{att:{},def:{}};
  const hist = DB.get('history')||[];
  const unlocked = DB.get('badges')||{};
  BADGES.forEach(b=>{
    if(!unlocked[b.id] && b.check(ts,ms,hist)){
      unlocked[b.id]=true;
      DB.set('badges',unlocked);
      showToast('🏅 Badge : '+b.label, '#1A3A1A');
    }
  });
  renderBadgesRow(unlocked);
}

function renderBadgesRow(unlocked) {
  const row = document.getElementById('badges-row');
  if(!row) return;
  const unlockedBadges = BADGES.filter(b=>unlocked[b.id]);
  const locked = BADGES.filter(b=>!unlocked[b.id]).slice(0,3);
  row.innerHTML = [
    ...unlockedBadges.map(b=>`<div class="badge-chip unlocked"><span class="badge-icon">${b.icon}</span>${b.label}</div>`),
    ...locked.map(b=>`<div class="badge-chip"><span class="badge-icon">🔒</span>${b.label}</div>`)
  ].join('');
}

// ══════════════════════════════════════════
// AUTO-COMPLETE OBJECTIVES
// ══════════════════════════════════════════
function autoCheckObjectives() {
  const objectives = DB.get('objectives');
  if(!objectives) return;
  const ts = DB.get('trainStats')||{};
  const ms = DB.get('matchStats')||{att:{},def:{}};
  const history = DB.get('history')||[];

  let totalPassOk=0, totalPassTried=0, totalGoals=0, totalGoalTried=0, totalSaves=0;
  Object.values(ts).forEach(ex=>{
    if(ex.type==='passes'){ totalPassOk+=ex.ok||0; totalPassTried+=ex.tried||0; }
    if(ex.type==='goals'){ totalGoals+=ex.ok||0; totalGoalTried+=ex.tried||0; }
    if(ex.type==='saves'){ totalSaves+=ex.ok||0; }
  });
  totalGoals += ms.att?.goals||0;
  totalSaves += ms.def?.saves||0;

  const now = Date.now();
  const todayStr = new Date().toDateString();
  const weekAgo = now - 7*24*3600*1000;
  const monthAgo = now - 30*24*3600*1000;
  const sessionsToday  = history.filter(h=>h.type==='training'&&new Date(h.ts).toDateString()===todayStr).length;
  const matchesToday   = history.filter(h=>h.type==='match'&&new Date(h.ts).toDateString()===todayStr).length;
  const sessionsWeek   = history.filter(h=>h.type==='training'&&h.ts>weekAgo).length;
  const sessionsMonth  = history.filter(h=>h.type==='training'&&h.ts>monthAgo).length;
  const matchesMonth   = history.filter(h=>h.type==='match'&&h.ts>monthAgo).length;

  const matchers = [
    { re:/(\d+)\s*passe/i,    val:(n)=> totalPassOk>=n },
    { re:/(\d+)\s*but/i,      val:(n)=> totalGoals>=n },
    { re:/(\d+)\s*arrêt/i,    val:(n)=> totalSaves>=n },
    { re:/1\s*(session|entraîn)/i, val:()=> sessionsToday>=1 },
    { re:/(\d+)\s*(session|entraîn)/i, val:(n)=> n<=2?sessionsToday>=n:sessionsWeek>=n },
    { re:/1\s*match/i,        val:()=> matchesToday>=1 },
    { re:/(\d+)\s*match/i,    val:(n)=> n<=2?matchesToday>=n:matchesMonth>=n },
    { re:/(\d+)\s*tir/i,      val:(n)=> totalGoalTried>=n },
  ];

  let changed = false;
  ['daily','weekly','monthly','custom'].forEach(period=>{
    (objectives[period]||[]).forEach(obj=>{
      if(obj.done) return;
      const title = obj.title.toLowerCase();
      for(const m of matchers){
        const match = title.match(m.re);
        if(match && m.val(parseInt(match[1])||1)){
          obj.done = true; obj.autoCompleted = true; changed = true;
          setTimeout(()=>{ showToast('🎯 Objectif accompli : '+obj.title,'#0A2A0A'); addXP(obj.xp,'Objectif : '+obj.title); },400);
          break;
        }
      }
    });
  });
  if(changed){ DB.set('objectives',objectives); if(document.getElementById('screen-objectives')?.classList.contains('active')) renderObjectives(); }
}
