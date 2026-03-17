-- Migration: Trade offers table for P2P trading

CREATE TABLE IF NOT EXISTS public.trade_offers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.players(id) NOT NULL,
  receiver_id UUID REFERENCES public.players(id) NOT NULL,
  offered_money INT DEFAULT 0,
  requested_money INT DEFAULT 0,
  offered_properties INT[] DEFAULT '{}',
  requested_properties INT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.trade_offers ENABLE ROW LEVEL SECURITY;

-- Public read for game participants
CREATE POLICY "Anyone can read trade offers" ON public.trade_offers
  FOR SELECT USING (true);

-- Service role handles writes
CREATE POLICY "Service role can manage trade offers" ON public.trade_offers
  FOR ALL USING (true) WITH CHECK (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_offers;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_trade_offers_game ON public.trade_offers(game_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_receiver ON public.trade_offers(receiver_id, status);
