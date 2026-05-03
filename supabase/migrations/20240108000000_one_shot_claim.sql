-- Migration 008 — Claim sur les quêtes uniques
ALTER TABLE one_shot_tasks
  ADD COLUMN IF NOT EXISTS claimed_by  UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS claimed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES profiles(id);
