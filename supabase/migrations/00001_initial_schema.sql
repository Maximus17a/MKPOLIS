-- MKpolis Online Game - Initial Schema
-- Optimistic Concurrency Control via `version` columns

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GAMES (Lobbies)
-- ============================================
CREATE TABLE public.games (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    host_id UUID REFERENCES public.profiles(id) NOT NULL,
    status TEXT CHECK (status IN ('waiting', 'in_progress', 'finished')) DEFAULT 'waiting',
    current_turn_player_id UUID,
    turn_phase TEXT CHECK (turn_phase IN ('roll', 'action', 'end')) DEFAULT 'roll',
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PLAYERS
-- ============================================
CREATE TABLE public.players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    position_index INT DEFAULT 0,
    balance INT DEFAULT 1500,
    is_bankrupt BOOLEAN DEFAULT FALSE,
    jail_turns_remaining INT DEFAULT 0,
    stun_turns_remaining INT DEFAULT 0,
    turn_order INT NOT NULL,
    color TEXT DEFAULT '#00ffcc',
    version INT DEFAULT 1,
    UNIQUE(game_id, user_id)
);

-- ============================================
-- PROPERTIES
-- ============================================
CREATE TABLE public.properties (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    property_index INT NOT NULL,
    owner_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    server_level INT DEFAULT 0,
    is_mortgaged BOOLEAN DEFAULT FALSE,
    version INT DEFAULT 1,
    UNIQUE(game_id, property_index)
);

-- ============================================
-- PLAYER CARDS (Power Cards)
-- ============================================
CREATE TABLE public.player_cards (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
    card_type TEXT NOT NULL CHECK (card_type IN ('stun', 'respawn', 'loot_drop', 'gankeo')),
    is_used BOOLEAN DEFAULT FALSE
);

-- ============================================
-- GAME LOGS
-- ============================================
CREATE TABLE public.game_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    action_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FK for current_turn_player_id (deferred)
-- ============================================
ALTER TABLE public.games
    ADD CONSTRAINT fk_current_turn_player
    FOREIGN KEY (current_turn_player_id)
    REFERENCES public.players(id)
    ON DELETE SET NULL;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_players_game ON public.players(game_id);
CREATE INDEX idx_properties_game ON public.properties(game_id);
CREATE INDEX idx_game_logs_game ON public.game_logs(game_id);
CREATE INDEX idx_player_cards_player ON public.player_cards(player_id);

-- ============================================
-- REALTIME PUBLICATION
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_logs;
