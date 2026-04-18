-- Migration 006 — Quêtes uniques (todo non-périodiques)
CREATE TABLE one_shot_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📋',
  xp_value INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id)
);

ALTER TABLE one_shot_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "one_shot_select" ON one_shot_tasks
  FOR SELECT USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "one_shot_insert" ON one_shot_tasks
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "one_shot_update" ON one_shot_tasks
  FOR UPDATE USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "one_shot_delete" ON one_shot_tasks
  FOR DELETE USING (household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- XP au moment de la complétion
CREATE OR REPLACE FUNCTION handle_one_shot_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL AND NEW.completed_by IS NOT NULL THEN
    UPDATE profiles
    SET total_xp = total_xp + NEW.xp_value
    WHERE id = NEW.completed_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_one_shot_completed
  AFTER UPDATE ON one_shot_tasks
  FOR EACH ROW EXECUTE FUNCTION handle_one_shot_completion();

ALTER PUBLICATION supabase_realtime ADD TABLE one_shot_tasks;
