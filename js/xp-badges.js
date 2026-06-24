// ══════════════════════════════════════════
// XP SYSTEM
// ══════════════════════════════════════════
function addXP(amount, label) {
  const prev = DB.get('xp')||0;
  DB.set('xp', prev+amount);
  const toast = document.getElementById('xpToast');
  if(toast){ toast.textContent='+'+amount+' XP — '+label; toast.style.background=''; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),2500); }
  renderTopbar();
}

function showToast(msg, color) {
  const toast = document.getElementById('xpToast');
  if(!toast) return;
  toast.textContent=msg; toast.style.background=color||'';
  toast.classList.add('show'); setTimeout(()=>{ toast.classList.remove('show'); toast.style.background=''; },3000);
}

// ══════════════════════════════════════════
// BADGES — avec progression
// ══════════════════════════════════════════
const BADGES = [
  // Débuts
  { id:'firsttrain',   label:'Première fois',      icon:'👶', cat:'Débuts',      desc:'1 session',         check:(ts,ms,h)=>h.filter(x=>x.type==='training').length>=1, progress:(ts,ms,h)=>({val:h.filter(x=>x.type==='training').length,max:1}) },
  { id:'firstmatch',   label:'Premier match',       icon:'⚽', cat:'Débuts',      desc:'1 match',           check:(ts,ms,h)=>h.filter(x=>x.type==='match').length>=1, progress:(ts,ms,h)=>({val:h.filter(x=>x.type==='match').length,max:1}) },
  { id:'placement',    label:'Placé',               icon:'🎯', cat:'Débuts',      desc:'Test de placement', check:()=>!!DB.get('rankGlobal'), progress:()=>({val:DB.get('rankGlobal')?1:0,max:1}) },
  // Régularité
  { id:'streak3',      label:'3 jours',             icon:'🔥', cat:'Régularité',  desc:'3 jours consécutifs', check:(ts,ms,h)=>checkStreakN(h,3), progress:(ts,ms,h)=>({val:getStreak(h),max:3}) },
  { id:'streak7',      label:'7 jours',             icon:'⚡', cat:'Régularité',  desc:'7 jours consécutifs', check:(ts,ms,h)=>checkStreakN(h,7), progress:(ts,ms,h)=>({val:getStreak(h),max:7}) },
  { id:'streak14',     label:'14 jours',            icon:'🌟', cat:'Régularité',  desc:'14 jours consécutifs',check:(ts,ms,h)=>checkStreakN(h,14),progress:(ts,ms,h)=>({val:getStreak(h),max:14}) },
  { id:'sessions10',   label:'10 sessions',         icon:'📋', cat:'Régularité',  desc:'10 sessions',       check:(ts,ms,h)=>h.filter(x=>x.type==='training').length>=10, progress:(ts,ms,h)=>({val:h.filter(x=>x.type==='training').length,max:10}) },
  { id:'sessions50',   label:'50 sessions',         icon:'🏃', cat:'Régularité',  desc:'50 sessions',       check:(ts,ms,h)=>h.filter(x=>x.type==='training').length>=50, progress:(ts,ms,h)=>({val:h.filter(x=>x.type==='training').length,max:50}) },
  // Heures fun
  { id:'early',        label:'Lève-tôt',            icon:'🌅', cat:'Fun',         desc:'S\'entraîner avant 8h', check:(ts,ms,h)=>h.some(x=>new Date(x.ts).getHours()<8), progress:(ts,ms,h)=>({val:h.some(x=>new Date(x.ts).getHours()<8)?1:0,max:1}) },
  { id:'night',        label:'Nocturne',             icon:'🦉', cat:'Fun',         desc:'S\'entraîner après 22h',check:(ts,ms,h)=>h.some(x=>new Date(x.ts).getHours()>=22),progress:(ts,ms,h)=>({val:h.some(x=>new Date(x.ts).getHours()>=22)?1:0,max:1}) },
  { id:'perfect',      label:'Parfait',              icon:'💯', cat:'Fun',         desc:'100% sur un exercice (10 min)', check:(ts)=>Object.values(ts).some(e=>e.tried>=10&&e.ok>=e.tried), progress:(ts)=>({val:Object.values(ts).some(e=>e.tried>=10&&e.ok>=e.tried)?1:0,max:1}) },
  // Passes
  { id:'pass500',      label:'500 passes',           icon:'✋', cat:'Passes',      desc:'500 passes réussies', check:(ts)=>getTotalStat(ts,'passes')>=500,  progress:(ts)=>({val:getTotalStat(ts,'passes'),max:500}) },
  { id:'facteur',      label:'Le Facteur',           icon:'📬', cat:'Passes',      desc:'1000 passes réussies',check:(ts)=>getTotalStat(ts,'passes')>=1000, progress:(ts)=>({val:getTotalStat(ts,'passes'),max:1000}) },
  { id:'pass5000',     label:'5000 passes',          icon:'🤝', cat:'Passes',      desc:'5000 passes réussies',check:(ts)=>getTotalStat(ts,'passes')>=5000, progress:(ts)=>({val:getTotalStat(ts,'passes'),max:5000}) },
  // Attaque
  { id:'goals100',     label:'100 buts',             icon:'⚽', cat:'Attaque',     desc:'100 buts marqués',  check:(ts,ms)=>getTotalGoals(ts,ms)>=100,  progress:(ts,ms)=>({val:getTotalGoals(ts,ms),max:100}) },
  { id:'machine',      label:'Machine à Buts',       icon:'🔥', cat:'Attaque',     desc:'1000 buts marqués', check:(ts,ms)=>getTotalGoals(ts,ms)>=1000, progress:(ts,ms)=>({val:getTotalGoals(ts,ms),max:1000}) },
  // Défense
  { id:'saves50',      label:'50 arrêts',            icon:'🛡️', cat:'Défense',     desc:'50 arrêts',         check:(ts,ms)=>getTotalSaves(ts,ms)>=50,   progress:(ts,ms)=>({val:getTotalSaves(ts,ms),max:50}) },
  { id:'mur',          label:'Mur Défensif',         icon:'🧱', cat:'Défense',     desc:'1000 arrêts',       check:(ts,ms)=>getTotalSaves(ts,ms)>=1000, progress:(ts,ms)=>({val:getTotalSaves(ts,ms),max:1000}) },
  // Matchs
  { id:'matches10',    label:'10 matchs',            icon:'🏅', cat:'Matchs',      desc:'10 matchs joués',   check:(ts,ms,h)=>h.filter(x=>x.type==='match').length>=10, progress:(ts,ms,h)=>({val:h.filter(x=>x.type==='match').length,max:10}) },
  { id:'polyvalent',   label:'Polyvalent',           icon:'⚡', cat:'Matchs',      desc:'10 matchs att. ET 10 def.', check:(ts,ms,h)=>h.filter(x=>x.type==='match'&&x.role==='att').length>=10&&h.filter(x=>x.type==='match'&&x.role==='def').length>=10, progress:(ts,ms,h)=>({val:Math.min(h.filter(x=>x.type==='match'&&x.role==='att').length,h.filter(x=>x.type==='match'&&x.role==='def').length),max:10}) },
  { id:'globe',        label:'Globe-Trotter',        icon:'🌍', cat:'Matchs',      desc:'2 tables + 10 matchs',check:(ts,ms,h)=>{ const t=(DB.get('profile')?.tables||'').split(',').filter(Boolean); return t.length>=2&&h.filter(x=>x.type==='match').length>=10; }, progress:(ts,ms,h)=>({val:h.filter(x=>x.type==='match').length,max:10}) },
  // Rang
  { id:'level5',       label:'Décollage',            icon:'🚀', cat:'Rang',        desc:'Niveau 5',          check:()=>RPG.getLevel(DB.get('xp')||0)>=5,  progress:()=>({val:RPG.getLevel(DB.get('xp')||0),max:5}) },
  { id:'gold_rank',    label:'Rang Or+',             icon:'🥇', cat:'Rang',        desc:'Atteindre Or',      check:()=>{ const r=DB.get('rankGlobal'); return r&&r.leagueIdx>=2; }, progress:()=>({val:DB.get('rankGlobal')?.leagueIdx||0,max:2}) },
  { id:'diamond_rank', label:'Rang Diamant+',        icon:'💠', cat:'Rang',        desc:'Atteindre Diamant', check:()=>{ const r=DB.get('rankGlobal'); return r&&r.leagueIdx>=4; }, progress:()=>({val:DB.get('rankGlobal')?.leagueIdx||0,max:4}) },
  // Carrière
  { id:'validated',    label:'Homologué',            icon:'✅', cat:'Carrière',    desc:'Homologuer son rang',check:()=>!!DB.get('validated'), progress:()=>({val:DB.get('validated')?1:0,max:1}) },
  { id:'video1',       label:'Analyste',             icon:'🎬', cat:'Carrière',    desc:'1 analyse vidéo',   check:(ts,ms,h)=>h.filter(x=>x.type==='video').length>=1, progress:(ts,ms,h)=>({val:h.filter(x=>x.type==='video').length,max:1}) },
  // Missions
  { id:'missions5',    label:'Discipliné',           icon:'📋', cat:'Missions',    desc:'5 missions accomplies',  check:()=>getMissionTotal()>=5,   progress:()=>({val:getMissionTotal(),max:5}) },
  { id:'missions20',   label:'Régulier',             icon:'🔄', cat:'Missions',    desc:'20 missions accomplies', check:()=>getMissionTotal()>=20,  progress:()=>({val:getMissionTotal(),max:20}) },
  { id:'missions50',   label:'Acharné',              icon:'💪', cat:'Missions',    desc:'50 missions accomplies', check:()=>getMissionTotal()>=50,  progress:()=>({val:getMissionTotal(),max:50}) },
  { id:'missions100',  label:'Obsessionnel',         icon:'🔥', cat:'Missions',    desc:'100 missions',           check:()=>getMissionTotal()>=100, progress:()=>({val:getMissionTotal(),max:100}) },
];

function getMissionTotal() {
  const m = DB.get('missions')||{};
  let t = DB.get('totalMissionsDone')||0;
  ['daily','weekly','monthly','custom'].forEach(p=>{ t+=(m[p]||[]).filter(x=>x.done).length; });
  return t;
}
function getTotalStat(ts, type) { let t=0; Object.values(ts).forEach(e=>{ if(e.type===type) t+=e.ok||0; }); return t; }
function getTotalGoals(ts,ms) { return getTotalStat(ts,'goals')+(ms?.att?.goals||0); }
function getTotalSaves(ts,ms) { return getTotalStat(ts,'saves')+(ms?.def?.saves||0); }
function getStreak(history) {
  const days=[...new Set(history.filter(h=>h.type==='training').map(h=>new Date(h.ts).toDateString()))];
  let streak=0; const today=new Date();
  for(let i=0;i<60;i++){ const d=new Date(today); d.setDate(d.getDate()-i); if(days.includes(d.toDateString())) streak++; else if(streak>0) break; }
  return streak;
}
function checkStreakN(h,n) { return getStreak(h)>=n; }

function checkBadges() {
  const ts=DB.get('trainStats')||{}; const ms=DB.get('matchStats')||{att:{},def:{}}; const hist=DB.get('history')||[];
  const unlocked=DB.get('badges')||{};
  BADGES.forEach(b=>{ if(!unlocked[b.id]&&b.check(ts,ms,hist)){ unlocked[b.id]=true; DB.set('badges',unlocked); showToast('🏅 Badge : '+b.label,'#1A3A1A'); } });
  renderBadgesRow(unlocked);
}

function renderBadgesRow(unlocked) {
  const row=document.getElementById('badges-row'); if(!row) return;
  const ul=BADGES.filter(b=>unlocked[b.id]);
  const lk=BADGES.filter(b=>!unlocked[b.id]).slice(0,3);
  row.innerHTML=[
    ...ul.map(b=>`<div class="badge-chip unlocked"><span class="badge-icon">${b.icon}</span>${b.label}</div>`),
    ...lk.map(b=>`<div class="badge-chip"><span class="badge-icon">🔒</span>${b.label}</div>`)
  ].join('');
}

// ── PAGE BADGES AVEC PROGRESSION ──
function renderBadgesPage() {
  const el=document.getElementById('prof-badges'); if(!el) return;
  const ts=DB.get('trainStats')||{}; const ms=DB.get('matchStats')||{att:{},def:{}}; const hist=DB.get('history')||[];
  const unlocked=DB.get('badges')||{};
  const cats=[...new Set(BADGES.map(b=>b.cat))];
  const totalUnlocked=BADGES.filter(b=>unlocked[b.id]).length;

  el.innerHTML=`
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:12px;display:flex;align-items:center;gap:12px;">
      <div style="font-size:28px;">🏅</div>
      <div>
        <div style="font-size:22px;font-weight:900;color:var(--gold);">${totalUnlocked} / ${BADGES.length}</div>
        <div style="font-size:11px;color:var(--text-secondary);">badges débloqués</div>
      </div>
      <div style="flex:1;margin-left:8px;">
        <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
          <div style="height:100%;background:var(--gold);border-radius:3px;width:${Math.round(totalUnlocked/BADGES.length*100)}%;"></div>
        </div>
      </div>
    </div>
    <button type="button" onclick="shareRankImage()" style="width:100%;padding:10px;margin-bottom:14px;background:transparent;border:1px solid var(--gold-dim);color:var(--gold);border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">📤 Partager mon rang</button>
  `+cats.map(cat=>`
    <div style="margin-bottom:4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text-secondary);margin-top:12px;">${cat}</div>
    ${BADGES.filter(b=>b.cat===cat).map(b=>{
      const done=unlocked[b.id];
      const prog=b.progress?b.progress(ts,ms,hist):{val:0,max:1};
      const pct=Math.min(100,Math.round(prog.val/prog.max*100));
      return `<div style="background:var(--bg-card);border:1px solid ${done?'var(--gold-dim)':'var(--border)'};border-radius:6px;padding:12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;">
        <div style="font-size:24px;opacity:${done?1:0.4};">${b.icon}</div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;color:${done?'var(--gold)':'var(--text-primary)'};">${b.label}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">${b.desc}</div>
          <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;">
            <div style="height:100%;background:${done?'var(--gold)':'var(--border-bright)'};border-radius:2px;width:${pct}%;transition:width 0.4s;"></div>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${prog.val} / ${prog.max}</div>
        </div>
        ${done?'<div style="font-size:16px;">✅</div>':''}
      </div>`;
    }).join('')}
  `).join('');
}

// ── AUTO-COMPLETE linked to missions ──
function autoCheckObjectives() { autoCheckMissions(); }

function shareRankImage() {
  const profile = DB.get('profile') || {};
  const xp = DB.get('xp') || 0;
  const rank = getRank(xp);
  const rankG = DB.get('rankGlobal');
  const league = rankG ? (LEAGUES[rankG.leagueIdx] || LEAGUES[0]) : null;
  const unlocked = DB.get('badges') || {};
  const totalUnlocked = BADGES.filter(b => unlocked[b.id]).length;

  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 1000;
  const ctx = canvas.getContext('2d');

  // Fond
  const grad = ctx.createLinearGradient(0,0,0,1000);
  grad.addColorStop(0,'#0D1B2A'); grad.addColorStop(1,'#1B2838');
  ctx.fillStyle = grad; ctx.fillRect(0,0,800,1000);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('BFC · RPG', 400, 90);

  ctx.font = '120px sans-serif';
  ctx.fillText(league ? league.emoji : '⚽', 400, 280);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(league ? league.name : rank.name, 400, 360);

  ctx.fillStyle = '#9FB3C8';
  ctx.font = '28px sans-serif';
  ctx.fillText(profile.name || 'Joueur', 400, 410);

  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(xp + ' XP', 400, 510);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(totalUnlocked + ' / ' + BADGES.length + ' badges débloqués', 400, 580);

  ctx.fillStyle = '#5A6B7D';
  ctx.font = '22px sans-serif';
  ctx.fillText('BabyFoot Coach RPG', 400, 950);

  canvas.toBlob(blob => {
    const file = new File([blob], 'bfc-rang.png', {type:'image/png'});
    if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
      navigator.share({files:[file], title:'Mon rang BFC·RPG'}).catch(()=>{});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'bfc-rang.png'; a.click();
      URL.revokeObjectURL(url);
      showToast('🖼️ Image téléchargée !', '#1A3A1A');
    }
  }, 'image/png');
}
