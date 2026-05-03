-- Migration 009 — Claims sur les tâches périodiques
CREATE TABLE periodic_task_claims (
  task_type_id UUID NOT NULL REFERENCES task_types(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  claimed_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claimed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_type_id, household_id)
);

ALTER TABLE periodic_task_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periodic_claims_select" ON periodic_task_claims
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "periodic_claims_insert" ON periodic_task_claims
  FOR INSERT WITH CHECK (
    claimed_by = auth.uid()
    AND household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "periodic_claims_delete" ON periodic_task_claims
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE periodic_task_claims;
