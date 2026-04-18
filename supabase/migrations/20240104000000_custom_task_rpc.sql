-- Migration 004 — RPC pour tâches custom + auto-version
CREATE OR REPLACE FUNCTION create_custom_task(
  p_name TEXT,
  p_emoji TEXT,
  p_xp_value INTEGER,
  p_frequency_hours INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
  v_task task_types;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT household_id INTO v_household_id FROM profiles WHERE id = auth.uid();

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household found';
  END IF;

  INSERT INTO task_types (name, emoji, description, xp_value, frequency_hours, household_id, sort_order)
  VALUES (p_name, p_emoji, '', p_xp_value, p_frequency_hours, v_household_id, 999)
  RETURNING * INTO v_task;

  RETURN row_to_json(v_task);
END;
$$;

CREATE OR REPLACE FUNCTION delete_custom_task(p_task_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
BEGIN
  SELECT household_id INTO v_household_id FROM profiles WHERE id = auth.uid();

  DELETE FROM task_types
  WHERE id = p_task_id AND household_id = v_household_id;
END;
$$;
