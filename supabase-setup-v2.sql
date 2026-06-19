-- ══════════════════════════════════════════════════════════════════════════
-- BabyFoot Coach — Supabase V2 — Architecture relationnelle Sport Analytics
-- À coller dans Supabase > SQL Editor > New Query > Run
--
-- IMPORTANT : ce script ne touche PAS à la table existante `player_data`.
-- Il ajoute uniquement de nouvelles tables. L'app actuelle continue de
-- fonctionner sans aucune modification tant que le code JS n'est pas
-- mis à jour pour écrire aussi dans ces nouvelles tables.
-- ══════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════
-- EXTENSIONS REQUISES
-- ════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- pour gen_random_uuid()


-- ════════════════════════════════════════════
-- BLOC A — IDENTITÉ & PROGRESSION
-- ════════════════════════════════════════════

-- Profil joueur (miroir relationnel de player_data['profile'])
CREATE TABLE IF NOT EXISTS players (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  dominant_hand TEXT CHECK (dominant_hand IN ('gauche','droite')),
  preferred_position TEXT CHECK (preferred_position IN ('attaque','defense','les_deux')),
  self_level    TEXT,                  -- niveau auto-évalué (libre, catalogue côté JS)
  declared_elo  INTEGER,
  goal          TEXT,                  -- objectif déclaré, texte libre
  avatar_emoji  TEXT,
  avatar_photo_url TEXT,                -- URL Supabase Storage (PAS de base64 inline)
  tables_practiced TEXT[],              -- ex: ARRAY['jupiter','other']
  xp_total      INTEGER NOT NULL DEFAULT 0,
  current_streak_days INTEGER NOT NULL DEFAULT 0,  -- dénormalisé pour perf dashboard
  longest_streak_days  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id);

-- Rangs par dimension (remplace rankGlobal / rankAttack / rankDefense)
CREATE TABLE IF NOT EXISTS player_ranks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dimension     TEXT NOT NULL CHECK (dimension IN ('global','attack','defense')),
  league_idx    SMALLINT NOT NULL DEFAULT 0,   -- index dans LEAGUES (catalogue JS)
  division      SMALLINT NOT NULL DEFAULT 1,
  league_points SMALLINT NOT NULL DEFAULT 0,   -- "lp" 0-100
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, dimension)
);

CREATE INDEX IF NOT EXISTS idx_player_ranks_user ON player_ranks(user_id);

-- Badges débloqués — AVEC date (perdue dans le système actuel)
CREATE TABLE IF NOT EXISTS badges_unlocked (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL,            -- correspond à BADGES[].id côté JS
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_badges_unlocked_user ON badges_unlocked(user_id);

-- Jalons de carrière accomplis (remplace career)
CREATE TABLE IF NOT EXISTS career_milestones_done (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id  TEXT NOT NULL,          -- correspond à CAREER_MILESTONES[].id côté JS
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, milestone_id)
);

CREATE INDEX IF NOT EXISTS idx_career_milestones_user ON career_milestones_done(user_id);

-- Homologations de rang (remplace `validated`, qui était unique — ici historisé)
CREATE TABLE IF NOT EXISTS rank_validations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  details     TEXT,
  proof_photo_url TEXT,                 -- Supabase Storage, pas de base64
  event_date  DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rank_validations_user ON rank_validations(user_id);


-- ════════════════════════════════════════════
-- BLOC B — ENTRAÎNEMENT (granularité tentative-par-tentative)
-- ════════════════════════════════════════════

-- Une session = un passage à l'entraînement (peut contenir plusieurs exercices)
CREATE TABLE IF NOT EXISTS training_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_mode  TEXT NOT NULL CHECK (session_mode IN ('classic','chrono')),
  table_type    TEXT CHECK (table_type IN ('jupiter','other')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  xp_earned     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_user_date ON training_sessions(user_id, started_at DESC);

-- Chaque tentative individuelle (le niveau de détail qui manque aujourd'hui)
CREATE TABLE IF NOT EXISTS training_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- dénormalisé pour RLS/perf
  exercise_id     TEXT NOT NULL,        -- correspond à DEFAULT_EXERCISES[].id ou 'custom_...' côté JS
  exercise_type   TEXT NOT NULL CHECK (exercise_type IN ('passes','goals','saves')),
  attempt_number  SMALLINT NOT NULL,    -- position dans la série (1, 2, 3...)
  success         BOOLEAN NOT NULL,
  penalty         BOOLEAN NOT NULL DEFAULT FALSE,   -- dépassement du temps réglementaire
  time_seconds    NUMERIC(5,2),         -- temps de réaction réel, NULL en mode classique
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_attempts_session ON training_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_training_attempts_user_exercise ON training_attempts(user_id, exercise_id, created_at DESC);

-- Vue agrégée prête à l'emploi : stats par exercice, calculées côté SQL
CREATE OR REPLACE VIEW training_stats_by_exercise AS
SELECT
  user_id,
  exercise_id,
  exercise_type,
  COUNT(*) AS total_tries,
  COUNT(*) FILTER (WHERE success) AS total_success,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success) / COUNT(*), 1) AS success_pct,
  ROUND(AVG(time_seconds), 2) AS avg_time_seconds,
  MAX(created_at) AS last_attempt_at
FROM training_attempts
GROUP BY user_id, exercise_id, exercise_type;


-- ════════════════════════════════════════════
-- BLOC C — MATCHS & ANALYTICS (nouveauté produit)
-- ════════════════════════════════════════════

-- Adversaires identifiés (table relationnelle dès la V2, anticipe le multi-joueur)
CREATE TABLE IF NOT EXISTS opponents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- créé par ce joueur
  name        TEXT NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_opponents_user ON opponents(user_id);

-- Un match complet
CREATE TABLE IF NOT EXISTS matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id     UUID REFERENCES opponents(id) ON DELETE SET NULL,
  table_type      TEXT NOT NULL CHECK (table_type IN ('jupiter','itsf','other')),
  player_role     TEXT CHECK (player_role IN ('att','def','les_deux')),
  is_competitive  BOOLEAN NOT NULL DEFAULT FALSE,    -- tournoi/officiel vs amical
  result          TEXT CHECK (result IN ('victoire','defaite','nul')),
  sets_won        SMALLINT NOT NULL DEFAULT 0,
  sets_lost       SMALLINT NOT NULL DEFAULT 0,
  score_detail    JSONB,               -- ex: [{"set":1,"for":5,"against":3}, ...] — souple, pas de schéma rigide nécessaire ici
  played_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_user_date ON matches(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_opponent ON matches(opponent_id);

-- Chaque événement individuel d'un match — le cœur de l'analytics avancé
CREATE TABLE IF NOT EXISTS match_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- dénormalisé pour RLS/perf
  set_number      SMALLINT,
  zone            TEXT CHECK (zone IN ('defense','milieu','attaque')),
  event_type      TEXT NOT NULL CHECK (event_type IN (
                    'tir','but','passe','interception','arret',
                    'balle_perdue','relance','recuperation','erreur'
                  )),
  shot_type       TEXT,                -- ex: 'tirer_croisee_courte', NULL si non pertinent — libre, catalogue côté JS
  success         BOOLEAN,
  timestamp_seconds NUMERIC(6,2),      -- secondes depuis le début du match (ou du set)
  seconds_since_previous_event NUMERIC(6,2),  -- pré-calculé pour analyse de timing (ex: "tire après 4 sec")
  under_pressure  BOOLEAN NOT NULL DEFAULT FALSE,  -- ex: après timeout, après but encaissé — flaggé manuellement ou déduit
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id, timestamp_seconds);
CREATE INDEX IF NOT EXISTS idx_match_events_user_type ON match_events(user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_events_shot_type ON match_events(user_id, shot_type) WHERE shot_type IS NOT NULL;

-- Test de placement (remplace placement / placementHistory)
CREATE TABLE IF NOT EXISTS league_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_type      TEXT NOT NULL CHECK (table_type IN ('jupiter','other')),
  league_idx      SMALLINT NOT NULL,
  division        SMALLINT NOT NULL,
  global_score    NUMERIC(5,2) NOT NULL,
  step_scores     JSONB NOT NULL,        -- [{"step":0,"label":"Passe Bande","pct":85,"adjusted_pct":88}, ...]
  shot_choices    JSONB,                 -- {"tirDef":"...", "tirAtt1":"...", ...}
  is_current      BOOLEAN NOT NULL DEFAULT TRUE,   -- un seul TRUE par user à la fois (géré applicativement)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_league_tests_user_date ON league_tests(user_id, created_at DESC);

-- Détail tentative-par-tentative du test (perdu aujourd'hui une fois le test fini)
CREATE TABLE IF NOT EXISTS league_test_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_test_id  UUID NOT NULL REFERENCES league_tests(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number     SMALLINT NOT NULL,      -- 0 à 5
  attempt_number  SMALLINT NOT NULL,
  shot_label      TEXT,                  -- pour step 4 (3 tirs mélangés) : quel tir précisément
  success         BOOLEAN NOT NULL,
  penalty         BOOLEAN NOT NULL DEFAULT FALSE,
  time_seconds    NUMERIC(5,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_league_test_attempts_test ON league_test_attempts(league_test_id, step_number);


-- ════════════════════════════════════════════
-- BLOC D — IA & VIDÉO
-- ════════════════════════════════════════════

-- Historique des échanges et programmes du Coach IA (rien n'est gardé aujourd'hui pour le chat)
CREATE TABLE IF NOT EXISTS ai_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type   TEXT NOT NULL CHECK (report_type IN ('analysis','training_program','match_report')),
  user_question TEXT,                  -- NULL si report_type = 'training_program' généré sans question
  player_context JSONB,                -- snapshot du contexte envoyé à l'IA (utile pour audit/debug)
  ai_response   TEXT,                  -- réponse texte libre (mode 'analysis')
  structured_output JSONB,             -- programme JSON structuré (mode 'training_program')
  model_used    TEXT,                  -- ex: 'gemini-2.5-flash'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_user_date ON ai_reports(user_id, created_at DESC);

-- Vidéos uploadées (métadonnées — fichier réel dans Supabase Storage, pas en base64)
CREATE TABLE IF NOT EXISTS videos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id        UUID REFERENCES matches(id) ON DELETE SET NULL,  -- lien optionnel vers un match
  storage_path    TEXT,                 -- chemin dans Supabase Storage, NULL si gardée en local pour l'instant
  duration_seconds NUMERIC(7,2),
  recorded_at     TIMESTAMPTZ,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  xp_earned       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_match ON videos(match_id);

-- Événements extraits d'une vidéo (manuel aujourd'hui, prêt pour l'automatique demain)
CREATE TABLE IF NOT EXISTS video_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id            UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zone                TEXT CHECK (zone IN ('defense','milieu','attaque')),
  event_type          TEXT NOT NULL CHECK (event_type IN (
                        'tir','but','passe','interception','arret',
                        'balle_perdue','relance','recuperation','erreur'
                      )),
  video_timestamp_seconds NUMERIC(7,2) NOT NULL,
  source              TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
  confidence          NUMERIC(4,3),    -- NULL si manuel, score 0-1 si détection automatique future
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_events_video ON video_events(video_id, video_timestamp_seconds);
CREATE INDEX IF NOT EXISTS idx_video_events_user_type ON video_events(user_id, event_type);


-- ════════════════════════════════════════════
-- ROW LEVEL SECURITY — chaque joueur ne voit que ses propres données
-- ════════════════════════════════════════════

ALTER TABLE players                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_ranks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges_unlocked          ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_milestones_done   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_validations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attempts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE opponents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_tests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_test_attempts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports               ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_events             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players_own_data" ON players
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "player_ranks_own_data" ON player_ranks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "badges_unlocked_own_data" ON badges_unlocked
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "career_milestones_own_data" ON career_milestones_done
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "rank_validations_own_data" ON rank_validations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "training_sessions_own_data" ON training_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "training_attempts_own_data" ON training_attempts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "opponents_own_data" ON opponents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "matches_own_data" ON matches
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "match_events_own_data" ON match_events
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "league_tests_own_data" ON league_tests
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "league_test_attempts_own_data" ON league_test_attempts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "ai_reports_own_data" ON ai_reports
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "videos_own_data" ON videos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "video_events_own_data" ON video_events
  FOR ALL USING (auth.uid() = user_id);


-- ════════════════════════════════════════════
-- TRIGGER — updated_at automatique sur players
-- ════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_players_updated_at ON players;
CREATE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();


-- ════════════════════════════════════════════
-- VUES ANALYTICS — utiles dès la V2 pour le Coach IA
-- ════════════════════════════════════════════

-- Timing moyen par type de tir, pour détecter la prévisibilité ("tire souvent après 4 sec")
CREATE OR REPLACE VIEW shot_timing_analysis AS
SELECT
  user_id,
  shot_type,
  zone,
  COUNT(*) AS total_shots,
  ROUND(AVG(seconds_since_previous_event), 2) AS avg_seconds_since_previous,
  ROUND(STDDEV(seconds_since_previous_event), 2) AS stddev_seconds,   -- faible stddev = très prévisible
  COUNT(*) FILTER (WHERE success) AS successes,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success) / COUNT(*), 1) AS success_pct
FROM match_events
WHERE event_type = 'tir' AND shot_type IS NOT NULL
GROUP BY user_id, shot_type, zone;

-- Performance sous pression vs hors pression — pour détecter le ratio clutch
CREATE OR REPLACE VIEW pressure_performance AS
SELECT
  user_id,
  under_pressure,
  event_type,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE success) AS successes,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success) / COUNT(*), 1) AS success_pct
FROM match_events
WHERE success IS NOT NULL
GROUP BY user_id, under_pressure, event_type;

-- Bilan victoires/défaites par adversaire
CREATE OR REPLACE VIEW match_record_by_opponent AS
SELECT
  m.user_id,
  o.name AS opponent_name,
  COUNT(*) AS total_matches,
  COUNT(*) FILTER (WHERE m.result = 'victoire') AS wins,
  COUNT(*) FILTER (WHERE m.result = 'defaite') AS losses,
  MAX(m.played_at) AS last_played_at
FROM matches m
LEFT JOIN opponents o ON o.id = m.opponent_id
GROUP BY m.user_id, o.name;


-- Confirmation
SELECT 'Setup V2 terminé ✅ — player_data existant non affecté' AS status;
