-- ============================================================
-- Migration 002 — Fix RLS + tâches custom par foyer
-- ============================================================

-- 1. Fonction security definer pour éviter la récursion infinie
--    (le SELECT sur profiles dans les policies causait la boucle)
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT household_id FROM profiles WHERE id = auth.uid()
$$;

-- 2. Fix policies profiles (supprimer l'ancienne, recréer)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR household_id = get_my_household_id()
  );

-- 3. Fix policies task_completions
DROP POLICY IF EXISTS "completions_select" ON task_completions;
CREATE POLICY "completions_select" ON task_completions
  FOR SELECT USING (
    household_id = get_my_household_id()
  );

DROP POLICY IF EXISTS "completions_insert" ON task_completions;
CREATE POLICY "completions_insert" ON task_completions
  FOR INSERT WITH CHECK (
    completed_by = auth.uid()
    AND household_id = get_my_household_id()
  );

-- 4. Fix policy households
DROP POLICY IF EXISTS "household_select" ON households;
CREATE POLICY "household_select" ON households
  FOR SELECT USING (id = get_my_household_id());

-- 5. Tâches custom par foyer (household_id sur task_types)
ALTER TABLE task_types ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id);

-- 6. Mettre à jour les policies task_types pour inclure les tâches custom
DROP POLICY IF EXISTS "task_types_select" ON task_types;
CREATE POLICY "task_types_select" ON task_types
  FOR SELECT USING (
    household_id IS NULL
    OR household_id = get_my_household_id()
  );

CREATE POLICY "task_types_insert" ON task_types
  FOR INSERT WITH CHECK (
    household_id = get_my_household_id()
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "task_types_delete" ON task_types
  FOR DELETE USING (
    household_id = get_my_household_id()
  );

-- 7. Mettre à jour la vue latest completions (inclure household_id dans le filtre)
DROP VIEW IF EXISTS task_completions_latest;
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
