// ══════════════════════════════════════════
// COACH IA RÉEL — via Gemini (proxy Supabase Edge Function)
// ══════════════════════════════════════════

const EDGE_FUNCTION_URL = 'https://qpnuiyzovxtvldmbelnk.supabase.co/functions/v1/coach-ia';

function initCoachIA() {
  const el = document.getElementById('coachIAContent');
  if (!el) return;

  const profile = DB.get('profile') || {};
  const xp = DB.get('xp') || 0;
  const rankG = DB.get('rankGlobal');
  const league = rankG ? LEAGUES[rankG.leagueIdx] : null;
  const trainStats = DB.get('trainStats') || {};
  const history = DB.get('history') || [];

  let totalPasses=0,totalPassOk=0,totalGoals=0,totalGoalTried=0,totalSaves=0;
  Object.values(trainStats).forEach(ex => {
    if(ex.type==='passes'){ totalPasses+=ex.tried||0; totalPassOk+=ex.ok||0; }
    if(ex.type==='goals'){ totalGoalTried+=ex.tried||0; totalGoals+=ex.ok||0; }
    if(ex.type==='saves'){ totalSaves+=ex.ok||0; }
  });
  const passePct = totalPasses>0 ? Math.round(totalPassOk/totalPasses*100) : null;
  const tirPct = totalGoalTried>0 ? Math.round(totalGoals/totalGoalTried*100) : null;
  const sessions7 = history.filter(h=>h.type==='training'&&Date.now()-h.ts<7*24*3600*1000).length;

  const savedProgram = DB.get('coachProgram');

  el.innerHTML = `
    <div class="section-title" style="margin-bottom:4px">Coach IA</div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">Analyse personnalisée basée sur tes vraies données.</div>

    <div class="coach-card" style="margin-bottom:16px;">
      <div class="coach-card-head">
        <div class="coach-icon">📊</div>
        <div class="coach-card-title">Ton profil actuel</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div><span style="font-size:11px;color:var(--text-secondary);">LIGUE</span><br><strong style="color:var(--gold)">${league?league.emoji+' '+league.name:'—'}</strong></div>
        <div><span style="font-size:11px;color:var(--text-secondary);">SESSIONS / 7J</span><br><strong style="color:var(--gold)">${sessions7}</strong></div>
        <div><span style="font-size:11px;color:var(--text-secondary);">% PASSES</span><br><strong style="color:${passePct>=70?'#00E676':passePct>=40?'#FF9500':'#FF3B30'}">${passePct!==null?passePct+'%':'—'}</strong></div>
        <div><span style="font-size:11px;color:var(--text-secondary);">% TIRS</span><br><strong style="color:${tirPct>=70?'#00E676':tirPct>=40?'#FF9500':'#FF3B30'}">${tirPct!==null?tirPct+'%':'—'}</strong></div>
      </div>
    </div>

    <div class="section-title">Demande au Coach</div>
    <div class="coach-ia-input">
      <textarea id="coachQuestion" placeholder="Ex: Donne-moi un programme pour améliorer mes passes croisées... / Analyse mes points faibles... / Crée un plan pour atteindre Or..."></textarea>
    </div>
    <button type="button" class="btn-primary" onclick="askCoachIA()" style="margin-bottom:16px;">🤖 Analyser</button>

    <div class="coach-ia-loader" id="coachLoader">
      <div style="font-size:24px;margin-bottom:8px;">🤖</div>
      Analyse en cours...
    </div>
    <div class="coach-ia-response" id="coachResponse"></div>

    <div class="section-title" style="margin-top:8px;">Programme d'entraînement</div>
    <button type="button" class="qa-btn" style="width:100%;margin-bottom:8px;" onclick="generateProgram()">
      <div class="qa-btn-icon">📋</div>
      <div class="qa-btn-label">Générer un programme</div>
      <div class="qa-btn-sub">Semaine personnalisée selon tes stats</div>
    </button>
    <div class="coach-ia-loader" id="programLoader">
      <div style="font-size:24px;margin-bottom:8px;">📋</div>
      Génération du programme...
    </div>
    <div class="coach-ia-program" id="programContent">
      ${savedProgram ? renderProgram(savedProgram) : ''}
    </div>
  `;
  if(savedProgram) document.getElementById('programContent').classList.add('visible');
}

function buildPlayerContext() {
  const profile = DB.get('profile') || {};
  const xp = DB.get('xp') || 0;
  const rankG = DB.get('rankGlobal');
  const league = rankG ? LEAGUES[rankG.leagueIdx] : null;
  const trainStats = DB.get('trainStats') || {};
  const history = DB.get('history') || [];
  const placement = DB.get('placement') || {};

  let statsLines = [];
  Object.entries(trainStats).forEach(([id, ex]) => {
    if(ex.tried>0) {
      const pct = Math.round(ex.ok/ex.tried*100);
      statsLines.push('- '+id+': '+ex.tried+' tentatives, '+ex.ok+' réussites ('+pct+'%)');
    }
  });

  const sessions7 = history.filter(h=>h.type==='training'&&Date.now()-h.ts<7*24*3600*1000).length;
  const matches = history.filter(h=>h.type==='match').length;

  return `PROFIL JOUEUR:
Nom: ${profile.name||'—'}
Poste: ${profile.pos||'—'}, Main: ${profile.hand||'—'}
Niveau auto-évalué: ${profile.level||'—'}
Ligue actuelle: ${league?league.emoji+' '+league.name+' Div '+['I','II','III'][(rankG.division||1)-1]:'Non placé'}
XP total: ${xp}
Sessions 7 derniers jours: ${sessions7}
Matchs joués: ${matches}

STATISTIQUES D'ENTRAÎNEMENT:
${statsLines.length>0?statsLines.join('\\n'):'Aucune donnée encore'}

SCORES TEST DE PLACEMENT:
${placement.pcts?['Passe Bande','Passe Croisée','Passe Défense','Tir Défense','Tirs Attaque','Réactivité'].map((n,i)=>n+': '+(placement.pcts[i]||0)+'%').join(', '):'—'}

Objectif déclaré: ${profile.goal||'—'}`;
}

async function callCoachAPI(systemPrompt, userMessage) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'apikey': SUPABASE_KEY
    },
    body: JSON.stringify({ systemPrompt, userMessage })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Erreur serveur: ' + errText);
  }
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}

async function askCoachIA() {
  const question = document.getElementById('coachQuestion')?.value.trim();
  if (!question) return;

  document.getElementById('coachLoader').classList.add('visible');
  document.getElementById('coachResponse').classList.remove('visible');
  document.getElementById('coachResponse').innerHTML = '';

  const context = buildPlayerContext();
  const systemPrompt = `Tu es un coach expert en baby-foot compétitif. Tu analyses les données réelles du joueur et donnes des conseils précis, concrets et motivants. Réponds en français, de façon structurée mais conversationnelle. Utilise **gras** pour les points importants. Maximum 300 mots.\n\n${context}\n\nQUESTION DU JOUEUR:`;

  try {
    const text = await callCoachAPI(systemPrompt, question);
    document.getElementById('coachLoader').classList.remove('visible');
    document.getElementById('coachResponse').classList.add('visible');
    document.getElementById('coachResponse').innerHTML = formatCoachText(text);
    addXP(5, 'Consultation coach IA');
  } catch(err) {
    document.getElementById('coachLoader').classList.remove('visible');
    document.getElementById('coachResponse').classList.add('visible');
    document.getElementById('coachResponse').innerHTML = '<p style="color:var(--red)">Erreur : '+err.message+'</p>';
  }
}

async function generateProgram() {
  document.getElementById('programLoader').classList.add('visible');
  document.getElementById('programContent').classList.remove('visible');

  const context = buildPlayerContext();
  const systemPrompt = `Tu es un coach expert en baby-foot compétitif. Génère un programme d'entraînement hebdomadaire personnalisé basé sur les données du joueur. Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans backticks, sans aucune explication avant ou après:
{"days":[{"day":"Lundi","focus":"Passes","exercises":[{"name":"Passe bande","reps":"3x20","note":"..."}],"tip":"..."}],"weekGoal":"...","motivation":"..."}
Génère exactement 7 jours. Adapte les exercices aux vrais points faibles du joueur identifiés dans son profil.\n\n${context}`;

  try {
    const text = await callCoachAPI(systemPrompt, 'Génère le programme.');
    const clean = text.replace(/```json|```/g,'').trim();
    let program;
    try { program = JSON.parse(clean); } catch(e) { throw new Error('Réponse invalide, réessaie.'); }
    DB.set('coachProgram', program);
    document.getElementById('programLoader').classList.remove('visible');
    document.getElementById('programContent').classList.add('visible');
    document.getElementById('programContent').innerHTML = renderProgram(program);
    addXP(10, 'Programme IA généré');
  } catch(err) {
    document.getElementById('programLoader').classList.remove('visible');
    document.getElementById('programContent').classList.add('visible');
    document.getElementById('programContent').innerHTML = '<p style="color:var(--red)">Erreur : '+err.message+'</p>';
  }
}

function renderProgram(program) {
  if (!program || !program.days) return '';
  return `
    <div style="background:rgba(201,168,76,0.1);border-radius:4px;padding:10px;margin-bottom:12px;font-size:13px;color:var(--gold);">
      🎯 ${program.weekGoal||''}
    </div>
    ${program.days.map(d=>`
      <div class="program-day">
        <div class="program-day-title">${d.day} — ${d.focus||''}</div>
        <div class="program-day-content">
          ${(d.exercises||[]).map(ex=>`<div>• <strong>${ex.name}</strong> ${ex.reps||''} ${ex.note?'— '+ex.note:''}</div>`).join('')}
          ${d.tip?`<div style="color:var(--cyan);margin-top:4px;">💡 ${d.tip}</div>`:''}
        </div>
      </div>
    `).join('')}
    <div style="margin-top:12px;font-size:13px;color:var(--text-secondary);font-style:italic;">${program.motivation||''}</div>
  `;
}

function formatCoachText(text) {
  return '<p>' + text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>') + '</p>';
}
