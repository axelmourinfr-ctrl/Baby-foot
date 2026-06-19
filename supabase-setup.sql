-- ══════════════════════════════════════════
-- BabyFoot Coach RPG — Setup Supabase
-- Colle ce code dans Supabase > SQL Editor > New Query > Run
-- ══════════════════════════════════════════

-- Table principale des données joueur
CREATE TABLE IF NOT EXISTS player_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- Sécurité : chaque joueur ne voit que ses propres données
ALTER TABLE player_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Joueur voit ses données" ON player_data
  FOR ALL USING (auth.uid() = user_id);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_player_data_user ON player_data(user_id);

-- Confirmation
SELECT 'Setup terminé ✅' AS status;
