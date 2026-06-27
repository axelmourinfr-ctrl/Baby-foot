// ══════════════════════════════════════════
// CONFIGURATION SUPABASE
// ══════════════════════════════════════════
const SUPABASE_URL = 'https://qpnuiyzovxtvldmbelnk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwbnVpeXpvdnh0dmxkbWJlbG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3ODk1MzUsImV4cCI6MjA5NzM2NTUzNX0.nyntTMkJ6nkbhR6yNnIyshEciZVOIEhpEg5lygnAYZs';

// ══════════════════════════════════════════
// STORAGE LAYER — IndexedDB + localStorage + Cloud
// IndexedDB = permanent sur Safari iOS
// localStorage = fallback rapide
// ══════════════════════════════════════════

// Cache mémoire pour accès instantané
const _cache = {};

// IndexedDB setup
const IDB = {
  db: null,
  async open() {
    return new Promise((resolve) => {
      if(this.db) return resolve(this.db);
      try {
        const req = indexedDB.open('bfc_db', 2);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if(!db.objectStoreNames.contains('data')) {
            db.createObjectStore('data', {keyPath:'k'});
          }
        };
        req.onsuccess = e => { this.db = e.target.result; resolve(this.db); };
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch(e) { resolve(null); }
    });
  },
  async get(k) {
    try {
      const db = await this.open(); if(!db) return null;
      return new Promise(resolve => {
        try {
          const tx = db.transaction('data','readonly');
          const req = tx.objectStore('data').get(k);
          req.onsuccess = () => {
            const raw = req.result?.v;
            if(raw === undefined || raw === null) return resolve(null);
            // Always return parsed object
            if(typeof raw === 'string') {
              try { resolve(JSON.parse(raw)); } catch(e) { resolve(raw); }
            } else {
              resolve(raw);
            }
          };
          req.onerror = () => resolve(null);
        } catch(e) { resolve(null); }
      });
    } catch(e) { return null; }
  },
  async set(k, v, ts) {
    try {
      const db = await this.open(); if(!db) return;
      // Always store as JSON string to avoid IDB serialization issues
      const serialized = JSON.stringify(v);
      const writeTs = ts || Date.now();
      return new Promise(resolve => {
        try {
          const tx = db.transaction('data','readwrite');
          tx.objectStore('data').put({k, v: serialized, ts: writeTs});
          tx.oncomplete = resolve;
          tx.onerror = resolve;
        } catch(e) { resolve(); }
      });
    } catch(e) {}
  },
  async getAll() {
    try {
      const db = await this.open(); if(!db) return {};
      return new Promise(resolve => {
        try {
          const tx = db.transaction('data','readonly');
          const req = tx.objectStore('data').getAll();
          req.onsuccess = () => {
            const result = {};
            (req.result||[]).forEach(row => {
              if(row.k && row.k.startsWith('_auth')) {
                result[row.k] = {v: row.v, ts: row.ts||0}; // keep raw for auth tokens
              } else {
                try {
                  result[row.k] = {v: typeof row.v === 'string' ? JSON.parse(row.v) : row.v, ts: row.ts||0};
                } catch(e) {
                  result[row.k] = {v: row.v, ts: row.ts||0};
                }
              }
            });
            resolve(result);
          };
          req.onerror = () => resolve({});
        } catch(e) { resolve({}); }
      });
    } catch(e) { return {}; }
  }
};

const DB = {
  get: (k) => {
    // 1. Cache mémoire (instantané)
    if(_cache[k] !== undefined) return _cache[k];
    // 2. localStorage (fallback)
    try {
      const v = JSON.parse(localStorage.getItem('bfc_'+k));
      if(v !== null) _cache[k] = v;
      return v;
    } catch(e) { return null; }
  },
  set: (k, v) => {
    // 1. Cache mémoire
    _cache[k] = v;
    // 2. localStorage (synchrone, toujours à jour immédiatement)
    const ts = Date.now();
    try {
      localStorage.setItem('bfc_'+k, JSON.stringify(v));
      localStorage.setItem('bfc_ts_'+k, String(ts));
    } catch(e) {}
    // 3. IndexedDB (permanent, asynchrone — ne doit jamais écraser une donnée plus récente au prochain boot)
    IDB.set(k, v, ts);
    // 4. Cloud si connecté
    if(window._bfc_user) CloudDB.sync(k, v);
  },
  push: (k, v) => { const a=DB.get(k)||[]; a.push(v); DB.set(k,a); return a; }
};

// Charge tout au démarrage : localStorage = source primaire (synchrone, toujours à jour),
// IndexedDB complète seulement ce qui manque ou ce qui y est plus récent.
async function loadFromIDB() {
  try {
    // 1. D'abord, charge TOUT ce qui est dans localStorage dans le cache mémoire.
    //    localStorage est synchrone donc toujours à jour, c'est la référence.
    for(let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if(!fullKey || !fullKey.startsWith('bfc_') || fullKey.startsWith('bfc_ts_') || fullKey === 'bfc_cloud_session') continue;
      const k = fullKey.slice(4); // retire 'bfc_'
      try {
        const v = JSON.parse(localStorage.getItem(fullKey));
        if(v !== null) _cache[k] = v;
      } catch(e) {}
    }

    // 2. Ensuite, lis IndexedDB et complète : seulement si la clé manque dans le cache,
    //    OU si la version IDB est strictement plus récente que celle de localStorage.
    const all = await IDB.getAll();
    if(all && Object.keys(all).length) {
      Object.entries(all).forEach(([k, entry]) => {
        const idbTs = entry.ts || 0;
        const localTs = parseInt(localStorage.getItem('bfc_ts_'+k) || '0', 10);
        const missingLocally = _cache[k] === undefined;
        if(missingLocally || idbTs > localTs) {
          _cache[k] = entry.v;
          try {
            localStorage.setItem('bfc_'+k, JSON.stringify(entry.v));
            localStorage.setItem('bfc_ts_'+k, String(idbTs));
          } catch(e) {}
        }
      });
    }

    console.log('Boot loaded — profile:', !!_cache['profile'], '| keys:', Object.keys(_cache).length);
    return !!_cache['profile'];
  } catch(e) {
    console.error('Boot load error:', e);
    // Dernier recours : au moins le profil depuis localStorage
    try {
      const p = localStorage.getItem('bfc_profile');
      if(p) _cache['profile'] = JSON.parse(p);
    } catch(e2) {}
    return !!_cache['profile'];
  }
}

// Charge données cloud dans localStorage + cache + IDB
async function loadFromCloud() {
  if(!CloudDB.client || !window._bfc_user) return false;
  try {
    const { data, error } = await CloudDB.client
      .from('player_data')
      .select('key,value')
      .eq('user_id', window._bfc_user.id);
    if(error || !data?.length) return false;
    data.forEach(row => {
      try {
        const parsed = JSON.parse(row.value);
        const ts = Date.now();
        _cache[row.key] = parsed;
        localStorage.setItem('bfc_'+row.key, row.value);
        localStorage.setItem('bfc_ts_'+row.key, String(ts));
        IDB.set(row.key, parsed, ts); // aussi dans IDB pour persistance
      } catch(e) {}
    });
    console.log('Cloud loaded:', data.length, 'keys');
    return data.some(r => r.key === 'profile');
  } catch(e) {
    console.error('Cloud load error:', e);
    return false;
  }
}

// ══════════════════════════════════════════
// CLOUD DB — REST API directe (sans SDK)
// ══════════════════════════════════════════
const CloudDB = {
  _token: null,
  _refreshToken: null,

  // Headers pour les requêtes
  _headers(auth) {
    const h = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
    };
    if(auth && this._token) h['Authorization'] = 'Bearer ' + this._token;
    return h;
  },

  init() {
    // Pas de SDK — on utilise l'API REST directement
    // Restaure la session depuis localStorage
    try {
      const s = JSON.parse(localStorage.getItem('bfc_cloud_session'));
      if(s) { this._token = s.token; this._refreshToken = s.refresh; window._bfc_user = s.user; }
    } catch(e) {}
  },

  _saveSession(token, refresh, user) {
    this._token = token; this._refreshToken = refresh; window._bfc_user = user;
    localStorage.setItem('bfc_cloud_session', JSON.stringify({token, refresh, user}));
  },

  async signUp(email, password) {
    try {
      const r = await fetch(SUPABASE_URL+'/auth/v1/signup', {
        method:'POST', headers: this._headers(false),
        body: JSON.stringify({email, password})
      });
      const data = await r.json();
      if(data.error || data.msg) return { error: data.error_description || data.msg || data.error };
      if(data.access_token) this._saveSession(data.access_token, data.refresh_token, data.user);
      return { data, error: null };
    } catch(e) { return { error: 'Erreur réseau : '+e.message }; }
  },

  async signIn(email, password) {
    try {
      const r = await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password', {
        method:'POST', headers: this._headers(false),
        body: JSON.stringify({email, password})
      });
      const data = await r.json();
      if(data.error || data.error_description) return { error: data.error_description || data.error };
      if(data.access_token) this._saveSession(data.access_token, data.refresh_token, data.user);
      return { data, error: null };
    } catch(e) { return { error: 'Erreur réseau : '+e.message }; }
  },

  async signOut() {
    try {
      await fetch(SUPABASE_URL+'/auth/v1/logout', {
        method:'POST', headers: this._headers(true)
      });
    } catch(e) {}
    this._token = null; window._bfc_user = null;
    localStorage.removeItem('bfc_cloud_session');
  },

  async getSession() {
    if(!this._token) return null;
    // Verify token still valid
    try {
      const r = await fetch(SUPABASE_URL+'/auth/v1/user', {
        headers: this._headers(true)
      });
      if(r.ok) { const u = await r.json(); window._bfc_user = u; return {user:u}; }
      // Token expired — try refresh
      if(this._refreshToken) {
        const rr = await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token', {
          method:'POST', headers: this._headers(false),
          body: JSON.stringify({refresh_token: this._refreshToken})
        });
        if(rr.ok) {
          const rd = await rr.json();
          this._saveSession(rd.access_token, rd.refresh_token, rd.user);
          return {user: rd.user};
        }
      }
    } catch(e) {}
    return null;
  },

  async sync(key, value) {
    if(!this._token || !window._bfc_user) return;
    try {
      await fetch(SUPABASE_URL+'/rest/v1/player_data', {
        method:'POST',
        headers: {
          ...this._headers(true),
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id: window._bfc_user.id,
          key,
          value: JSON.stringify(value),
          updated_at: new Date().toISOString()
        })
      });
    } catch(e) {}
  },

  async loadAll() {
    if(!this._token || !window._bfc_user) return false;
    try {
      const r = await fetch(
        SUPABASE_URL+'/rest/v1/player_data?user_id=eq.'+window._bfc_user.id+'&select=key,value',
        { headers: this._headers(true) }
      );
      if(!r.ok) return false;
      const data = await r.json();
      if(!data?.length) return false;
      data.forEach(row => {
        try {
          const v = JSON.parse(row.value);
          const ts = Date.now();
          _cache[row.key] = v;
          localStorage.setItem('bfc_'+row.key, row.value);
          localStorage.setItem('bfc_ts_'+row.key, String(ts));
          IDB.set(row.key, v, ts);
        } catch(e) {}
      });
      return true;
    } catch(e) { return false; }
  },

  async pushAll() {
    if(!this._token || !window._bfc_user) return;
    const KEYS = ['profile','xp','exercises','history','matchStats','trainStats',
      'placement','placementHistory','rankGlobal','rankAttack','rankDefense',
      'validated','badges','missions','totalMissionsDone','career'];
    for(const k of KEYS) {
      const v = DB.get(k);
      if(v !== null) await this.sync(k, v);
    }
  }
};

// ══════════════════════════════════════════
// DEFAULT DATA
// ══════════════════════════════════════════
const DEFAULT_EXERCISES = {
  passes: [
    { id:'p1', name:'Bande', type:'passes' },
    { id:'p2', name:'Croisée', type:'passes' },
    { id:'p3', name:'Droite', type:'passes' },
  ],
  attack: [
    { id:'a1',  name:'Tirer courte', type:'goals' },
    { id:'a2',  name:'Tirer longue', type:'goals' },
    { id:'a3',  name:'Tirer croisée courte', type:'goals' },
    { id:'a4',  name:'Tirer croisée longue', type:'goals' },
    { id:'a5',  name:'Tirer décroisée', type:'goals' },
    { id:'a6',  name:'Pousser courte', type:'goals' },
    { id:'a7',  name:'Pousser longue', type:'goals' },
    { id:'a8',  name:'Pousser croisée courte', type:'goals' },
    { id:'a9',  name:'Pousser croisée longue', type:'goals' },
    { id:'a10', name:'Pousser décroisée', type:'goals' },
    { id:'a11', name:'Fixe', type:'goals' },
    { id:'a12', name:'Aller-retour tirer', type:'goals' },
    { id:'a13', name:'Aller-retour pousser', type:'goals' },
  ],
  defense: [
    { id:'d1', name:'Relance bande', type:'saves' },
    { id:'d2', name:'Relance centre', type:'saves' },
    { id:'d3', name:'Relance directe', type:'saves' },
  ]
};

const RPG = {
  ranks: [
    { name:'Recrue', xp:0 }, { name:'Apprenti', xp:100 },
    { name:'Joueur', xp:300 }, { name:'Compétiteur', xp:700 },
    { name:'Expert', xp:1500 }, { name:'Élite', xp:3000 },
    { name:'Maître', xp:6000 }, { name:'Légende', xp:12000 },
  ],
  titlesDefense: ['Apprenti Gardien','Gardien','Rempart','Muraille','Forteresse','Bastion','Légende Défensive'],
  titlesAttack:  ['Buteur','Finisseur','Chasseur','Tireur d\'Élite','Bourreau','Machine à Buts','Légende Offensive'],
  titlesMulti:   ['Voyageur','Aventurier','Polyvalent','Maître Multi-table','Ambassadeur International'],
  defenseReqs: [0,50,200,500,1000,2500,5000],
  attackReqs:  [0,50,200,500,1000,2500,5000],
  multiReqs:   [0,2,5,10,20],
  levelXP: (lvl) => 100*lvl*lvl,
  getLevel: (xp) => { let l=1; while(RPG.levelXP(l)<=xp) l++; return l-1; }
};

const LEAGUES = [
  { id:'bronze',      name:'Bronze',       emoji:'🥉', color:'#CD7F32', divisions:3, minScore:0  },
  { id:'silver',      name:'Argent',       emoji:'🥈', color:'#C0C0C0', divisions:3, minScore:20 },
  { id:'gold',        name:'Or',           emoji:'🥇', color:'#FFD700', divisions:3, minScore:35 },
  { id:'platinum',    name:'Platine',      emoji:'💎', color:'#00E5FF', divisions:3, minScore:50 },
  { id:'diamond',     name:'Diamant',      emoji:'💠', color:'#00B0FF', divisions:3, minScore:68 },
  { id:'master',      name:'Maître',       emoji:'👑', color:'#AA00FF', divisions:3, minScore:80 },
  { id:'grandmaster', name:'Grand Maître', emoji:'🔥', color:'#FF4500', divisions:2, minScore:90 },
  { id:'legend',      name:'Légende',      emoji:'🏆', color:'#C9A84C', divisions:1, minScore:96 },
];

const REACT_ACTIONS = [
  { zone:'DÉFENSE', action:'Relance bande' },
  { zone:'DÉFENSE', action:'Relance centre' },
  { zone:'DÉFENSE', action:'Passe (défense)' },
  { zone:'DÉFENSE', action:'Tirer longue' },
  { zone:'DÉFENSE', action:'Pousser courte' },
  { zone:'DÉFENSE', action:'Pousser longue' },
  { zone:'DÉFENSE', action:'Pousser décroisée' },
  { zone:'MILIEU',  action:'Passe bande' },
  { zone:'MILIEU',  action:'Passe croisée' },
  { zone:'MILIEU',  action:'Passe droite' },
  { zone:'MILIEU',  action:'Passe décroisée' },
  { zone:'ATTAQUE', action:'Tirer courte' },
  { zone:'ATTAQUE', action:'Tirer longue' },
  { zone:'ATTAQUE', action:'Tirer croisée' },
  { zone:'ATTAQUE', action:'Pousser courte' },
  { zone:'ATTAQUE', action:'Pousser longue' },
  { zone:'ATTAQUE', action:'Pousser décroisée' },
  { zone:'ATTAQUE', action:'Fixe' },
  { zone:'DÉFENSE', action:'Tirer croisée' },
  { zone:'ATTAQUE', action:'Aller-retour tirer' },
];

const CAREER_MILESTONES = [
  { id:'c1',  label:'Premier tournoi',       icon:'🏟️', desc:'Participe à ton premier tournoi officiel' },
  { id:'c2',  label:'Première victoire',      icon:'🏆', desc:'Remporte ton premier match en tournoi' },
  { id:'c3',  label:'Montée de division',     icon:'📈', desc:'Monte en division supérieure' },
  { id:'c4',  label:'Ranking 3',              icon:'3️⃣', desc:'Atteins le top 3 d\'un tournoi' },
  { id:'c5',  label:'Ranking 2',              icon:'2️⃣', desc:'Atteins la 2ème place' },
  { id:'c6',  label:'Ranking 1',              icon:'1️⃣', desc:'Remporte un tournoi' },
  { id:'c7',  label:'Top 100',                icon:'💯', desc:'Entre dans le top 100 national' },
  { id:'c8',  label:'Top 50',                 icon:'⭐', desc:'Entre dans le top 50 national' },
  { id:'c9',  label:'Top 20',                 icon:'🌟', desc:'Entre dans le top 20 national' },
  { id:'c10', label:'Sélection nationale',    icon:'🏳️', desc:'Sélectionné en équipe nationale' },
  { id:'c11', label:'Tournoi ITSF',           icon:'🌍', desc:'Participe à un tournoi ITSF officiel' },
  { id:'c12', label:'World Series',           icon:'🔥', desc:'Participe aux World Series ITSF' },
];
