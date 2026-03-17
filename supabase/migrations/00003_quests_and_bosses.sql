-- Migration: Add quest and boss immunity columns to players

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS active_quest_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quest_progress INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boss_immunity BOOLEAN DEFAULT FALSE;

-- (Optional) Static event catalog table — the app also hardcodes these in events-data.ts
CREATE TABLE IF NOT EXISTS public.game_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type TEXT CHECK (event_type IN ('side_quest', 'boss_fight')),
  event_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_amount INT DEFAULT 0,
  penalty_amount INT DEFAULT 0
);

-- Seed catalog entries
INSERT INTO public.game_events (event_type, event_code, title, description, reward_amount, penalty_amount) VALUES
  ('side_quest', 'quest_valorant_clutch', 'Clutch en Valorant: 1vX', 'Sobrevive 2 turnos sin pagar renta ni ir al LAG. Recompensa: $400.', 400, 100),
  ('side_quest', 'quest_pentakill', '¡Pentakill en la Grieta!', 'Saca 8+ en tu próxima tirada para robar $50 a cada jugador.', 50, 0),
  ('side_quest', 'quest_save_rexy', 'Operación: Rescatar a Rexy', 'Paga $50 ahora. Da la vuelta al tablero sin ir al LAG para ganar $300.', 300, 0),
  ('boss_fight', 'boss_radahn_meteor', 'General Radahn: El Azote de las Estrellas', 'Todos pierden $200. Tú además pierdes un turno.', 0, 200),
  ('boss_fight', 'boss_sephiroth_supernova', 'Sephiroth: Supernova', 'Pagas el 20% de tu valor total al banco.', 0, 0),
  ('boss_fight', 'boss_bowser_theft', 'Bowser: El Robo de Propiedades', 'Bowser roba una propiedad no mejorada y la da a un oponente. Sin propiedades: pagas $100.', 0, 100)
ON CONFLICT (event_code) DO NOTHING;
