// ══════════════════════════════════════════
// LEAGUE SYSTEM
// ══════════════════════════════════════════
let plData = { scores:[0,0,0,0,0,0], tries:[0,0,0,0,0,0], step:0, choices:{passeDef:'',tirDef:'',tirAtt:''} };
let reactQueue = [];
let reactIdx = 0;

function openPlacement() {
  plData = { scores:[0,0,0,0,0,0], tries:[0,0,0,0,0,0], step:0, choices:{passeDef:'',tirDef:'',tirAtt:''} };
  reactQueue = [...REACT_ACTIONS].sort(()=>Math.random()-0.5);
  reactIdx = 0;
  for(let i=0;i<6;i++){
    const c=document.getElementById('plcount'+i); if(c) c.textContent='0';
    const b=document.getElementById('plbar'+i);   if(b) b.style.width='0%';
    const s=document.getElementById('plscore'+i); if(s) s.textContent='Réussites : 0';
  }
  for(let i=0;i<=6;i++){ document.getElementById('plstep'+i)?.classList.remove('active'); }
  for(let i=0;i<6;i++){ const d=document.getElementById('pldot'+i); if(d){d.classList.remove('done','active');} }
  document.getElementById('plstep0').classList.add('active');
  document.getElementById('pldot0').classList.add('active');
  ['plPasseDefPicker','plTirDefPicker','plTirAttPicker'].forEach(id=>{ const e=document.getElementById(id);if(e)e.style.display='block'; });
  ['plPasseDefTest','plTirDefTest','plTirAttTest','plReactTest'].forEach(id=>{ const e=document.getElementById(id);if(e)e.style.display='none'; });
  const rs=document.getElementById('plReactStart'); if(rs) rs.style.display='block';
  document.querySelectorAll('.pl-tir-opt').forEach(o=>o.classList.remove('selected'));
  ['plPasseDefStart','plTirDefStart','plTirAttStart'].forEach(id=>{ const b=document.getElementById(id); if(b){b.style.opacity='0.4';b.style.pointerEvents='none';} });
  document.getElementById('placementOverlay').classList.add('open');
  document.getElementById('placementOverlay').scrollTo({top:0});
}

function selectPlChoice(type, el, name) {
  el.closest('.pl-tir-grid').querySelectorAll('.pl-tir-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  plData.choices[type] = name;
  const btnMap={passeDef:'plPasseDefStart',tirDef:'plTirDefStart',tirAtt:'plTirAttStart'};
  const btn=document.getElementById(btnMap[type]);
  if(btn){btn.style.opacity='1';btn.style.pointerEvents='auto';}
}

function startPlStep(step) {
  const pMap={2:'plPasseDefPicker',3:'plTirDefPicker',4:'plTirAttPicker'};
  const tMap={2:'plPasseDefTest',  3:'plTirDefTest',  4:'plTirAttTest'};
  const lMap={2:'plPasseDefLabel', 3:'plTirDefLabel', 4:'plTirAttLabel'};
  const cMap={2:'passeDef',3:'tirDef',4:'tirAtt'};
  if(pMap[step]) document.getElementById(pMap[step]).style.display='none';
  if(tMap[step]) document.getElementById(tMap[step]).style.display='block';
  if(lMap[step]) document.getElementById(lMap[step]).textContent='▶ '+plData.choices[cMap[step]];
}

function startReact() {
  document.getElementById('plReactStart').style.display='none';
  document.getElementById('plReactTest').style.display='block';
  showNextReact();
}

function showNextReact() {
  if(reactIdx<reactQueue.length){
    const a=reactQueue[reactIdx];
    document.getElementById('plReactZone').textContent=a.zone;
    document.getElementById('plReactAction').textContent=a.action;
  }
}

function plRecord(step, success) {
  if(plData.tries[step]>=20) return;
  plData.tries[step]++;
  if(success) plData.scores[step]++;
  const pct=Math.round(plData.tries[step]/20*100);
  const c=document.getElementById('plcount'+step); if(c) c.textContent=plData.tries[step];
  const b=document.getElementById('plbar'+step);   if(b) b.style.width=pct+'%';
  const labels=['Réussites','Réussites','Réussites','Buts','Buts','Réussites'];
  const s=document.getElementById('plscore'+step); if(s) s.textContent=labels[step]+' : '+plData.scores[step];
  if(step===5){ reactIdx++; if(plData.tries[5]<20) showNextReact(); }
  if(plData.tries[step]>=20) setTimeout(()=>plNextStep(step),500);
}

function plNextStep(step) {
  document.getElementById('plstep'+step)?.classList.remove('active');
  const dot=document.getElementById('pldot'+step); if(dot){dot.classList.remove('active');dot.classList.add('done');}
  const next=step+1;
  document.getElementById('plstep'+next)?.classList.add('active');
  document.getElementById('pldot'+next)?.classList.add('active');
  document.getElementById('placementOverlay').scrollTo({top:0,behavior:'smooth'});
  if(next===6) showPlacementResult();
}

function showPlacementResult() {
  const pcts = plData.scores.map((s,i)=>plData.tries[i]>0?Math.round(s/plData.tries[i]*100):0);
  const weights=[0.20,0.20,0.15,0.15,0.20,0.10];
  const globalScore = pcts.reduce((sum,p,i)=>sum+p*weights[i],0);
  const passAvg=(pcts[0]+pcts[1]+pcts[2])/3;
  const capped = passAvg<25 ? Math.min(globalScore,34) : globalScore;
  let leagueIdx=0;
  LEAGUES.forEach((l,i)=>{ if(capped>=l.minScore) leagueIdx=i; });
  const league=LEAGUES[leagueIdx];
  const nextMin=leagueIdx<LEAGUES.length-1?LEAGUES[leagueIdx+1].minScore:100;
  const rangeSize=Math.max(1,nextMin-league.minScore);
  const divFraction=Math.min(1,(capped-league.minScore)/rangeSize);
  const division=Math.max(1,Math.min(league.divisions,Math.ceil((1-divFraction)*league.divisions)));
  document.getElementById('plResultBadge').textContent=league.emoji;
  document.getElementById('plResultLeague').textContent=league.name;
  document.getElementById('plResultLeague').style.color=league.color;
  document.getElementById('plResultDiv').textContent='Division '+['I','II','III'][division-1];
  document.getElementById('plResultScore').textContent='Score global : '+Math.round(capped)+'%';
  const names=['Passe Bande','Passe Croisée','Passe Déf. ('+plData.choices.passeDef+')','Tir Déf. ('+plData.choices.tirDef+')','Tir Att. ('+plData.choices.tirAtt+')','Réactivité'];
  document.getElementById('plResultCards').innerHTML=pcts.map((p,i)=>`
    <div class="pl-result-card">
      <div class="pl-result-label">${names[i]}</div>
      <div class="pl-result-pct" style="color:${p>=70?'#00E676':p>=40?'#FF9500':'#FF3B30'}">${p}%</div>
    </div>`).join('');
  const lp=Math.round(divFraction*100)%100;
  const attIdx=Math.max(0,Math.min(leagueIdx,Math.round(leagueIdx*(pcts[4]/100))));
  const defIdx=Math.max(0,Math.min(leagueIdx,Math.round(leagueIdx*(pcts[2]/100))));
  DB.set('placement',{leagueIdx,division,lp,globalScore:Math.round(capped),pcts,choices:plData.choices,date:Date.now()});
  DB.set('rankGlobal',{leagueIdx,division,lp});
  DB.set('rankAttack',{leagueIdx:attIdx,division:Math.min(3,league.divisions),lp:40});
  DB.set('rankDefense',{leagueIdx:defIdx,division:Math.min(3,league.divisions),lp:40});
}

function confirmPlacement() {
  document.getElementById('placementOverlay').classList.remove('open');
  renderLeague(); renderDashboard();
  addXP(100,'Test de placement complété !');
  checkBadges();
}

function renderLeague() {
  const el=document.getElementById('leagueContent'); if(!el) return;
  const rankG=DB.get('rankGlobal');
  const rankA=DB.get('rankAttack');
  const rankD=DB.get('rankDefense');
  const validated=DB.get('validated');
  if(!rankG){
    el.innerHTML=`<div style="text-align:center;padding:40px 20px;">
      <div style="font-size:64px;margin-bottom:16px;">🎯</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:var(--text-primary);margin-bottom:8px;">TEST DE PLACEMENT</div>
      <div style="font-size:14px;color:var(--text-secondary);margin-bottom:24px;">Détermine ta ligue de départ en 15 minutes.</div>
      <button type="button" class="btn-primary" onclick="openPlacement()">Commencer le test →</button>
    </div>`; return;
  }
  const lg=LEAGUES[rankG.leagueIdx];
  const la=LEAGUES[rankA?rankA.leagueIdx:0];
  const ld=LEAGUES[rankD?rankD.leagueIdx:0];
  const dn=['I','II','III'];
  const placement=DB.get('placement')||{};
  const seasonEnd=(placement.date||Date.now())+90*24*3600*1000;
  const daysLeft=Math.max(0,Math.ceil((seasonEnd-Date.now())/(24*3600*1000)));
  const valLabel=validated?(typeof validated==='object'?validated.label:validated):null;
  const valPhoto=validated&&typeof validated==='object'?validated.photo:null;
  el.innerHTML=`
  <div class="section-title">Rang Global</div>
  <div class="league-card" style="border:1px solid ${lg.color}40;">
    <span class="league-badge-big">${lg.emoji}</span>
    <div class="league-name" style="color:${lg.color}">${lg.name} ${dn[(rankG.division||1)-1]}</div>
    <div class="league-division">Score placement : ${placement.globalScore||'—'}%</div>
    <div class="league-points"><span>${rankG.lp||0} LP</span><span style="color:var(--text-muted)">/ 100</span></div>
    <div class="lp-bar"><div class="lp-fill" style="width:${rankG.lp||0}%;background:${lg.color}"></div></div>
  </div>
  <div class="${valLabel?'validation-banner validated':'validation-banner unvalidated'}">
    <span>${valLabel?'✅':'⚪'}</span>
    <span>${valLabel?'Homologué — '+valLabel:'Non homologué — compétition réelle requise'}</span>
  </div>
  ${valPhoto?`<div style="margin-bottom:8px;border-radius:6px;overflow:hidden;border:1px solid var(--green);"><img src="${valPhoto}" style="width:100%;max-height:150px;object-fit:contain;background:#000;" alt="Preuve"></div>`:''}
  <button type="button" class="validate-btn" onclick="openModal('validateModal')">🏆 ${valLabel?'Mettre à jour':'Homologuer mon rang'}</button>
  <div class="section-title" style="margin-top:4px;">Spécialisations</div>
  <div class="ranks-grid">
    <div class="rank-mini"><div class="rank-mini-icon">${lg.emoji}</div><div class="rank-mini-label">Global</div><div class="rank-mini-val">${lg.name}</div><div class="rank-mini-div">${dn[(rankG.division||1)-1]}</div></div>
    <div class="rank-mini"><div class="rank-mini-icon">${la.emoji}</div><div class="rank-mini-label">Attaque</div><div class="rank-mini-val">${la.name}</div><div class="rank-mini-div">${dn[(rankA?.division||1)-1]}</div></div>
    <div class="rank-mini"><div class="rank-mini-icon">${ld.emoji}</div><div class="rank-mini-label">Défense</div><div class="rank-mini-val">${ld.name}</div><div class="rank-mini-div">${dn[(rankD?.division||1)-1]}</div></div>
  </div>
  <div class="section-title">Saison</div>
  <div class="season-card"><div class="season-label">Temps restant</div><div class="season-val">${daysLeft} jours</div><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Promotion / Maintien / Relégation à la fin</div></div>
  <button type="button" class="add-exercise-btn" style="margin-top:8px;" onclick="openPlacement()">🔄 Refaire le test de placement</button>`;
}

function updateLeagueFromTraining(pct) {
  const rank=DB.get('rankGlobal'); if(!rank) return;
  const gain=pct>=70?3:pct>=50?1:-1;
  rank.lp=Math.min(100,Math.max(0,(rank.lp||0)+gain));
  if(rank.lp>=100){
    if(rank.division>1){rank.division--;rank.lp=0;}
    else if(rank.leagueIdx<LEAGUES.length-1){rank.leagueIdx++;rank.division=LEAGUES[rank.leagueIdx].divisions;rank.lp=0;}
  }
  if(rank.lp<=0&&rank.leagueIdx>0){
    if(rank.division<LEAGUES[rank.leagueIdx].divisions){rank.division++;rank.lp=75;}
    else{rank.leagueIdx--;rank.division=1;rank.lp=75;}
  }
  DB.set('rankGlobal',rank);
}

function openModal(id){ document.getElementById(id)?.classList.add('open'); }
function closeModal(id){ document.getElementById(id)?.classList.remove('open'); }

function handleValPhoto(inp) {
  const file=inp.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    const prev=document.getElementById('valPhotoPreview');
    prev.src=e.target.result; prev.style.display='block';
    document.getElementById('valPhotoText').style.display='none';
    window._valPhotoData=e.target.result;
  };
  reader.readAsDataURL(file);
}

function confirmValidation() {
  const type=document.getElementById('valType').value;
  const details=document.getElementById('valDetails').value.trim();
  const date=document.getElementById('valDate').value;
  if(!details) return;
  DB.set('validated',{label:type+' — '+details+(date?' ('+date+')':''),photo:window._valPhotoData||null,date});
  window._valPhotoData=null;
  document.getElementById('valPhotoPreview').style.display='none';
  document.getElementById('valPhotoText').style.display='block';
  closeModal('validateModal');
  renderLeague();
  addXP(200,'Rang homologué ! 🏆');
  checkBadges();
}

function resetAll() {
  if(!confirm('Effacer toutes les données et recommencer à zéro ?')) return;
  ['profile','xp','exercises','history','matchStats','trainStats','placement','rankGlobal','rankAttack','rankDefense','validated','badges','objectives','videoSessions','coachProgram'].forEach(k=>localStorage.removeItem('bfc_'+k));
  document.getElementById('placementOverlay').classList.remove('open');
  document.getElementById('app').classList.remove('visible');
  document.getElementById('onboarding').style.display='block';
  document.getElementById('onboarding').scrollTo({top:0});
  document.querySelectorAll('.ob-step').forEach(s=>s.classList.remove('active'));
  document.getElementById('step0').classList.add('active');
  document.querySelectorAll('.ob-dot').forEach(d=>d.classList.remove('active'));
  document.getElementById('dot0').classList.add('active');
}
