-- Migration 005 — Fix SELECT RLS task_types
-- get_my_household_id() ne renvoie pas auth.uid() correctement dans
-- certains contextes SECURITY DEFINER. On utilise un subquery inline.

DROP POLICY IF EXISTS "task_types_select" ON task_types;
CREATE POLICY "task_types_select" ON task_types
  FOR SELECT USING (
    household_id IS NULL
    OR household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_types_insert" ON task_types;
CREATE POLICY "task_types_insert" ON task_types
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_types_delete" ON task_types;
CREATE POLICY "task_types_delete" ON task_types
  FOR DELETE USING (
    household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );
