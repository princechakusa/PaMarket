export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; name: string | null; role: string | null };
        Insert: { id: string; name?: string | null; role?: string | null };
        Update: { name?: string | null; role?: string | null };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

// Stage C intentionally contains only the profile fields needed to authorize
// the shell. Generate full types before any feature begins reading live data.
