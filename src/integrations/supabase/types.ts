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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      avatars: {
        Row: {
          created_at: string
          id: string
          image_url: string
          name: string
          source_photos: string[]
          style: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          name: string
          source_photos?: string[]
          style?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          source_photos?: string[]
          style?: string
        }
        Relationships: []
      }
      project_outputs: {
        Row: {
          aspect_ratio: string | null
          created_at: string
          description: string | null
          estimated_length: string | null
          id: string
          name: string
          project_id: string
          prompt: string | null
          provider: string | null
          script: string | null
          status: string
          thumbnail_url: string | null
          video_url: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string
          description?: string | null
          estimated_length?: string | null
          id?: string
          name: string
          project_id: string
          prompt?: string | null
          provider?: string | null
          script?: string | null
          status?: string
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string
          description?: string | null
          estimated_length?: string | null
          id?: string
          name?: string
          project_id?: string
          prompt?: string | null
          provider?: string | null
          script?: string | null
          status?: string
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_outputs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_timeline: {
        Row: {
          description: string
          id: string
          project_id: string
          status: string
          timestamp: string
          type: string
        }
        Insert: {
          description: string
          id?: string
          project_id: string
          status?: string
          timestamp?: string
          type: string
        }
        Update: {
          description?: string
          id?: string
          project_id?: string
          status?: string
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_timeline_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_versions: {
        Row: {
          changes: string
          created_at: string
          id: string
          project_id: string
          status: string
          version: number
        }
        Insert: {
          changes: string
          created_at?: string
          id?: string
          project_id: string
          status?: string
          version?: number
        }
        Update: {
          changes?: string
          created_at?: string
          id?: string
          project_id?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          aspect_ratio: string
          avatar_id: string | null
          avatar_name: string | null
          brand_id: string | null
          content: Json
          created_at: string
          current_version: number
          enhanced_prompt: string | null
          id: string
          name: string
          output_count: number
          prompt: string | null
          provider: string | null
          scenes: Json
          script: string | null
          settings: Json
          status: string
          tags: string[]
          updated_at: string
          video_type: string
        }
        Insert: {
          aspect_ratio?: string
          avatar_id?: string | null
          avatar_name?: string | null
          brand_id?: string | null
          content?: Json
          created_at?: string
          current_version?: number
          enhanced_prompt?: string | null
          id?: string
          name: string
          output_count?: number
          prompt?: string | null
          provider?: string | null
          scenes?: Json
          script?: string | null
          settings?: Json
          status?: string
          tags?: string[]
          updated_at?: string
          video_type?: string
        }
        Update: {
          aspect_ratio?: string
          avatar_id?: string | null
          avatar_name?: string | null
          brand_id?: string | null
          content?: Json
          created_at?: string
          current_version?: number
          enhanced_prompt?: string | null
          id?: string
          name?: string
          output_count?: number
          prompt?: string | null
          provider?: string | null
          scenes?: Json
          script?: string | null
          settings?: Json
          status?: string
          tags?: string[]
          updated_at?: string
          video_type?: string
        }
        Relationships: []
      }
      saved_trends: {
        Row: {
          category: string
          description: string
          fetched_at: string
          id: string
          platform: string
          summary: string
          tip: string
          title: string
          url: string
          views: string
          visual_style: string
        }
        Insert: {
          category: string
          description?: string
          fetched_at?: string
          id?: string
          platform?: string
          summary?: string
          tip?: string
          title: string
          url?: string
          views?: string
          visual_style?: string
        }
        Update: {
          category?: string
          description?: string
          fetched_at?: string
          id?: string
          platform?: string
          summary?: string
          tip?: string
          title?: string
          url?: string
          views?: string
          visual_style?: string
        }
        Relationships: []
      }
      voices: {
        Row: {
          audio_url: string
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          id?: string
          name: string
          type?: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
