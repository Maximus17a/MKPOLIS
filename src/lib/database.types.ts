export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
        };
        Update: {
          username?: string;
          avatar_url?: string | null;
        };
      };
      games: {
        Row: {
          id: string;
          host_id: string;
          status: 'waiting' | 'in_progress' | 'finished';
          current_turn_player_id: string | null;
          turn_phase: 'roll' | 'action' | 'end';
          version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          status?: 'waiting' | 'in_progress' | 'finished';
          current_turn_player_id?: string | null;
          turn_phase?: 'roll' | 'action' | 'end';
          version?: number;
        };
        Update: {
          status?: 'waiting' | 'in_progress' | 'finished';
          current_turn_player_id?: string | null;
          turn_phase?: 'roll' | 'action' | 'end';
          version?: number;
        };
      };
      players: {
        Row: {
          id: string;
          game_id: string;
          user_id: string;
          position_index: number;
          balance: number;
          is_bankrupt: boolean;
          jail_turns_remaining: number;
          stun_turns_remaining: number;
          turn_order: number;
          color: string;
          version: number;
        };
        Insert: {
          id?: string;
          game_id: string;
          user_id: string;
          position_index?: number;
          balance?: number;
          turn_order: number;
          color?: string;
        };
        Update: {
          position_index?: number;
          balance?: number;
          is_bankrupt?: boolean;
          jail_turns_remaining?: number;
          stun_turns_remaining?: number;
          version?: number;
        };
      };
      properties: {
        Row: {
          id: string;
          game_id: string;
          property_index: number;
          owner_id: string | null;
          server_level: number;
          is_mortgaged: boolean;
          version: number;
        };
        Insert: {
          id?: string;
          game_id: string;
          property_index: number;
          owner_id?: string | null;
        };
        Update: {
          owner_id?: string | null;
          server_level?: number;
          is_mortgaged?: boolean;
          version?: number;
        };
      };
      player_cards: {
        Row: {
          id: string;
          game_id: string;
          player_id: string;
          card_type: 'stun' | 'respawn' | 'loot_drop' | 'gankeo';
          is_used: boolean;
        };
        Insert: {
          id?: string;
          game_id: string;
          player_id: string;
          card_type: 'stun' | 'respawn' | 'loot_drop' | 'gankeo';
        };
        Update: {
          is_used?: boolean;
        };
      };
      game_logs: {
        Row: {
          id: string;
          game_id: string;
          player_id: string | null;
          message: string;
          action_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          player_id?: string | null;
          message: string;
          action_type: string;
        };
        Update: never;
      };
    };
  };
}

// Convenience aliases
export type Game = Database['public']['Tables']['games']['Row'];
export type Player = Database['public']['Tables']['players']['Row'];
export type Property = Database['public']['Tables']['properties']['Row'];
export type PlayerCard = Database['public']['Tables']['player_cards']['Row'];
export type GameLog = Database['public']['Tables']['game_logs']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
