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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calibration_annotations: {
        Row: {
          annotated_at: string
          annotated_by: string
          findings_correct: string | null
          findings_invented: string | null
          findings_missed: string | null
          id: string
          notes: string | null
          reading_id: string
          real_constitution: string
          real_iris_color: string
          reviewed: boolean
          reviewed_at: string | null
        }
        Insert: {
          annotated_at?: string
          annotated_by: string
          findings_correct?: string | null
          findings_invented?: string | null
          findings_missed?: string | null
          id?: string
          notes?: string | null
          reading_id: string
          real_constitution: string
          real_iris_color: string
          reviewed?: boolean
          reviewed_at?: string | null
        }
        Update: {
          annotated_at?: string
          annotated_by?: string
          findings_correct?: string | null
          findings_invented?: string | null
          findings_missed?: string | null
          id?: string
          notes?: string | null
          reading_id?: string
          real_constitution?: string
          real_iris_color?: string
          reviewed?: boolean
          reviewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calibration_annotations_reading_id_fkey"
            columns: ["reading_id"]
            isOneToOne: true
            referencedRelation: "readings"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_diagnoses: {
        Row: {
          created_at: string
          diagnosed_by: string
          diagnosis: string
          id: string
          reading_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          diagnosed_by: string
          diagnosis?: string
          id?: string
          reading_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          diagnosed_by?: string
          diagnosis?: string
          id?: string
          reading_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calibration_diagnoses_reading_id_fkey"
            columns: ["reading_id"]
            isOneToOne: true
            referencedRelation: "readings"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          birth_date: string | null
          consent_document_url: string | null
          consent_signed_at: string | null
          created_at: string | null
          full_name: string
          gender: string | null
          id: string
          notes: string | null
          therapist_id: string
        }
        Insert: {
          birth_date?: string | null
          consent_document_url?: string | null
          consent_signed_at?: string | null
          created_at?: string | null
          full_name: string
          gender?: string | null
          id?: string
          notes?: string | null
          therapist_id: string
        }
        Update: {
          birth_date?: string | null
          consent_document_url?: string | null
          consent_signed_at?: string | null
          created_at?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          notes?: string | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          content: string
          content_hash: string | null
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          source_book: string
          source_chapter: string | null
          source_page: number | null
          source_type: string
        }
        Insert: {
          content: string
          content_hash?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_book: string
          source_chapter?: string | null
          source_page?: number | null
          source_type?: string
        }
        Update: {
          content?: string
          content_hash?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_book?: string
          source_chapter?: string | null
          source_page?: number | null
          source_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string | null
          full_name: string
          id: string
          phone: string | null
          professional_id: string | null
          state: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          trial_ends_at: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string | null
          full_name: string
          id: string
          phone?: string | null
          professional_id?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          professional_id?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      reading_images: {
        Row: {
          angle: string
          created_at: string | null
          eye: string
          height: number | null
          id: string
          quality_score: number | null
          reading_id: string
          storage_path: string
          width: number | null
        }
        Insert: {
          angle: string
          created_at?: string | null
          eye: string
          height?: number | null
          id?: string
          quality_score?: number | null
          reading_id: string
          storage_path: string
          width?: number | null
        }
        Update: {
          angle?: string
          created_at?: string | null
          eye?: string
          height?: number | null
          id?: string
          quality_score?: number | null
          reading_id?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_images_reading_id_fkey"
            columns: ["reading_id"]
            isOneToOne: false
            referencedRelation: "readings"
            referencedColumns: ["id"]
          },
        ]
      }
      readings: {
        Row: {
          ai_report_edited: string | null
          ai_report_raw: string | null
          audit_metadata: Json | null
          capture_method: string | null
          client_id: string
          clinical_feedback: Json | null
          created_at: string | null
          delivered_at: string | null
          edit_diff: Json | null
          exam_notes: string | null
          feedback_collected_at: string | null
          id: string
          iris_map: string | null
          is_delivered: boolean | null
          processed_at: string | null
          regeneration_count: number | null
          regeneration_log: Json | null
          report_delivered: Json | null
          report_delivered_at: string | null
          report_generated: Json | null
          report_generated_at: string | null
          report_raw_text: string | null
          status: string | null
          therapist_id: string
          therapist_notes: string | null
          tipo_edicao: string[] | null
          vision_features: Json | null
          zonas_editadas: Json | null
        }
        Insert: {
          ai_report_edited?: string | null
          ai_report_raw?: string | null
          audit_metadata?: Json | null
          capture_method?: string | null
          client_id: string
          clinical_feedback?: Json | null
          created_at?: string | null
          delivered_at?: string | null
          edit_diff?: Json | null
          exam_notes?: string | null
          feedback_collected_at?: string | null
          id?: string
          iris_map?: string | null
          is_delivered?: boolean | null
          processed_at?: string | null
          regeneration_count?: number | null
          regeneration_log?: Json | null
          report_delivered?: Json | null
          report_delivered_at?: string | null
          report_generated?: Json | null
          report_generated_at?: string | null
          report_raw_text?: string | null
          status?: string | null
          therapist_id: string
          therapist_notes?: string | null
          tipo_edicao?: string[] | null
          vision_features?: Json | null
          zonas_editadas?: Json | null
        }
        Update: {
          ai_report_edited?: string | null
          ai_report_raw?: string | null
          audit_metadata?: Json | null
          capture_method?: string | null
          client_id?: string
          clinical_feedback?: Json | null
          created_at?: string | null
          delivered_at?: string | null
          edit_diff?: Json | null
          exam_notes?: string | null
          feedback_collected_at?: string | null
          id?: string
          iris_map?: string | null
          is_delivered?: boolean | null
          processed_at?: string | null
          regeneration_count?: number | null
          regeneration_log?: Json | null
          report_delivered?: Json | null
          report_delivered_at?: string | null
          report_generated?: Json | null
          report_generated_at?: string | null
          report_raw_text?: string | null
          status?: string | null
          therapist_id?: string
          therapist_notes?: string | null
          tipo_edicao?: string[] | null
          vision_features?: Json | null
          zonas_editadas?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "readings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readings_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          id: string
          plan: string
          status: string
          stripe_subscription_id: string
          therapist_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan: string
          status: string
          stripe_subscription_id: string
          therapist_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_subscription_id?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      jsonb_concat_sections_pt_br: { Args: { input: Json }; Returns: string }
      match_knowledge_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          score: number
          source_book: string
          source_chapter: string
          source_page: number
          source_type: string
        }[]
      }
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
