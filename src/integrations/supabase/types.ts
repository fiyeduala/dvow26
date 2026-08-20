export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      event_settings: {
        Row: {
          ceremony_address: string
          ceremony_map_url: string
          ceremony_time: string
          ceremony_venue: string
          created_at: string
          directions: string
          dress_code: string
          id: string
          parking_notes: string
          reception_address: string
          reception_map_url: string
          reception_time: string
          reception_venue: string
          updated_at: string
        }
        Insert: {
          ceremony_address?: string
          ceremony_map_url?: string
          ceremony_time?: string
          ceremony_venue?: string
          created_at?: string
          directions?: string
          dress_code?: string
          id?: string
          parking_notes?: string
          reception_address?: string
          reception_map_url?: string
          reception_time?: string
          reception_venue?: string
          updated_at?: string
        }
        Update: {
          ceremony_address?: string
          ceremony_map_url?: string
          ceremony_time?: string
          ceremony_venue?: string
          created_at?: string
          directions?: string
          dress_code?: string
          id?: string
          parking_notes?: string
          reception_address?: string
          reception_map_url?: string
          reception_time?: string
          reception_venue?: string
          updated_at?: string
        }
        Relationships: []
      }
      guests: {
        Row: {
          access_code: string
          attending: boolean | null
          ceremonies: string | null
          created_at: string
          dietary_notes: string | null
          first_opened_at: string | null
          full_name: string
          id: string
          is_active: boolean
          meal_choice: string | null
          message: string | null
          plus_one_name: string | null
          responded_at: string | null
          seats: number
          self_registered: boolean
          table_assignment: string | null
          updated_at: string
        }
        Insert: {
          access_code: string
          attending?: boolean | null
          ceremonies?: string | null
          created_at?: string
          dietary_notes?: string | null
          first_opened_at?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          meal_choice?: string | null
          message?: string | null
          plus_one_name?: string | null
          responded_at?: string | null
          seats?: number
          self_registered?: boolean
          table_assignment?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string
          attending?: boolean | null
          ceremonies?: string | null
          created_at?: string
          dietary_notes?: string | null
          first_opened_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          meal_choice?: string | null
          message?: string | null
          plus_one_name?: string | null
          responded_at?: string | null
          seats?: number
          self_registered?: boolean
          table_assignment?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_admin: { Args: never; Returns: boolean }
      create_rsvp: {
        Args: {
          _attending: boolean
          _ceremonies?: string
          _dietary_notes?: string
          _full_name: string
          _meal_choice?: string
          _message?: string
        }
        Returns: string
      }
      generate_access_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_code: { Args: { _code: string }; Returns: string }
      submit_rsvp: {
        Args: {
          _attending: boolean
          _ceremonies?: string
          _code: string
          _dietary_notes?: string
          _meal_choice?: string
          _message?: string
          _plus_one_name?: string
        }
        Returns: boolean
      }
      verify_access_code: {
        Args: { _code: string }
        Returns: {
          attending: boolean
          ceremonies: string
          dietary_notes: string
          full_name: string
          meal_choice: string
          message: string
          plus_one_name: string
          responded_at: string
          seats: number
          table_assignment: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
