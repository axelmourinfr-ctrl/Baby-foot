// ══════════════════════════════════════════
// LEAGUE SYSTEM
// ══════════════════════════════════════════
let plData = {
  scores:[0,0,0,0,0,0,0], tries:[0,0,0,0,0,0,0], step:0,
  choices:{passeDef:'',tirDef:'',tirAtt1:'',tirAtt2:'',tirAtt3:''},
  results:[[],[],[],[],[],[],[]],  // detailed results per step
  table:'other',
  timerInterval:null, timerStart:null, timerLimit:35,
  waiting:true
};
let reactQueue = []; let reactIdx = 0;

function getPlTimerLimit(step, table) {
  // step 0,1 = passes milieu, step 2 = passe def, step 3 = tir def, step 4 = tirs att, step 5 = réactivité (mixte)
  // Le bouton "Prêt" gère déjà le temps de manipulation (récupérer/replacer la balle).
  // Une fois "Prêt" pressé, c'est le vrai temps de jeu réglementaire :
  if(table === 'jupiter') return 15; // Jupiter : 15 sec partout, toujours
  if(step === 0 || step === 1 || step === 2) return 10; // Milieu (passes bande/croisée/défense) autres tables : 10 sec
  return 15; // Attaque, défense (tirs) et réactivité (mix de zones) autres tables : 15 sec
}

function openPlacement() {
  // Reset state
  plData = {
    scores:[0,0,0,0,0,0], tries:[0,0,0,0,0,0], step:-1,
    choices:{passeDef:'',tirDef:'',tirAtt1:'',tirAtt2:'',tirAtt3:''},
    results:[[],[],[],[],[],[]], table:'other',
    timerInterval:null, timerStart:null, timerLimit:35, waiting:true,
    tirAttQueue:[], tirAttCurrent:0, tirAttPerShot:{}
  };
  reactQueue=[...REACT_ACTIONS].sort(()=>Math.random()-0.5);
  reactIdx=0;

  // Reset all steps
  for(let i=-1;i<=6;i++) document.getElementById('plstep'+i)?.classList.remove('active');
  for(let i=0;i<6;i++){ const d=document.getElementById('pldot'+i); if(d){d.classList.remove('done','active');} }

  // Reset pickers (step 3 et 4 uniquement, step 2 = passe simple sans choix)
  ['plTirDefPicker','plTirAttPicker'].forEach(id=>{
    const e=document.getElementById(id); if(e) e.style.display='block';
  });
  [0,1,2,3,4,5].forEach(i=>{ const e=document.getElementById('plContent'+i); if(e){e.style.display='none';e.innerHTML='';} });
  const rs=document.getElementById('plReactStart'); if(rs) rs.style.display='block';
  document.querySelectorAll('.pl-tir-opt').forEach(o=>o.classList.remove('selected'));
  ['plTirDefStart','plTirAttStart'].forEach(id=>{
    const b=document.getElementById(id); if(b){b.style.opacity='0.4';b.style.pointerEvents='none';}
  });
  document.getElementById('plTirAttSelected').textContent='0/3 sélectionnés';
  window._plTirAttSelected = [];

  // Reset table selection
  document.getElementById('table-jupiter')?.classList.remove('selected');
  document.getElementById('table-other')?.classList.add('selected');

  document.getElementById('plstep-1').classList.add('active');
  document.getElementById('placementOverlay').classList.add('open');
  document.getElementById('placementOverlay').scrollTo({top:0});
}

function selectPlTable(table) {
  plData.table = table;
  document.getElementById('table-jupiter').classList.toggle('selected', table==='jupiter');
  document.getElementById('table-other').classList.toggle('selected', table==='other');
}

function startPlacement() {
  document.getElementById('plstep-1').classList.remove('active');
  document.getElementById('pldot0').classList.add('active');
  document.getElementById('plstep0').classList.add('active');
  plData.step = 0;
  renderPlStep(0);
  document.getElementById('placementOverlay').scrollTo({top:0,behavior:'smooth'});
}

function renderPlStep(step) {
  const limit = getPlTimerLimit(step, plData.table);
  plData.timerLimit = limit;
  const contentEl = document.getElementById('plContent'+step);
  if(!contentEl) return;
  contentEl.style.display='block';
  contentEl.innerHTML = renderPlTimer(step);
}

function renderPlTimer(step) {
  const s = plData;
  const results = s.results[step] || [];
  const total = step === 4 ? 30 : 20;
  const done = results.length;
  const successes = results.filter(r=>r.success).length;
  const pct = done > 0 ? Math.round(successes/done*100) : 0;

  const dots = Array(total).fill(null).map((_,i) => {
    if(i >= done) return `<div style="width:10px;height:10px;border-radius:50%;background:var(--border);display:inline-block;margin:1px;"></div>`;
    const r = results[i];
    const color = !r.success ? 'var(--red)' : r.penalty ? '#FF9500' : 'var(--green)';
    return `<div style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;margin:1px;"></div>`;
  }).join('');

  // For step 4 (3 tirs), show which shot is up next from the shuffled queue
  let shotLabel = '';
  if(step === 4 && plData.tirAttQueue) {
    const shotName = plData.tirAttQueue[done]; // le tir à exécuter MAINTENANT, lu dans la queue mélangée
    if(shotName) {
      const doneForThisShot = plData.tirAttPerShot[shotName] ? plData.tirAttPerShot[shotName].tried : 0;
      shotLabel = `<div style="font-size:14px;color:var(--cyan);margin-bottom:8px;">Prochain tir : <strong style="color:var(--gold);">${shotName}</strong> <span style="color:var(--text-muted);">(${doneForThisShot+1}/10 pour ce tir)</span></div>`;
    }
  }

  if(s.waiting) {
    return `
      <div style="text-align:center;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px;">
          <span>${done}/${total}</span><span>${successes} réussites · ${pct}%</span>
        </div>
        <div style="text-align:center;margin-bottom:10px;">${dots}</div>
        ${shotLabel}
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
          ${done===0?'Place ta balle et prépare-toi':'Replace la balle · tentative '+(done+1)+'/'+total}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">
          ⏱️ <strong style="color:var(--gold);">${s.timerLimit} sec</strong> démarrent au "Prêt !"
        </div>
        <button type="button" onclick="plReady(${step})" style="width:100%;padding:18px;background:var(--green);border:none;color:#000;font-size:22px;font-weight:900;letter-spacing:2px;text-transform:uppercase;border-radius:8px;cursor:pointer;">
          ✋ PRÊT !
        </button>
      </div>`;
  } else {
    return `
      <div style="text-align:center;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px;">
          <span>${done}/${total}</span><span>${successes} réussites · ${pct}%</span>
        </div>
        <div style="text-align:center;margin-bottom:10px;">${dots}</div>
        ${shotLabel}
        <div style="background:var(--bg-surface);border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;letter-spacing:2px;text-transform:uppercase;">TEMPS RESTANT</div>
          <div id="pl-timer-val-${step}" style="font-size:56px;font-weight:900;color:var(--gold);line-height:1;">${s.timerLimit}</div>
          <div style="height:6px;background:var(--border);border-radius:3px;margin-top:8px;overflow:hidden;">
            <div id="pl-timer-bar-${step}" style="height:100%;background:var(--green);border-radius:3px;width:100%;"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button type="button" onclick="plRecord(${step},true)" style="padding:18px;background:rgba(0,230,118,0.1);border:2px solid var(--green);border-radius:8px;color:var(--green);font-size:22px;font-weight:900;cursor:pointer;">✓</button>
          <button type="button" onclick="plRecord(${step},false)" style="padding:18px;background:rgba(255,59,48,0.1);border:2px solid var(--red);border-radius:8px;color:var(--red);font-size:22px;font-weight:900;cursor:pointer;">✗</button>
        </div>
      </div>`;
  }
}

function plReady(step) {
  plData.waiting = false;
  plData.timerStart = Date.now();
  clearInterval(plData.timerInterval);

  plData.timerInterval = setInterval(() => {
    const elapsed = (Date.now() - plData.timerStart) / 1000;
    const remaining = Math.max(0, plData.timerLimit - elapsed);
    const pct = (remaining / plData.timerLimit) * 100;
    const valEl = document.getElementById('pl-timer-val-'+step);
    const barEl = document.getElementById('pl-timer-bar-'+step);
    if(valEl) {
      valEl.textContent = Math.ceil(remaining);
      valEl.style.color = remaining > plData.timerLimit*0.5 ? 'var(--gold)' : remaining > plData.timerLimit*0.25 ? '#FF9500' : 'var(--red)';
    }
    if(barEl) {
      barEl.style.width = pct+'%';
      barEl.style.background = remaining > plData.timerLimit*0.5 ? 'var(--green)' : remaining > plData.timerLimit*0.25 ? '#FF9500' : 'var(--red)';
    }
    if(remaining <= 0) {
      clearInterval(plData.timerInterval);
      if(navigator.vibrate) navigator.vibrate([100,50,100]);
    }
  }, 100);

  const contentEl = document.getElementById('plContent'+step);
  if(contentEl) contentEl.innerHTML = renderPlTimer(step);
}

function selectPlChoice(type, el, name) {
  el.closest('.pl-tir-grid').querySelectorAll('.pl-tir-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected'); plData.choices[type]=name;
  const btnMap={tirDef:'plTirDefStart'};
  const btn=document.getElementById(btnMap[type]); if(btn){btn.style.opacity='1';btn.style.pointerEvents='auto';}
}

function selectPlTirAtt(el, name) {
  if(!window._plTirAttSelected) window._plTirAttSelected = [];
  if(el.classList.contains('selected')) {
    el.classList.remove('selected');
    window._plTirAttSelected = window._plTirAttSelected.filter(n=>n!==name);
  } else {
    if(window._plTirAttSelected.length >= 3) return; // max 3
    el.classList.add('selected');
    window._plTirAttSelected.push(name);
  }
  const count = window._plTirAttSelected.length;
  document.getElementById('plTirAttSelected').textContent = count+'/3 sélectionnés — '+window._plTirAttSelected.join(', ');
  const btn = document.getElementById('plTirAttStart');
  if(btn){ btn.style.opacity=count===3?'1':'0.4'; btn.style.pointerEvents=count===3?'auto':'none'; }
}

function startPlTirAtt() {
  // Build queue: 10 of each, shuffled together
  plData.choices.tirAtt1 = window._plTirAttSelected[0];
  plData.choices.tirAtt2 = window._plTirAttSelected[1];
  plData.choices.tirAtt3 = window._plTirAttSelected[2];
  // Create ordered queue: 10x each, randomized
  const queue = [];
  window._plTirAttSelected.forEach(shot => { for(let i=0;i<10;i++) queue.push(shot); });
  plData.tirAttQueue = queue.sort(()=>Math.random()-0.5);
  plData.tirAttPerShot = {};
  window._plTirAttSelected.forEach(s => plData.tirAttPerShot[s] = {ok:0,tried:0});

  document.getElementById('plTirAttPicker').style.display='none';
  document.getElementById('plContent4').style.display='block';
  plData.waiting = true;
  document.getElementById('plContent4').innerHTML = renderPlTimer(4);
}

function startPlStep(step) {
  const pMap={2:'plPasseDefPicker',3:'plTirDefPicker'};
  if(pMap[step]) document.getElementById(pMap[step]).style.display='none';
  document.getElementById('plContent'+step).style.display='block';
  plData.waiting = true;
  renderPlStep(step);
}

function plRecord(step, success) {
  clearInterval(plData.timerInterval);
  const total = step === 4 ? 30 : 20;
  if(!plData.results[step]) plData.results[step] = [];
  if(plData.results[step].length >= total) return;

  const elapsed = plData.timerStart ? (Date.now()-plData.timerStart)/1000 : 0;
  const penalty = elapsed > plData.timerLimit;

  plData.results[step].push({ success, penalty, time:Math.round(elapsed*10)/10 });
  plData.tries[step]++;
  if(success) plData.scores[step]++;

  // Track per-shot stats for tir att
  if(step === 4 && plData.tirAttQueue) {
    const shotName = plData.tirAttQueue[plData.results[step].length-1];
    if(shotName && plData.tirAttPerShot[shotName]) {
      plData.tirAttPerShot[shotName].tried++;
      if(success) plData.tirAttPerShot[shotName].ok++;
    }
  }

  // Update dot indicators
  const dotEl = document.getElementById('pldot'+step);

  plData.waiting = true;
  plData.timerStart = null;

  if(plData.results[step].length >= total) {
    setTimeout(()=>plNextStep(step), 400);
  } else {
    const contentEl = document.getElementById('plContent'+step);
    if(contentEl) contentEl.innerHTML = renderPlTimer(step);
  }
}

function startReact() {
  document.getElementById('plReactStart').style.display='none';
  document.getElementById('plContent5').style.display='block';
  plData.waiting = true;
  renderReactStep();
}

function renderReactStep() {
  const done = plData.results[5]?.length || 0;
  const successes = plData.results[5]?.filter(r=>r.success).length || 0;
  const action = reactQueue[reactIdx];
  const dots = Array(20).fill(null).map((_,i) => {
    if(i >= done) return `<div style="width:10px;height:10px;border-radius:50%;background:var(--border);display:inline-block;margin:1px;"></div>`;
    const r = plData.results[5][i];
    return `<div style="width:10px;height:10px;border-radius:50%;background:${r.success?'var(--green)':'var(--red)'};display:inline-block;margin:1px;"></div>`;
  }).join('');

  document.getElementById('plContent5').innerHTML = `
    <div style="text-align:center;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px;">
        <span>${done}/20</span><span>${successes} réussites</span>
      </div>
      <div style="text-align:center;margin-bottom:10px;">${dots}</div>
      ${plData.waiting && action ? `
        <div style="background:var(--bg-card);border:2px solid var(--gold);border-radius:8px;padding:20px;text-align:center;margin-bottom:16px;">
          <div style="font-size:11px;color:var(--text-muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">${action.zone}</div>
          <div style="font-size:24px;font-weight:900;color:var(--gold);">${action.action}</div>
        </div>
        <button type="button" onclick="plReactReady()" style="width:100%;padding:16px;background:var(--green);border:none;color:#000;font-size:20px;font-weight:900;text-transform:uppercase;border-radius:8px;cursor:pointer;">✋ PRÊT !</button>
      ` : `
        <div style="background:var(--bg-card);border:2px solid var(--gold);border-radius:8px;padding:20px;text-align:center;margin-bottom:12px;">
          <div style="font-size:11px;color:var(--text-muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;" id="plReactZone">${action?.zone||''}</div>
          <div style="font-size:24px;font-weight:900;color:var(--gold);" id="plReactAction">${action?.action||''}</div>
        </div>
        <div style="background:var(--bg-surface);border-radius:6px;padding:10px;margin-bottom:12px;">
          <div id="pl-timer-val-5" style="font-size:40px;font-weight:900;color:var(--gold);text-align:center;">${plData.timerLimit}</div>
          <div style="height:4px;background:var(--border);border-radius:2px;margin-top:6px;overflow:hidden;">
            <div id="pl-timer-bar-5" style="height:100%;background:var(--green);border-radius:2px;width:100%;"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button type="button" onclick="plRecord(5,true)" style="padding:16px;background:rgba(0,230,118,0.1);border:2px solid var(--green);border-radius:8px;color:var(--green);font-size:22px;font-weight:900;cursor:pointer;">✓</button>
          <button type="button" onclick="plRecord(5,false)" style="padding:16px;background:rgba(255,59,48,0.1);border:2px solid var(--red);border-radius:8px;color:var(--red);font-size:22px;font-weight:900;cursor:pointer;">✗</button>
        </div>
      `}
    </div>`;
}

function plReactReady() {
  plData.waiting = false;
  plData.timerStart = Date.now();
  plData.timerLimit = getPlTimerLimit(5, plData.table); // réactivité = temps "milieu" car actions variées
  clearInterval(plData.timerInterval);
  const limit = plData.timerLimit;
  plData.timerInterval = setInterval(() => {
    const elapsed = (Date.now()-plData.timerStart)/1000;
    const remaining = Math.max(0, limit-elapsed);
    const pct = (remaining/limit)*100;
    const v=document.getElementById('pl-timer-val-5');
    const b=document.getElementById('pl-timer-bar-5');
    if(v){ v.textContent=Math.ceil(remaining); v.style.color=remaining>limit*0.5?'var(--gold)':remaining>limit*0.25?'#FF9500':'var(--red)'; }
    if(b){ b.style.width=pct+'%'; b.style.background=remaining>limit*0.5?'var(--green)':remaining>limit*0.25?'#FF9500':'var(--red)'; }
    if(remaining<=0) clearInterval(plData.timerInterval);
  }, 100);
  renderReactStep();
}

function plNextStep(step) {
  clearInterval(plData.timerInterval);
  const dot=document.getElementById('pldot'+step); if(dot){dot.classList.remove('active');dot.classList.add('done');}
  document.getElementById('plstep'+step)?.classList.remove('active');

  const next = step+1;
  if(next >= 6) { showPlacementResult(); return; }
  document.getElementById('pldot'+next)?.classList.add('active');
  document.getElementById('plstep'+next)?.classList.add('active');
  plData.step = next;
  plData.waiting = true;
  document.getElementById('placementOverlay').scrollTo({top:0,behavior:'smooth'});

  // Steps 0,1,2 (passe bande, passe croisée, passe défense) démarrent automatiquement, sans choix
  // Step 3 (tir défense) et 4 (3 tirs attaque) attendent un choix via leur picker
  // Step 5 (réactivité) attend le bouton "Commencer" de startReact()
  if(next <= 2) {
    renderPlStep(next);
  }
}

function getPlConstanceScore(results) {
  if(!results || results.length < 10) return 0;
  const first5 = results.slice(0,5).filter(r=>r.success).length;
  const last5  = results.slice(-5).filter(r=>r.success).length;
  if(last5 >= first5) return last5 < first5 ? 0 : 3;
  if(last5 < first5 - 2) return -5;
  return 0;
}

function showPlacementResult() {
  // Scores pondérés avec constance
  const steps = [0,1,2,3,4,5];
  const pcts = steps.map(i => {
    const results = plData.results[i] || [];
    const total = i===4?30:20;
    const ok = results.filter(r=>r.success).length;
    return results.length>0 ? Math.round(ok/results.length*100) : 0;
  });

  // Apply constance bonuses
  const adjustedPcts = pcts.map((p,i) => {
    const bonus = getPlConstanceScore(plData.results[i]);
    return Math.min(100, Math.max(0, p + bonus));
  });

  const weights=[0.20,0.20,0.15,0.15,0.20,0.10];
  const globalScore = adjustedPcts.reduce((sum,p,i)=>sum+p*weights[i],0);
  const passAvg=(adjustedPcts[0]+adjustedPcts[1]+adjustedPcts[2])/3;
  const capped=passAvg<25?Math.min(globalScore,34):globalScore;

  let leagueIdx=0; LEAGUES.forEach((l,i)=>{ if(capped>=l.minScore) leagueIdx=i; });
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

  const names=[
    'Passe Bande','Passe Croisée',
    'Passe Défense → Milieu',
    'Tir Déf. ('+plData.choices.tirDef+')',
    'Tirs Att. ('+[plData.choices.tirAtt1,plData.choices.tirAtt2,plData.choices.tirAtt3].filter(Boolean).join(', ')+')',
    'Réactivité'
  ];

  let resultHTML = pcts.map((p,i)=>{
    const bonus = getPlConstanceScore(plData.results[i]);
    return `<div class="pl-result-card">
      <div class="pl-result-label">${names[i]}</div>
      <div style="text-align:right;">
        <div class="pl-result-pct" style="color:${p>=70?'#00E676':p>=40?'#FF9500':'#FF3B30'}">${p}%</div>
        ${bonus!==0?`<div style="font-size:10px;color:${bonus>0?'var(--green)':'var(--red)'};">constance ${bonus>0?'+':''}${bonus}%</div>`:''}
      </div>
    </div>`;
  }).join('');

  // Per-shot breakdown for tir att
  if(Object.keys(plData.tirAttPerShot||{}).length > 0) {
    resultHTML += `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:12px;margin-top:8px;">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Détail tirs attaque</div>
      ${Object.entries(plData.tirAttPerShot).map(([shot,stats])=>`
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span style="color:var(--text-secondary);">${shot}</span>
          <span style="color:${stats.tried>0&&stats.ok/stats.tried>=0.7?'var(--green)':stats.tried>0&&stats.ok/stats.tried>=0.4?'#FF9500':'var(--red)'};">
            ${stats.ok}/${stats.tried} (${stats.tried>0?Math.round(stats.ok/stats.tried*100):0}%)
          </span>
        </div>`).join('')}
    </div>`;
  }

  document.getElementById('plResultCards').innerHTML = resultHTML;

  const lp=Math.round(divFraction*100)%100;
  const attIdx=Math.max(0,Math.min(leagueIdx,Math.round(leagueIdx*(adjustedPcts[4]/100))));
  const defIdx=Math.max(0,Math.min(leagueIdx,Math.round(leagueIdx*(adjustedPcts[2]/100))));
  const oldPl=DB.get('placement'); if(oldPl) DB.push('placementHistory',oldPl);
  DB.set('placement',{leagueIdx,division,lp,globalScore:Math.round(capped),pcts,adjustedPcts,choices:plData.choices,table:plData.table,date:Date.now()});
  DB.set('rankGlobal',{leagueIdx,division,lp});
  DB.set('rankAttack',{leagueIdx:attIdx,division:Math.min(3,league.divisions),lp:40});
  DB.set('rankDefense',{leagueIdx:defIdx,division:Math.min(3,league.divisions),lp:40});

  // Show result step
  for(let i=0;i<6;i++) document.getElementById('plstep'+i)?.classList.remove('active');
  document.getElementById('plstep6')?.classList.add('active');
  document.getElementById('placementOverlay').scrollTo({top:0,behavior:'smooth'});
}

function updateLeagueFromTraining(pct) {
  const rank=DB.get('rankGlobal'); if(!rank) return;
  const gain=pct>=70?3:pct>=50?1:-1;
  rank.lp=Math.min(100,Math.max(0,(rank.lp||0)+gain));
  if(rank.lp>=100){
    if(rank.division>1){rank.division--;rank.lp=0;}
    else if(rank.leagueIdx<LEAGUES.length-1){rank.leagueIdx++;rank.division=LEAGUES[rank.leagueIdx].divisions;rank.lp=0;showToast('🎉 Promotion ! '+LEAGUES[rank.leagueIdx].emoji+' '+LEAGUES[rank.leagueIdx].name,'#1A3A1A');}
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
  renderLeague(); addXP(200,'Rang homologué ! 🏆'); checkBadges();
}

function resetAll() {
  if(!confirm('Effacer toutes les données et recommencer à zéro ?')) return;
  ['profile','xp','exercises','history','matchStats','trainStats','placement','placementHistory','rankGlobal','rankAttack','rankDefense','validated','badges','missions','totalMissionsDone','videoSessions','coachProgram','career'].forEach(k=>localStorage.removeItem('bfc_'+k));
  document.getElementById('placementOverlay').classList.remove('open');
  document.getElementById('app').classList.remove('visible');
  document.getElementById('onboarding').style.display='block';
  document.getElementById('onboarding').scrollTo({top:0});
  document.querySelectorAll('.ob-step').forEach(s=>s.classList.remove('active'));
  document.getElementById('step0').classList.add('active');
  document.querySelectorAll('.ob-dot').forEach(d=>d.classList.remove('active'));
  document.getElementById('dot0').classList.add('active');
}
