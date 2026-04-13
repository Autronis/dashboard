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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      emails: {
        Row: {
          company_summary: string | null
          created_at: string
          email_status: string | null
          generated_email: string | null
          generated_subject: string | null
          google_maps_lead_id: string | null
          id: string
          lead_id: string | null
          missing_info: Json | null
          painpoint_used: string | null
          recipient_email: string | null
          reply_body: string | null
          reply_received_at: string | null
          reply_subject: string | null
          source: string
          thread_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_summary?: string | null
          created_at?: string
          email_status?: string | null
          generated_email?: string | null
          generated_subject?: string | null
          google_maps_lead_id?: string | null
          id?: string
          lead_id?: string | null
          missing_info?: Json | null
          painpoint_used?: string | null
          recipient_email?: string | null
          reply_body?: string | null
          reply_received_at?: string | null
          reply_subject?: string | null
          source?: string
          thread_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_summary?: string | null
          created_at?: string
          email_status?: string | null
          generated_email?: string | null
          generated_subject?: string | null
          google_maps_lead_id?: string | null
          id?: string
          lead_id?: string | null
          missing_info?: Json | null
          painpoint_used?: string | null
          recipient_email?: string | null
          reply_body?: string | null
          reply_received_at?: string | null
          reply_subject?: string | null
          source?: string
          thread_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_google_maps_lead_id_fkey"
            columns: ["google_maps_lead_id"]
            isOneToOne: false
            referencedRelation: "google_maps_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_maps_leads: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          description: string | null
          email: string | null
          employee_count: string | null
          folder: string | null
          google_maps_url: string | null
          id: string
          location: string | null
          name: string | null
          opening_hours: Json | null
          phone: string | null
          place_id: string | null
          rating: number | null
          reviews_count: number | null
          search_term: string | null
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          employee_count?: string | null
          folder?: string | null
          google_maps_url?: string | null
          id?: string
          location?: string | null
          name?: string | null
          opening_hours?: Json | null
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          reviews_count?: number | null
          search_term?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          employee_count?: string | null
          folder?: string | null
          google_maps_url?: string | null
          id?: string
          location?: string | null
          name?: string | null
          opening_hours?: Json | null
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          reviews_count?: number | null
          search_term?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          description: string | null
          email_found: boolean
          email_status: string | null
          emailed_at: string | null
          emails: string | null
          employee_count: string | null
          enrichment_status: string | null
          folder: string | null
          followers: string | null
          generated_email: string | null
          generated_subject: string | null
          google_maps_url: string | null
          id: string
          linkedin_url: string | null
          location: string | null
          name: string | null
          opening_hours: Json | null
          outreach_domein: string | null
          outreach_status: string | null
          outreach_subject: string | null
          painpoint_used: string | null
          phone: string | null
          phone_found: boolean
          place_id: string | null
          rating: number | null
          reply_body: string | null
          reply_received_at: string | null
          reply_subject: string | null
          reviews_count: number | null
          search_term: string | null
          source: string | null
          updated_at: string
          user_id: string | null
          website: string | null
          website_found: boolean
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          email_found?: boolean
          email_status?: string | null
          emailed_at?: string | null
          emails?: string | null
          employee_count?: string | null
          enrichment_status?: string | null
          folder?: string | null
          followers?: string | null
          generated_email?: string | null
          generated_subject?: string | null
          google_maps_url?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          name?: string | null
          opening_hours?: Json | null
          outreach_domein?: string | null
          outreach_status?: string | null
          outreach_subject?: string | null
          painpoint_used?: string | null
          phone?: string | null
          phone_found?: boolean
          place_id?: string | null
          rating?: number | null
          reply_body?: string | null
          reply_received_at?: string | null
          reply_subject?: string | null
          reviews_count?: number | null
          search_term?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
          website_found?: boolean
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          email_found?: boolean
          email_status?: string | null
          emailed_at?: string | null
          emails?: string | null
          employee_count?: string | null
          enrichment_status?: string | null
          folder?: string | null
          followers?: string | null
          generated_email?: string | null
          generated_subject?: string | null
          google_maps_url?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          name?: string | null
          opening_hours?: Json | null
          outreach_domein?: string | null
          outreach_status?: string | null
          outreach_subject?: string | null
          painpoint_used?: string | null
          phone?: string | null
          phone_found?: boolean
          place_id?: string | null
          rating?: number | null
          reply_body?: string | null
          reply_received_at?: string | null
          reply_subject?: string | null
          reviews_count?: number | null
          search_term?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
          website_found?: boolean
        }
        Relationships: []
      }
      outreach_settings: {
        Row: {
          dag_limiet: number | null
          emails_verstuurd_vandaag: number | null
          id: string
          laatst_gereset: string | null
          user_id: string
          warmup_gestart_op: string | null
        }
        Insert: {
          dag_limiet?: number | null
          emails_verstuurd_vandaag?: number | null
          id?: string
          laatst_gereset?: string | null
          user_id: string
          warmup_gestart_op?: string | null
        }
        Update: {
          dag_limiet?: number | null
          emails_verstuurd_vandaag?: number | null
          id?: string
          laatst_gereset?: string | null
          user_id?: string
          warmup_gestart_op?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scraper_runs: {
        Row: {
          created_at: string
          error_message: string | null
          folder: string | null
          id: string
          location: string | null
          max_items: number | null
          search_query: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          folder?: string | null
          id?: string
          location?: string | null
          max_items?: number | null
          search_query?: string | null
          source: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          folder?: string | null
          id?: string
          location?: string | null
          max_items?: number | null
          search_query?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unsubscribes: {
        Row: {
          created_at: string | null
          domein: string | null
          email: string
          id: string
          reden: string | null
        }
        Insert: {
          created_at?: string | null
          domein?: string | null
          email: string
          id?: string
          reden?: string | null
        }
        Update: {
          created_at?: string | null
          domein?: string | null
          email?: string
          id?: string
          reden?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      website_lead_searches: {
        Row: {
          city: string
          created_at: string
          id: string
          is_active: boolean
          last_run: string | null
          leads_found: number
          max_results: number
          query: string
          source: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_run?: string | null
          leads_found?: number
          max_results?: number
          query: string
          source?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_run?: string | null
          leads_found?: number
          max_results?: number
          query?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      website_leads: {
        Row: {
          address: string | null
          call_date: string | null
          call_notes: string | null
          category: string | null
          city: string | null
          created_at: string
          description: string | null
          email: string | null
          facebook_url: string | null
          google_maps_url: string | null
          id: string
          name: string
          phone: string | null
          postal_code: string | null
          rating: number | null
          reviews_count: number | null
          search_query: string | null
          source: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          call_date?: string | null
          call_notes?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          facebook_url?: string | null
          google_maps_url?: string | null
          id?: string
          name: string
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          reviews_count?: number | null
          search_query?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          call_date?: string | null
          call_notes?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          facebook_url?: string | null
          google_maps_url?: string | null
          id?: string
          name?: string
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          reviews_count?: number | null
          search_query?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_emails_sent: {
        Args: { p_count: number; p_today: string; p_user_id: string }
        Returns: undefined
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
