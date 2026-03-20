-- Add game rules configuration and related tracking columns

-- rules: JSONB config chosen by host before game starts
-- free_parking_pot: accumulated money from taxes (for Lounge pot rule)
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS free_parking_pot INT DEFAULT 0;

-- jail_visit_count: how many times a player has been sent to jail this game
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS jail_visit_count INT DEFAULT 0;
