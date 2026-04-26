-- Migration 008 — Ajout claim/created_by sur one_shot_tasks
ALTER TABLE one_shot_tasks ADD COLUMN IF NOT EXISTS claimed_by  UUID REFERENCES profiles(id);
ALTER TABLE one_shot_tasks ADD COLUMN IF NOT EXISTS claimed_at  TIMESTAMPTZ;
ALTER TABLE one_shot_tasks ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES profiles(id);
