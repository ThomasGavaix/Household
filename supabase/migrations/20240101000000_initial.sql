-- ============================================================
-- Household Quest — schéma Supabase initial
-- ============================================================

-- Foyers
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Notre Foyer',
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profils utilisateurs (étend auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_emoji TEXT NOT NULL DEFAULT '🦸',
  household_id UUID REFERENCES households(id),
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Types de tâches (global, partagé par tous les foyers)
CREATE TABLE task_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  xp_value INTEGER NOT NULL DEFAULT 10,
  frequency_hours INTEGER NOT NULL DEFAULT 48,
  category TEXT NOT NULL DEFAULT 'general',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Historique des tâches complétées
CREATE TABLE task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type_id UUID NOT NULL REFERENCES task_types(id),
  household_id UUID NOT NULL REFERENCES households(id),
  completed_by UUID NOT NULL REFERENCES profiles(id),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  xp_earned INTEGER NOT NULL
);

-- ============================================================
-- Vue : dernière complétion par tâche et foyer
-- ============================================================
CREATE VIEW task_completions_latest AS
SELECT DISTINCT ON (tc.task_type_id, tc.household_id)
  tc.id,
  tc.task_type_id,
  tc.household_id,
  tc.completed_by,
  tc.completed_at,
  tc.xp_earned,
  p.username,
  p.avatar_emoji
FROM task_completions tc
JOIN profiles p ON p.id = tc.completed_by
ORDER BY tc.task_type_id, tc.household_id, tc.completed_at DESC;

-- ============================================================
-- Seed : tâches ménagères
-- ============================================================
INSERT INTO task_types (name, emoji, description, xp_value, frequency_hours, category, sort_order) VALUES
  ('Vider le lave-vaisselle', '🍽️', 'Ranger toute la vaisselle propre', 15, 24, 'cuisine', 1),
  ('Faire la vaisselle', '🧼', 'Laver la vaisselle à la main', 15, 24, 'cuisine', 2),
  ('Faire la lessive', '👕', 'Lancer un cycle de lavage', 20, 72, 'linge', 3),
  ('Étendre le linge', '🧺', 'Étendre ou plier le linge propre', 15, 72, 'linge', 4),
  ('Passer l''aspirateur', '🌀', 'Aspirer tous les sols', 25, 72, 'nettoyage', 5),
  ('Laver le sol', '🧹', 'Passer la serpillière', 30, 168, 'nettoyage', 6),
  ('Vider les poubelles', '🗑️', 'Sortir et remplacer les sacs', 10, 72, 'hygiene', 7),
  ('Faire les courses', '🛒', 'Acheter les provisions', 35, 72, 'courses', 8),
  ('Nettoyer les toilettes', '🚽', 'Nettoyer et désinfecter', 20, 72, 'hygiene', 9),
  ('Nettoyer la salle de bain', '🛁', 'Baignoire, lavabo et miroir', 30, 168, 'hygiene', 10),
  ('Cuisiner', '🍳', 'Préparer un repas complet', 20, 24, 'cuisine', 11),
  ('Arroser les plantes', '🌿', 'Donner de l''eau aux plantes', 10, 72, 'jardinage', 12);

-- ============================================================
-- Trigger : mise à jour XP + niveau après chaque tâche
-- ============================================================
CREATE OR REPLACE FUNCTION update_profile_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_total INTEGER;
  new_level INTEGER;
BEGIN
  SELECT total_xp + NEW.xp_earned INTO new_total
  FROM profiles WHERE id = NEW.completed_by;

  -- Niveau = floor(sqrt(total_xp / 50)) + 1
  new_level := FLOOR(SQRT(new_total::FLOAT / 50)) + 1;

  UPDATE profiles
  SET total_xp = new_total,
      level = new_level,
      updated_at = NOW()
  WHERE id = NEW.completed_by;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_task_completion
  AFTER INSERT ON task_completions
  FOR EACH ROW EXECUTE FUNCTION update_profile_xp();

-- Trigger : créer le profil automatiquement à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, username, avatar_emoji)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_emoji', '🦸')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- Foyers : visible par les membres
CREATE POLICY "household_select" ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "household_insert" ON households
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Profils : visible par les membres du même foyer + soi-même
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid() AND household_id IS NOT NULL
    )
  );

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Types de tâches : lecture publique
CREATE POLICY "task_types_select" ON task_types
  FOR SELECT USING (true);

-- Complétions : lecture par membres du foyer
CREATE POLICY "completions_select" ON task_completions
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Complétions : insertion par l'utilisateur pour son foyer
CREATE POLICY "completions_insert" ON task_completions
  FOR INSERT WITH CHECK (
    completed_by = auth.uid()
    AND household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE task_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
