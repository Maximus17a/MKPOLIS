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
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          host_id: string;
          status: 'waiting' | 'pre_roll' | 'in_progress' | 'finished';
          current_turn_player_id: string | null;
          turn_phase: 'roll' | 'action' | 'end';
          version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          status?: 'waiting' | 'pre_roll' | 'in_progress' | 'finished';
          current_turn_player_id?: string | null;
          turn_phase?: 'roll' | 'action' | 'end';
          version?: number;
        };
        Update: {
          status?: 'waiting' | 'pre_roll' | 'in_progress' | 'finished';
          current_turn_player_id?: string | null;
          turn_phase?: 'roll' | 'action' | 'end';
          version?: number;
        };
        Relationships: [];
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
          active_quest_id: string | null;
          quest_progress: number;
          boss_immunity: boolean;
          piece: string | null;
          pre_roll_result: number | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          user_id: string;
          position_index?: number;
          balance?: number;
          turn_order: number;
          color?: string;
          piece?: string | null;
          pre_roll_result?: number | null;
        };
        Update: {
          position_index?: number;
          balance?: number;
          is_bankrupt?: boolean;
          jail_turns_remaining?: number;
          stun_turns_remaining?: number;
          version?: number;
          piece?: string | null;
          pre_roll_result?: number | null;
          turn_order?: number;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      trade_offers: {
        Row: {
          id: string;
          game_id: string;
          sender_id: string;
          receiver_id: string;
          offered_money: number;
          requested_money: number;
          offered_properties: number[];
          requested_properties: number[];
          status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          sender_id: string;
          receiver_id: string;
          offered_money?: number;
          requested_money?: number;
          offered_properties?: number[];
          requested_properties?: number[];
          status?: 'pending' | 'accepted' | 'rejected' | 'cancelled';
        };
        Update: {
          status?: 'pending' | 'accepted' | 'rejected' | 'cancelled';
        };
        Relationships: [];
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
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
}

// Convenience aliases
export type Game = Database['public']['Tables']['games']['Row'];
export type Player = Database['public']['Tables']['players']['Row'];
export type Property = Database['public']['Tables']['properties']['Row'];
export type PlayerCard = Database['public']['Tables']['player_cards']['Row'];
export type GameLog = Database['public']['Tables']['game_logs']['Row'];
export type TradeOffer = Database['public']['Tables']['trade_offers']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
