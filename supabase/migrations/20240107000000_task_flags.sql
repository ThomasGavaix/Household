-- Migration 007 — Signalement de priorité (task_flags)
CREATE TABLE task_flags (
  task_type_id UUID NOT NULL REFERENCES task_types(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  flagged_at   TIMESTAMPTZ DEFAULT NOW(),
  flagged_by   UUID REFERENCES profiles(id),
  PRIMARY KEY (task_type_id, household_id)
);

ALTER TABLE task_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_flags_select" ON task_flags
  FOR SELECT USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "task_flags_insert" ON task_flags
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "task_flags_delete" ON task_flags
  FOR DELETE USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE task_flags;
