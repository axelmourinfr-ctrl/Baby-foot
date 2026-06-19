// ══════════════════════════════════════════
// VIDEO SEMI-AUTOMATIQUE
// ══════════════════════════════════════════
let videoEvents = [];
let videoEl = null;

function initVideoScreen() {
  const el = document.getElementById('videoContent');
  if (!el) return;
  const sessions = DB.get('videoSessions') || [];
  el.innerHTML = `
    <div class="section-title" style="margin-bottom:4px">Analyse Vidéo</div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">Charge une vidéo et tape les événements en temps réel.</div>

    <div class="video-upload-zone" id="videoUploadZone">
      <input type="file" accept="video/*" id="videoFileInput" onchange="loadVideo(this)">
      <div style="font-size:32px;margin-bottom:8px;">🎬</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;color:var(--text-primary);">Charger une vidéo</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">MP4, MOV, AVI...</div>
    </div>

    <div id="videoAnalyzer" style="display:none;">
      <div class="video-player-wrap">
        <video id="videoPlayer" controls playsinline></video>
      </div>

      <div class="video-timeline">
        <div class="video-time" id="videoTime">0:00</div>
        <div class="video-event-grid">
          <button type="button" class="v-evt-btn passe" onclick="logEvent('Passe')">✋ Passe</button>
          <button type="button" class="v-evt-btn but" onclick="logEvent('But')">⚽ But</button>
          <button type="button" class="v-evt-btn arret" onclick="logEvent('Arrêt')">🧱 Arrêt</button>
          <button type="button" class="v-evt-btn tir" onclick="logEvent('Tir raté')">🎯 Tir raté</button>
          <button type="button" class="v-evt-btn relance" onclick="logEvent('Relance')">↩️ Relance</button>
          <button type="button" class="v-evt-btn erreur" onclick="logEvent('Erreur')">❌ Erreur</button>
        </div>
      </div>

      <div class="section-title">Événements (<span id="eventCount">0</span>)</div>
      <div class="video-events-log" id="videoLog">
        <div style="text-align:center;color:var(--text-muted);font-size:13px;padding:16px;">Aucun événement — lance la vidéo et tape les boutons</div>
      </div>

      <div class="video-stats-grid" id="videoStatsGrid"></div>

      <button type="button" class="btn-primary" onclick="saveVideoSession()" style="margin-bottom:8px;">💾 Sauvegarder la session</button>
      <button type="button" class="add-exercise-btn" onclick="resetVideo()">🎬 Charger une autre vidéo</button>
    </div>

    ${sessions.length > 0 ? `
    <div class="section-title" style="margin-top:16px;">Sessions analysées</div>
    ${sessions.slice(-5).reverse().map(s => `
      <div class="history-item">
        <div class="history-left">
          <div class="history-date">${new Date(s.date).toLocaleDateString('fr-BE')}</div>
          <div class="history-desc">${s.events.length} événements — ${s.duration}</div>
        </div>
        <div class="history-xp">+${s.xp} XP</div>
      </div>
    `).join('')}
    ` : ''}
  `;
  videoEvents = [];
}

function loadVideo(inp) {
  const file = inp.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  document.getElementById('videoUploadZone').style.display = 'none';
  document.getElementById('videoAnalyzer').style.display = 'block';
  videoEl = document.getElementById('videoPlayer');
  videoEl.src = url;
  videoEl.ontimeupdate = updateVideoTime;
  videoEvents = [];
  renderVideoLog();
}

function updateVideoTime() {
  if (!videoEl) return;
  const t = Math.floor(videoEl.currentTime);
  const m = Math.floor(t/60);
  const s = t % 60;
  document.getElementById('videoTime').textContent = m + ':' + String(s).padStart(2,'0');
}

function logEvent(type) {
  const time = videoEl ? videoEl.currentTime : 0;
  const m = Math.floor(time/60);
  const s = Math.floor(time % 60);
  videoEvents.push({ type, time, label: m+':'+String(s).padStart(2,'0'), id: Date.now() });
  renderVideoLog();
  // Visual flash
  document.getElementById('videoTime').style.color = '#00E676';
  setTimeout(() => { document.getElementById('videoTime').style.color = ''; }, 300);
}

function deleteEvent(id) {
  videoEvents = videoEvents.filter(e => e.id !== id);
  renderVideoLog();
}

function renderVideoLog() {
  document.getElementById('eventCount').textContent = videoEvents.length;
  const log = document.getElementById('videoLog');
  if (videoEvents.length === 0) {
    log.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:16px;">Aucun événement — lance la vidéo et tape les boutons</div>';
  } else {
    log.innerHTML = [...videoEvents].reverse().map(e => `
      <div class="v-event-item">
        <div class="v-event-time">${e.label}</div>
        <div class="v-event-type" style="color:${getEventColor(e.type)}">${e.type}</div>
        <div class="v-event-del" onclick="deleteEvent(${e.id})">✕</div>
      </div>
    `).join('');
  }
  renderVideoStats();
}

function getEventColor(type) {
  const colors = { 'Passe':'#00D4FF','But':'#00E676','Arrêt':'#C9A84C','Tir raté':'#FF9500','Relance':'#AA00FF','Erreur':'#FF3B30' };
  return colors[type] || '#7A8AA0';
}

function renderVideoStats() {
  const counts = {};
  videoEvents.forEach(e => { counts[e.type] = (counts[e.type]||0)+1; });
  const total = videoEvents.length;
  const grid = document.getElementById('videoStatsGrid');
  if (!grid || total === 0) { if(grid) grid.innerHTML=''; return; }
  const items = [
    { label:'Passes', val:counts['Passe']||0, color:'var(--cyan)' },
    { label:'Buts', val:counts['But']||0, color:'var(--green)' },
    { label:'Arrêts', val:counts['Arrêt']||0, color:'var(--gold)' },
    { label:'Tirs ratés', val:counts['Tir raté']||0, color:'#FF9500' },
    { label:'Relances', val:counts['Relance']||0, color:'#AA00FF' },
    { label:'Erreurs', val:counts['Erreur']||0, color:'var(--red)' },
  ];
  grid.innerHTML = items.map(i => `
    <div class="stats-pill">
      <div class="stats-pill-val" style="color:${i.color}">${i.val}</div>
      <div class="stats-pill-lbl">${i.label}</div>
    </div>
  `).join('');
}

function saveVideoSession() {
  if (videoEvents.length === 0) return;
  const duration = videoEl ? (()=>{ const t=Math.floor(videoEl.duration||0); return Math.floor(t/60)+':'+String(t%60).padStart(2,'0'); })() : '—';
  const xpGain = Math.min(100, 20 + videoEvents.length * 2);
  const session = { date: Date.now(), events: videoEvents, duration, xp: xpGain };
  DB.push('videoSessions', session);

  // Push events into trainStats
  const trainStats = DB.get('trainStats') || {};
  const passes = videoEvents.filter(e=>e.type==='Passe').length;
  const buts = videoEvents.filter(e=>e.type==='But').length;
  const arrets = videoEvents.filter(e=>e.type==='Arrêt').length;
  const tirs = videoEvents.filter(e=>e.type==='Tir raté').length + buts;
  if (passes>0) { trainStats['video_pass'] = { tried:(trainStats.video_pass?.tried||0)+passes, ok:(trainStats.video_pass?.ok||0)+passes, type:'passes' }; }
  if (tirs>0) { trainStats['video_tir'] = { tried:(trainStats.video_tir?.tried||0)+tirs, ok:(trainStats.video_tir?.ok||0)+buts, type:'goals' }; }
  if (arrets>0) { trainStats['video_def'] = { tried:(trainStats.video_def?.tried||0)+arrets, ok:(trainStats.video_def?.ok||0)+arrets, type:'saves' }; }
  DB.set('trainStats', trainStats);

  addXP(xpGain, 'Analyse vidéo — '+videoEvents.length+' événements');
  DB.push('history', { type:'video', ts:Date.now(), events:videoEvents.length, xp:xpGain });
  autoCheckObjectives();
  checkBadges();
  showToast('✅ Session vidéo sauvegardée !');
  resetVideo();
}

function resetVideo() {
  videoEvents = [];
  if(videoEl) { videoEl.src=''; videoEl=null; }
  initVideoScreen();
}
