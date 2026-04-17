-- ============================================================
-- Migration 003 — Fonctions RPC pour créer/rejoindre un foyer
-- Contourne les problèmes RLS (INSERT RETURNING + SELECT avant
-- que le profil ait un household_id)
-- ============================================================

-- Crée un foyer ET met à jour le profil en une seule transaction
CREATE OR REPLACE FUNCTION create_household(p_name TEXT, p_invite_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household households;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO households (name, invite_code)
  VALUES (p_name, p_invite_code)
  RETURNING * INTO v_household;

  UPDATE profiles SET household_id = v_household.id WHERE id = auth.uid();

  RETURN row_to_json(v_household);
END;
$$;

-- Rejoint un foyer via le code d'invitation
CREATE OR REPLACE FUNCTION join_household(p_invite_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household households;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_household
  FROM households
  WHERE invite_code = upper(trim(p_invite_code));

  IF v_household IS NULL THEN
    RAISE EXCEPTION 'Code invalide';
  END IF;

  UPDATE profiles SET household_id = v_household.id WHERE id = auth.uid();

  RETURN row_to_json(v_household);
END;
$$;
