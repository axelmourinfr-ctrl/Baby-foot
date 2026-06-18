// ══════════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════════
let obAvatar='⚽'; let obPhotoData=null;

function selectAvatar(el) {
  document.querySelectorAll('.avatar-opt').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected'); obAvatar=el.dataset.emoji; obPhotoData=null;
}
function handlePhoto(inp) {
  const file=inp.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{ obPhotoData=e.target.result; const prev=document.getElementById('photoPreview'); prev.src=obPhotoData; prev.style.display='block'; };
  reader.readAsDataURL(file);
}
function obNext(step) {
  if(step===0){
    const name=document.getElementById('ob-name').value.trim();
    if(!name){ const inp=document.getElementById('ob-name'); inp.style.borderColor='#FF3B30'; inp.placeholder='Obligatoire !'; setTimeout(()=>{inp.style.borderColor='';inp.placeholder='Ex: Axel, Le Mur ...';},2000); return; }
  }
  document.getElementById('step'+step)?.classList.remove('active');
  document.getElementById('dot'+step)?.classList.remove('active');
  document.getElementById('step'+(step+1))?.classList.add('active');
  document.getElementById('dot'+(step+1))?.classList.add('active');
  document.getElementById('onboarding').scrollTo({top:0,behavior:'smooth'});
}
function finishOnboarding() {
  const profile={ name:document.getElementById('ob-name').value.trim(), hand:document.getElementById('ob-hand').value, pos:document.getElementById('ob-pos').value, level:document.getElementById('ob-level').value, tables:document.getElementById('ob-tables').value, elo:document.getElementById('ob-elo').value, goal:document.getElementById('ob-goal').value, avatar:obAvatar, photo:obPhotoData, createdAt:Date.now() };
  DB.set('profile',profile);
  if(!DB.get('xp')) DB.set('xp',0);
  if(!DB.get('exercises')) DB.set('exercises',DEFAULT_EXERCISES);
  if(!DB.get('history')) DB.set('history',[]);
  if(!DB.get('matchStats')) DB.set('matchStats',{att:{},def:{}});
  if(!DB.get('trainStats')) DB.set('trainStats',{});
  document.getElementById('onboarding').style.display='none';
  document.getElementById('app').classList.add('visible');
  initApp();
  setTimeout(()=>{ if(!DB.get('rankGlobal')) openPlacement(); },800);
}

// ══════════════════════════════════════════
// APP INIT
// ══════════════════════════════════════════
function initApp() {
  renderTopbar(); renderDashboard();
  renderTraining('passes'); renderMatch('att');
  renderStats(); renderProfile();
  renderObjectives(); renderCareer();
  initVideoScreen(); initCoachIA();
  checkBadges(); updateCoach();
  autoCheckMissions();
}

function renderTopbar() {
  const xp=DB.get('xp')||0; const lvl=RPG.getLevel(xp);
  document.getElementById('tb-xp').textContent=xp+' XP';
  document.getElementById('tb-lvl').textContent='NV.'+lvl;
  const profile=DB.get('profile');
  const av=document.getElementById('topbarAvatar');
  if(profile?.photo) av.innerHTML=`<img src="${profile.photo}" alt="">`;
  else av.textContent=profile?.avatar||'⚽';
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
function renderDashboard() {
  const profile=DB.get('profile'); if(!profile) return;
  const xp=DB.get('xp')||0; const lvl=RPG.getLevel(xp);
  const rank=getRank(xp); const history=DB.get('history')||[];
  const rankG=DB.get('rankGlobal');
  const leagueStr=rankG?LEAGUES[rankG.leagueIdx].emoji+' '+LEAGUES[rankG.leagueIdx].name+' '+['I','II','III'][(rankG.division||1)-1]:rank.name;
  const h=new Date().getHours();
  document.getElementById('dash-greeting').textContent=h<12?'Bon matin':h<18?'Bon après-midi':'Bonne soirée';
  document.getElementById('dash-name').textContent=profile.name;
  document.getElementById('dash-rank').textContent=leagueStr;
  document.getElementById('dash-level').textContent=lvl;
  const curXP=RPG.levelXP(lvl); const nextXP=RPG.levelXP(lvl+1);
  const pct=Math.min(100,Math.round(((xp-curXP)/(nextXP-curXP))*100));
  document.getElementById('dash-xp-cur').textContent=xp+' XP';
  document.getElementById('dash-xp-next').textContent=nextXP+' XP';
  document.getElementById('dash-xp-fill').style.width=pct+'%';
  const today=new Date().toDateString();
  document.getElementById('stat-sessions').textContent=history.filter(h=>new Date(h.ts).toDateString()===today&&h.type==='training').length;
  document.getElementById('stat-matches').textContent=history.filter(h=>new Date(h.ts).toDateString()===today&&h.type==='match').length;
  const ts=DB.get('trainStats')||{};
  let pOk=0,pT=0,gOk=0;
  Object.values(ts).forEach(ex=>{ if(ex.type==='passes'){pOk+=ex.ok||0;pT+=ex.tried||0;} if(ex.type==='goals') gOk+=ex.ok||0; });
  document.getElementById('stat-passes').textContent=pT>0?Math.round(pOk/pT*100)+'%':'—';
  document.getElementById('stat-goals').textContent=gOk||'—';

  // Streak dashboard
  const streak=getStreak(history);
  const streakEl=document.getElementById('dash-streak');
  if(streakEl) streakEl.innerHTML=streak>0?`<span style="color:var(--gold);">🔥 ${streak} jour${streak>1?'s':''} consécutif${streak>1?'s':''}</span>`:'';

  renderBadgesRow(DB.get('badges')||{});
}

function getRank(xp) { let r=RPG.ranks[0]; RPG.ranks.forEach(rk=>{if(xp>=rk.xp)r=rk;}); return r; }

// ══════════════════════════════════════════
// STATS
// ══════════════════════════════════════════
function renderStats() {
  const history=DB.get('history')||[]; const xp=DB.get('xp')||0; const ts=DB.get('trainStats')||{};
  document.getElementById('s-total-sessions').textContent=history.filter(h=>h.type==='training').length;
  document.getElementById('s-total-matches').textContent=history.filter(h=>h.type==='match').length;
  document.getElementById('s-total-xp').textContent=xp;
  let pOk=0,pT=0,gOk=0,gT=0;
  Object.values(ts).forEach(ex=>{ if(ex.type==='passes'){pOk+=ex.ok||0;pT+=ex.tried||0;} if(ex.type==='goals'){gOk+=ex.ok||0;gT+=ex.tried||0;} });
  document.getElementById('s-pass-att').textContent=pT;
  document.getElementById('s-pass-pct').textContent=pT>0?Math.round(pOk/pT*100)+'%':'—';
  document.getElementById('s-att-tries').textContent=gT;
  document.getElementById('s-att-pct').textContent=gT>0?Math.round(gOk/gT*100)+'%':'—';
  const sorted=[...history].sort((a,b)=>b.ts-a.ts).slice(0,20);
  document.getElementById('historyList').innerHTML=sorted.length===0
    ?`<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Aucune activité</div></div>`
    :sorted.map(h=>{ const d=new Date(h.ts); const ds=d.toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'}); const desc=h.type==='match'?'Match · '+(h.role==='att'?'Attaquant':'Défenseur'):h.type==='video'?'Analyse vidéo · '+h.events+' événements':'Entraînement · '+(h.tried||0)+' rép.'; return `<div class="history-item"><div class="history-left"><div class="history-date">${ds}</div><div class="history-desc">${desc}</div></div><div class="history-xp">+${h.xp} XP</div></div>`; }).join('');
}

// ══════════════════════════════════════════
// PROFILE
// ══════════════════════════════════════════
function renderProfile() {
  const profile=DB.get('profile'); if(!profile) return;
  const xp=DB.get('xp')||0; const rank=getRank(xp);
  const ts=DB.get('trainStats')||{}; const ms=DB.get('matchStats')||{att:{},def:{}};
  const av=document.getElementById('prof-avatar');
  if(profile.photo) av.innerHTML=`<img src="${profile.photo}" alt="">`;
  else av.textContent=profile.avatar||'⚽';
  document.getElementById('prof-name').textContent=profile.name;
  document.getElementById('prof-rank').textContent=rank.name;
  const tags=[profile.pos,profile.hand,profile.level,profile.elo?'ELO '+profile.elo:null].filter(Boolean);
  document.getElementById('prof-tags').innerHTML=tags.map(t=>`<div class="profile-tag">${t}</div>`).join('');
  const created=profile.createdAt?new Date(profile.createdAt).toLocaleDateString('fr-BE'):'—';
  const history=DB.get('history')||[];
  const streak=getStreak(history);
  document.getElementById('prof-stats').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
      <div class="stat-card"><div class="stat-card-label">Membre depuis</div><div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-top:4px;">${created}</div></div>
      <div class="stat-card highlight"><div class="stat-card-label">Série actuelle</div><div class="stat-card-value">${streak>0?'🔥'+streak:'—'}</div></div>
      <div class="stat-card"><div class="stat-card-label">Sessions total</div><div class="stat-card-value">${history.filter(h=>h.type==='training').length}</div></div>
      <div class="stat-card"><div class="stat-card-label">XP total</div><div class="stat-card-value">${xp}</div></div>
    </div>`;
  let totalArr=(ms.def?.saves||0), totalButs=(ms.att?.goals||0);
  Object.values(ts).forEach(ex=>{ if(ex.type==='saves')totalArr+=ex.ok||0; if(ex.type==='goals')totalButs+=ex.ok||0; });
  const matchCount=history.filter(h=>h.type==='match').length;
  let defLvl=0; RPG.defenseReqs.forEach((r,i)=>{if(totalArr>=r)defLvl=i;});
  let attLvl=0; RPG.attackReqs.forEach((r,i)=>{if(totalButs>=r)attLvl=i;});
  let multiLvl=0; RPG.multiReqs.forEach((r,i)=>{if(matchCount>=r)multiLvl=i;});
  renderTitles('titles-def',RPG.titlesDefense,defLvl,RPG.defenseReqs,totalArr,'arrêts');
  renderTitles('titles-att',RPG.titlesAttack,attLvl,RPG.attackReqs,totalButs,'buts');
  renderTitles('titles-multi',RPG.titlesMulti,multiLvl,RPG.multiReqs,matchCount,'matchs');
  renderBadgesPage();
}

function renderTitles(id, titles, cur, reqs, val, unit) {
  document.getElementById(id).innerHTML=titles.map((t,i)=>`
    <div class="title-row ${i<=cur?'unlocked':''}">
      <div class="title-info"><div class="title-name">${i<=cur?'🏆 ':''} ${t}</div><div class="title-req">${reqs[i]} ${unit} requis · Actuel : ${val}</div></div>
      <span class="title-badge ${i<=cur?'unlocked-b':'locked'}">${i<=cur?'Débloqué':'Verrouillé'}</span>
    </div>`).join('');
}

function openEditProfile() {
  const p=DB.get('profile');
  ['name','hand','pos','tables','elo','goal'].forEach(k=>{ const el=document.getElementById('edit-'+k); if(el) el.value=p[k]||''; });
  openModal('editModal');
}
function saveProfile() {
  const p=DB.get('profile');
  ['name','hand','pos','tables','elo','goal'].forEach(k=>{ const el=document.getElementById('edit-'+k); if(el&&el.value.trim()) p[k]=el.value.trim(); });
  DB.set('profile',p); closeModal('editModal'); renderProfile(); renderDashboard(); renderTopbar();
}

// ══════════════════════════════════════════
// COACH (règles)
// ══════════════════════════════════════════
function updateCoach() {
  const ts=DB.get('trainStats')||{}; const history=DB.get('history')||[]; const msgs=[];
  let pOk=0,pT=0; Object.values(ts).forEach(ex=>{ if(ex.type==='passes'){pOk+=ex.ok||0;pT+=ex.tried||0;} });
  if(pT>20){
    const pct=Math.round(pOk/pT*100);
    if(pct<50) msgs.push(`Tes passes milieu sont à <strong>${pct}%</strong> — point faible prioritaire. Recommandation : <strong>100 passes croisées aujourd'hui.</strong>`);
    else if(pct>=80) msgs.push(`Excellent ! Tes passes à <strong>${pct}%</strong>. Concentre-toi sur l'attaque maintenant.`);
    else msgs.push(`Passes à <strong>${pct}%</strong>. Objectif : 70%+.`);
  }
  const last7=history.filter(h=>Date.now()-h.ts<7*24*3600*1000&&h.type==='training').length;
  if(last7===0&&history.length>0) msgs.push(`Aucun entraînement cette semaine. <strong>Reprends dès aujourd'hui !</strong>`);
  else if(last7>=5) msgs.push(`<strong>${last7} sessions</strong> cette semaine — tu es en feu !`);
  const coachEl=document.getElementById('coach-msg');
  if(coachEl) coachEl.innerHTML=msgs[0]||'Commence ton premier entraînement pour recevoir une analyse.';
}

// ══════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════
function navTo(screen) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('screen-'+screen)?.classList.add('active');
  document.getElementById('nav-'+screen)?.classList.add('active');
  if(screen==='stats'){ renderStats(); setTimeout(renderCharts,200); }
  if(screen==='profile') renderProfile();
  if(screen==='dash') renderDashboard();
  if(screen==='objectives') renderObjectives();
  if(screen==='league') renderLeague();
  if(screen==='career') renderCareer();
  if(screen==='video') initVideoScreen();
  if(screen==='coach') initCoachIA();
}

// ══════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════
window.addEventListener('DOMContentLoaded',()=>{
  const profile=DB.get('profile');
  if(profile){ document.getElementById('onboarding').style.display='none'; initApp(); }
});
