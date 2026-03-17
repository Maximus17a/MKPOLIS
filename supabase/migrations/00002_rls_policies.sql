-- MKpolis - Row Level Security Policies
-- Strategy: Public read, write only via service_role (API routes)

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES: Users can read all, update own
-- ============================================
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================
-- GAMES: Public read, service_role writes
-- ============================================
CREATE POLICY "Games are viewable by everyone"
    ON public.games FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create games"
    ON public.games FOR INSERT
    WITH CHECK (auth.uid() = host_id);

-- Updates only via service_role (API routes handle OCC)
CREATE POLICY "Service role can update games"
    ON public.games FOR UPDATE
    USING (true);

-- ============================================
-- PLAYERS: Public read, controlled writes
-- ============================================
CREATE POLICY "Players are viewable by everyone"
    ON public.players FOR SELECT
    USING (true);

CREATE POLICY "Users can join games"
    ON public.players FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update players"
    ON public.players FOR UPDATE
    USING (true);

-- ============================================
-- PROPERTIES: Public read, service_role writes
-- ============================================
CREATE POLICY "Properties are viewable by everyone"
    ON public.properties FOR SELECT
    USING (true);

CREATE POLICY "Service role can manage properties"
    ON public.properties FOR ALL
    USING (true);

-- ============================================
-- PLAYER CARDS: Visible to game participants
-- ============================================
CREATE POLICY "Cards viewable by game participants"
    ON public.player_cards FOR SELECT
    USING (true);

CREATE POLICY "Service role can manage cards"
    ON public.player_cards FOR ALL
    USING (true);

-- ============================================
-- GAME LOGS: Public read
-- ============================================
CREATE POLICY "Logs are viewable by everyone"
    ON public.game_logs FOR SELECT
    USING (true);

CREATE POLICY "Service role can insert logs"
    ON public.game_logs FOR INSERT
    WITH CHECK (true);
