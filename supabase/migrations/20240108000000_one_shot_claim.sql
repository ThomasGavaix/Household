-- ============================================================
-- Migration 008 — one_shot_tasks avec claimed_by / claimed_at
-- ============================================================

CREATE TABLE one_shot_tasks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  emoji         TEXT        NOT NULL DEFAULT '✨',
  xp_value      INTEGER     NOT NULL DEFAULT 10,
  created_by    UUID        NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  -- Claim
  claimed_by    UUID        REFERENCES profiles(id),
  claimed_at    TIMESTAMPTZ,
  -- Completion
  completed_by  UUID        REFERENCES profiles(id),
  completed_at  TIMESTAMPTZ
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE one_shot_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "one_shot_select" ON one_shot_tasks
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY "one_shot_insert" ON one_shot_tasks
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND household_id = get_my_household_id()
  );

-- N'importe quel membre du foyer peut claim / unclaim / compléter
CREATE POLICY "one_shot_update" ON one_shot_tasks
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY "one_shot_delete" ON one_shot_tasks
  FOR DELETE USING (household_id = get_my_household_id());

-- ── Realtime ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE one_shot_tasks;
