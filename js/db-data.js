// ══════════════════════════════════════════
// CONFIGURATION SUPABASE
// ══════════════════════════════════════════
const SUPABASE_URL = 'https://qpnuiyzovxtvldmbelnk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MeMOvjdCR_UOequRjiWrxQ_BiXGijzS';

// ══════════════════════════════════════════
// STORAGE LAYER — Local + Cloud sync
// ══════════════════════════════════════════
const DB = {
  // Local cache (instantané)
  get: (k) => { try { return JSON.parse(localStorage.getItem('bfc_'+k)); } catch(e) { return null; } },
  set: (k,v) => {
    localStorage.setItem('bfc_'+k, JSON.stringify(v));
    // Sync cloud si connecté
    if(window._bfc_user) CloudDB.sync(k, v);
  },
  push: (k,v) => { const a=DB.get(k)||[]; a.push(v); DB.set(k,a); return a; }
};

// ══════════════════════════════════════════
// CLOUD DB (Supabase)
// ══════════════════════════════════════════
const CloudDB = {
  client: null,

  init() {
    if(!window.supabase || SUPABASE_URL === 'SUPABASE_URL_HERE') return;
    this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  },

  async sync(key, value) {
    if(!this.client || !window._bfc_user) return;
    try {
      await this.client.from('player_data').upsert({
        user_id: window._bfc_user.id,
        key,
        value: JSON.stringify(value),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,key' });
    } catch(e) { console.warn('Sync failed:', e); }
  },

  async loadAll() {
    if(!this.client || !window._bfc_user) return false;
    try {
      const { data, error } = await this.client
        .from('player_data')
        .select('key,value')
        .eq('user_id', window._bfc_user.id);
      if(error || !data?.length) return false;
      data.forEach(row => {
        localStorage.setItem('bfc_'+row.key, row.value);
      });
      return true;
    } catch(e) { return false; }
  },

  async signUp(email, password) {
    if(!this.client) return { error:'Non configuré' };
    const { data, error } = await this.client.auth.signUp({ email, password });
    if(data?.user) window._bfc_user = data.user;
    return { data, error };
  },

  async signIn(email, password) {
    if(!this.client) return { error:'Non configuré' };
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if(data?.user) window._bfc_user = data.user;
    return { data, error };
  },

  async signOut() {
    if(!this.client) return;
    await this.client.auth.signOut();
    window._bfc_user = null;
  },

  async getSession() {
    if(!this.client) return null;
    const { data } = await this.client.auth.getSession();
    if(data?.session?.user) window._bfc_user = data.session.user;
    return data?.session;
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
  { zone:'DÉFENSE', action:'Relance directe' },
  { zone:'DÉFENSE', action:'Tirer longue défense' },
  { zone:'DÉFENSE', action:'Pousser courte défense' },
  { zone:'DÉFENSE', action:'Pousser longue défense' },
  { zone:'DÉFENSE', action:'Pousser décroisée défense' },
  { zone:'MILIEU',  action:'Passe bande' },
  { zone:'MILIEU',  action:'Passe croisée' },
  { zone:'MILIEU',  action:'Passe droite' },
  { zone:'ATTAQUE', action:'Tirer courte' },
  { zone:'ATTAQUE', action:'Tirer longue' },
  { zone:'ATTAQUE', action:'Tirer croisée' },
  { zone:'ATTAQUE', action:'Pousser courte' },
  { zone:'ATTAQUE', action:'Pousser longue' },
  { zone:'ATTAQUE', action:'Pousser décroisée' },
  { zone:'ATTAQUE', action:'Fixe' },
  { zone:'DÉFENSE', action:'Tirer croisée défense' },
  { zone:'MILIEU',  action:'Passe décroisée' },
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
