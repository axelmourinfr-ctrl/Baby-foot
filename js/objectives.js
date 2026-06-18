// ══════════════════════════════════════════
// OBJECTIVES
// ══════════════════════════════════════════
const DEFAULT_OBJECTIVES = {
  daily:[
    {id:'d1',title:'Faire 1 session d\'entraînement',period:'daily',xp:20,done:false,createdAt:Date.now()},
    {id:'d2',title:'Jouer 1 match',period:'daily',xp:15,done:false,createdAt:Date.now()},
  ],
  weekly:[
    {id:'w1',title:"5 sessions d'entraînement",period:'weekly',xp:50,done:false,createdAt:Date.now()},
    {id:'w2',title:'Marquer 20 buts en exercice',period:'weekly',xp:40,done:false,createdAt:Date.now()},
  ],
  monthly:[
    {id:'m1',title:'Réussir 500 passes',period:'monthly',xp:100,done:false,createdAt:Date.now()},
    {id:'m2',title:'Jouer 10 matchs',period:'monthly',xp:80,done:false,createdAt:Date.now()},
  ],
  custom:[]
};

let currentObjTab='daily';

function switchObjTab(tab, el) {
  currentObjTab=tab;
  document.querySelectorAll('.obj-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderObjectives();
}

function renderObjectives() {
  const objectives=DB.get('objectives')||DEFAULT_OBJECTIVES;
  const list=objectives[currentObjTab]||[];
  const el=document.getElementById('objList'); if(!el) return;
  if(!list.length){
    el.innerHTML=`<div class="empty-state"><div class="empty-state-icon">🎯</div><div class="empty-state-text">Aucun objectif — ajoutes-en un !</div></div>`;
    return;
  }
  const pLabel={daily:"Aujourd'hui",weekly:'Cette semaine',monthly:'Ce mois',custom:'Personnalisé'};
  el.innerHTML=list.map(obj=>`
    <div class="obj-item ${obj.done?'done':''}">
      <div class="obj-check">${obj.done?'✓':''}</div>
      <div class="obj-info">
        <div class="obj-title">${obj.title}</div>
        <div class="obj-meta">${obj.autoCompleted?'✅ Complété automatiquement':pLabel[obj.period]||''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div class="obj-xp">+${obj.xp} XP</div>
        <div style="font-size:10px;color:var(--text-muted);cursor:pointer;" onclick="deleteObj('${obj.id}','${currentObjTab}')">✕</div>
      </div>
    </div>`).join('');
}

function deleteObj(id, tab) {
  const objectives=DB.get('objectives')||DEFAULT_OBJECTIVES;
  objectives[tab]=(objectives[tab]||[]).filter(o=>o.id!==id);
  DB.set('objectives',objectives);
  renderObjectives();
}

function openAddObj() {
  document.getElementById('newObjTitle').value='';
  document.getElementById('newObjXP').value='50';
  document.getElementById('newObjPeriod').value=currentObjTab;
  document.getElementById('addObjModal').classList.add('open');
}

function confirmAddObj() {
  const title=document.getElementById('newObjTitle').value.trim();
  const period=document.getElementById('newObjPeriod').value;
  const xp=parseInt(document.getElementById('newObjXP').value)||50;
  if(!title) return;
  const objectives=DB.get('objectives')||DEFAULT_OBJECTIVES;
  if(!objectives[period]) objectives[period]=[];
  objectives[period].push({id:'obj_'+Date.now(),title,period,xp,done:false,createdAt:Date.now()});
  DB.set('objectives',objectives);
  closeModal('addObjModal');
  currentObjTab=period;
  renderObjectives();
}

// ══════════════════════════════════════════
// CHARTS
// ══════════════════════════════════════════
function drawChart(canvasId, data, color) {
  const canvas=document.getElementById(canvasId); if(!canvas||data.length<2) return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width=canvas.offsetWidth; const H=canvas.height=120;
  ctx.clearRect(0,0,W,H);
  const max=Math.max(...data,1);
  const pad={t:10,b:20,l:10,r:10};
  const cw=W-pad.l-pad.r; const ch=H-pad.t-pad.b;
  ctx.strokeStyle='#1E2D40'; ctx.lineWidth=1;
  [0,0.5,1].forEach(f=>{ const y=pad.t+ch*(1-f); ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke(); });
  const pts=data.map((v,i)=>({x:pad.l+(i/(data.length-1))*cw,y:pad.t+ch*(1-v/max)}));
  ctx.beginPath();ctx.moveTo(pts[0].x,H-pad.b);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.lineTo(pts[pts.length-1].x,H-pad.b);ctx.closePath();
  const g=ctx.createLinearGradient(0,pad.t,0,H);g.addColorStop(0,color+'55');g.addColorStop(1,color+'00');
  ctx.fillStyle=g;ctx.fill();
  ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
  ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.stroke();
  pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();});
}

function renderCharts() {
  const history=DB.get('history')||[];
  const trainHist=history.filter(h=>h.type==='training').slice(-14);
  const dayMap={};
  trainHist.forEach(h=>{ const d=new Date(h.ts).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit'}); dayMap[d]=(dayMap[d]||0)+(h.xp||0); });
  const dayData=Object.values(dayMap).slice(-7);
  setTimeout(()=>drawChart('chartXP',dayData.length>1?dayData:[0,0],'#C9A84C'),100);
  const passHist=history.filter(h=>h.type==='training'&&h.tried>0).slice(-10);
  const pctData=passHist.map(h=>h.ok&&h.tried?Math.round(h.ok/h.tried*100):0);
  setTimeout(()=>drawChart('chartPass',pctData.length>1?pctData:[0,0],'#00D4FF'),100);
}

// ══════════════════════════════════════════
// CAREER
// ══════════════════════════════════════════
function renderCareer() {
  const el=document.getElementById('careerContent'); if(!el) return;
  const career=DB.get('career')||{};
  el.innerHTML=`
    <div class="section-title" style="margin-bottom:4px">Mode Carrière</div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">Jalons de ta carrière baby-foot — de débutant à international.</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
    ${CAREER_MILESTONES.map(m=>{
      const done=career[m.id];
      return `<div class="obj-item ${done?'done':''}" style="cursor:pointer;" onclick="toggleCareer('${m.id}')">
        <div class="obj-check" style="font-size:20px;">${done?'✓':m.icon}</div>
        <div class="obj-info">
          <div class="obj-title">${m.label}</div>
          <div class="obj-meta">${m.desc}</div>
        </div>
        ${done?`<div style="font-size:11px;color:var(--green);font-family:'Barlow Condensed',sans-serif;font-weight:700;">ACCOMPLI</div>`:''}
      </div>`;
    }).join('')}
    </div>`;
}

function toggleCareer(id) {
  const career=DB.get('career')||{};
  if(!career[id]){
    career[id]=Date.now();
    DB.set('career',career);
    addXP(150,'Jalon carrière : '+CAREER_MILESTONES.find(m=>m.id===id)?.label);
    showToast('🏆 Jalon accompli !','#1A2A00');
  }
  renderCareer();
}
