-- Add piece selection and pre-roll turn order columns
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS piece TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pre_roll_result INT DEFAULT NULL;

-- Expand games.status to allow pre_roll phase
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE public.games ADD CONSTRAINT games_status_check
  CHECK (status IN ('waiting', 'pre_roll', 'in_progress', 'finished'));
