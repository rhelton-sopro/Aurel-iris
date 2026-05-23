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
      ai_model_pricing: {
        Row: {
          created_at: string
          id: string
          input_usd_per_mtok: number
          model_pattern: string
          notes: string | null
          output_usd_per_mtok: number
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          input_usd_per_mtok: number
          model_pattern: string
          notes?: string | null
          output_usd_per_mtok: number
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          input_usd_per_mtok?: number
          model_pattern?: string
          notes?: string | null
          output_usd_per_mtok?: number
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
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
      capture_attempts: {
        Row: {
          accepted: boolean
          browser_family: string | null
          cost_estimate_usd: number | null
          created_at: string
          device_type: string | null
          id: string
          image_bytes: number
          latency_ms: number
          model_version: string
          os_family: string | null
          therapist_id: string
          tokens_in: number | null
          tokens_out: number | null
          user_agent: string | null
          vlm_quality: string
          vlm_reason: string
        }
        Insert: {
          accepted: boolean
          browser_family?: string | null
          cost_estimate_usd?: number | null
          created_at?: string
          device_type?: string | null
          id?: string
          image_bytes: number
          latency_ms: number
          model_version: string
          os_family?: string | null
          therapist_id: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_agent?: string | null
          vlm_quality: string
          vlm_reason: string
        }
        Update: {
          accepted?: boolean
          browser_family?: string | null
          cost_estimate_usd?: number | null
          created_at?: string
          device_type?: string | null
          id?: string
          image_bytes?: number
          latency_ms?: number
          model_version?: string
          os_family?: string | null
          therapist_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_agent?: string | null
          vlm_quality?: string
          vlm_reason?: string
        }
        Relationships: []
      }
      client_consents: {
        Row: {
          client_id: string | null
          consent_channel: string
          consented_at: string
          created_at: string
          event_type: string
          id: string
          ip: unknown
          reading_id: string | null
          term_version: string
          user_agent: string | null
        }
        Insert: {
          client_id?: string | null
          consent_channel: string
          consented_at?: string
          created_at?: string
          event_type: string
          id?: string
          ip?: unknown
          reading_id?: string | null
          term_version: string
          user_agent?: string | null
        }
        Update: {
          client_id?: string | null
          consent_channel?: string
          consented_at?: string
          created_at?: string
          event_type?: string
          id?: string
          ip?: unknown
          reading_id?: string | null
          term_version?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invite_tokens: {
        Row: {
          client_id: string | null
          created_at: string
          expires_at: string
          id: string
          therapist_id: string
          token: string
          used_at: string | null
          used_by_client_id: string | null
          used_by_reading_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          therapist_id: string
          token: string
          used_at?: string | null
          used_by_client_id?: string | null
          used_by_reading_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          therapist_id?: string
          token?: string
          used_at?: string | null
          used_by_client_id?: string | null
          used_by_reading_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invite_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invite_tokens_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invite_tokens_used_by_client_id_fkey"
            columns: ["used_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invite_tokens_used_by_reading_id_fkey"
            columns: ["used_by_reading_id"]
            isOneToOne: false
            referencedRelation: "readings"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          biological_sex: string | null
          birth_date: string | null
          consent_current_version: string | null
          consent_last_at: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_self: boolean
          notes: string | null
          phone: string | null
          therapist_id: string
        }
        Insert: {
          biological_sex?: string | null
          birth_date?: string | null
          consent_current_version?: string | null
          consent_last_at?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_self?: boolean
          notes?: string | null
          phone?: string | null
          therapist_id: string
        }
        Update: {
          biological_sex?: string | null
          birth_date?: string | null
          consent_current_version?: string | null
          consent_last_at?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_self?: boolean
          notes?: string | null
          phone?: string | null
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
      consent_terms: {
        Row: {
          body: string
          content_sha256: string
          created_at: string
          effective_from: string
          id: string
          is_current: boolean
          version: string
        }
        Insert: {
          body: string
          content_sha256: string
          created_at?: string
          effective_from?: string
          id?: string
          is_current?: boolean
          version: string
        }
        Update: {
          body?: string
          content_sha256?: string
          created_at?: string
          effective_from?: string
          id?: string
          is_current?: boolean
          version?: string
        }
        Relationships: []
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
          beta_readings_used: number
          bio: string | null
          city: string | null
          created_at: string | null
          full_name: string
          id: string
          phone: string | null
          professional_id: string | null
          specialties: string[] | null
          state: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          tos_accepted_at: string | null
          tos_version: string | null
          trial_ends_at: string | null
        }
        Insert: {
          beta_readings_used?: number
          bio?: string | null
          city?: string | null
          created_at?: string | null
          full_name: string
          id: string
          phone?: string | null
          professional_id?: string | null
          specialties?: string[] | null
          state?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          beta_readings_used?: number
          bio?: string | null
          city?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          professional_id?: string | null
          specialties?: string[] | null
          state?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      reading_addons: {
        Row: {
          addon_type: string
          created_at: string
          credit_cost: number
          generated_at: string | null
          generated_content: Json | null
          id: string
          model_version: string | null
          reading_id: string
          therapist_id: string
        }
        Insert: {
          addon_type: string
          created_at?: string
          credit_cost?: number
          generated_at?: string | null
          generated_content?: Json | null
          id?: string
          model_version?: string | null
          reading_id: string
          therapist_id: string
        }
        Update: {
          addon_type?: string
          created_at?: string
          credit_cost?: number
          generated_at?: string | null
          generated_content?: Json | null
          id?: string
          model_version?: string | null
          reading_id?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_addons_reading_id_fkey"
            columns: ["reading_id"]
            isOneToOne: false
            referencedRelation: "readings"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_images: {
        Row: {
          angle: string
          canonical_storage_path: string | null
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
          canonical_storage_path?: string | null
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
          canonical_storage_path?: string | null
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
          analysis_completed_at: string | null
          analysis_started_at: string | null
          audit_metadata: Json | null
          beta_counted: boolean
          canonical_metadata: Json | null
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
          report_generated_sam: Json | null
          report_generated_sam_at: string | null
          report_generated_sonnet_direct: Json | null
          report_generated_sonnet_direct_at: string | null
          report_raw_text: string | null
          report_v2: Json | null
          report_v2_delivered: Json | null
          report_v2_delivered_at: string | null
          report_v2_edit_diff: Json | null
          report_v2_generated_at: string | null
          report_version: string
          sam_run_metadata: Json | null
          seen_by_therapist_at: string | null
          sonnet_direct_run_metadata: Json | null
          status: string | null
          therapist_id: string
          therapist_notes: string | null
          tipo_edicao: string[] | null
          vision_features: Json | null
          vision_features_sam: Json | null
          zonas_editadas: Json | null
        }
        Insert: {
          analysis_completed_at?: string | null
          analysis_started_at?: string | null
          audit_metadata?: Json | null
          beta_counted?: boolean
          canonical_metadata?: Json | null
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
          report_generated_sam?: Json | null
          report_generated_sam_at?: string | null
          report_generated_sonnet_direct?: Json | null
          report_generated_sonnet_direct_at?: string | null
          report_raw_text?: string | null
          report_v2?: Json | null
          report_v2_delivered?: Json | null
          report_v2_delivered_at?: string | null
          report_v2_edit_diff?: Json | null
          report_v2_generated_at?: string | null
          report_version?: string
          sam_run_metadata?: Json | null
          seen_by_therapist_at?: string | null
          sonnet_direct_run_metadata?: Json | null
          status?: string | null
          therapist_id: string
          therapist_notes?: string | null
          tipo_edicao?: string[] | null
          vision_features?: Json | null
          vision_features_sam?: Json | null
          zonas_editadas?: Json | null
        }
        Update: {
          analysis_completed_at?: string | null
          analysis_started_at?: string | null
          audit_metadata?: Json | null
          beta_counted?: boolean
          canonical_metadata?: Json | null
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
          report_generated_sam?: Json | null
          report_generated_sam_at?: string | null
          report_generated_sonnet_direct?: Json | null
          report_generated_sonnet_direct_at?: string | null
          report_raw_text?: string | null
          report_v2?: Json | null
          report_v2_delivered?: Json | null
          report_v2_delivered_at?: string | null
          report_v2_edit_diff?: Json | null
          report_v2_generated_at?: string | null
          report_version?: string
          sam_run_metadata?: Json | null
          seen_by_therapist_at?: string | null
          sonnet_direct_run_metadata?: Json | null
          status?: string | null
          therapist_id?: string
          therapist_notes?: string | null
          tipo_edicao?: string[] | null
          vision_features?: Json | null
          vision_features_sam?: Json | null
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
      report_findings: {
        Row: {
          cost_usd: number | null
          exame_json: Json
          generated_at: string
          id: string
          latency_ms: number | null
          method_version: string
          model: string
          prompt_sha: string
          prompt_version: string
          raw_xml: string
          reading_id: string
          superseded_at: string | null
          therapist_id: string
          tokens_in: number | null
          tokens_out: number | null
          validation_status: string
        }
        Insert: {
          cost_usd?: number | null
          exame_json: Json
          generated_at?: string
          id?: string
          latency_ms?: number | null
          method_version: string
          model: string
          prompt_sha: string
          prompt_version: string
          raw_xml: string
          reading_id: string
          superseded_at?: string | null
          therapist_id: string
          tokens_in?: number | null
          tokens_out?: number | null
          validation_status: string
        }
        Update: {
          cost_usd?: number | null
          exame_json?: Json
          generated_at?: string
          id?: string
          latency_ms?: number | null
          method_version?: string
          model?: string
          prompt_sha?: string
          prompt_version?: string
          raw_xml?: string
          reading_id?: string
          superseded_at?: string | null
          therapist_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
          validation_status?: string
        }
        Relationships: []
      }
      report_generations: {
        Row: {
          audit_summary: Json | null
          bbox_cost_usd: number | null
          bbox_latency_ms: number | null
          canonical_fallback_count: number | null
          client_id: string | null
          cost_usd: number | null
          created_at: string
          generated_at: string
          id: string
          latency_ms: number | null
          method: string
          model_version: string | null
          prompt_version: string | null
          reading_id: string
          regeneration_count: number | null
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          audit_summary?: Json | null
          bbox_cost_usd?: number | null
          bbox_latency_ms?: number | null
          canonical_fallback_count?: number | null
          client_id?: string | null
          cost_usd?: number | null
          created_at?: string
          generated_at?: string
          id?: string
          latency_ms?: number | null
          method: string
          model_version?: string | null
          prompt_version?: string | null
          reading_id: string
          regeneration_count?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          audit_summary?: Json | null
          bbox_cost_usd?: number | null
          bbox_latency_ms?: number | null
          canonical_fallback_count?: number | null
          client_id?: string | null
          cost_usd?: number | null
          created_at?: string
          generated_at?: string
          id?: string
          latency_ms?: number | null
          method?: string
          model_version?: string | null
          prompt_version?: string | null
          reading_id?: string
          regeneration_count?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: []
      }
      report_phrases: {
        Row: {
          generated_at: string
          id: string
          markdown_blob_url: string | null
          method_version: string
          phrases: Json
          prompt_sha: string
          prompt_version: string
          reading_id: string
          superseded_at: string | null
          therapist_id: string
        }
        Insert: {
          generated_at?: string
          id?: string
          markdown_blob_url?: string | null
          method_version: string
          phrases: Json
          prompt_sha: string
          prompt_version: string
          reading_id: string
          superseded_at?: string | null
          therapist_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          markdown_blob_url?: string | null
          method_version?: string
          phrases?: Json
          prompt_sha?: string
          prompt_version?: string
          reading_id?: string
          superseded_at?: string | null
          therapist_id?: string
        }
        Relationships: []
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
      increment_beta_readings_used: {
        Args: { p_therapist: string }
        Returns: undefined
      }
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
      persist_report_findings_versioned: {
        Args: {
          p_cost_usd: number
          p_exame_json: Json
          p_latency_ms: number
          p_method_version: string
          p_model: string
          p_prompt_sha: string
          p_prompt_version: string
          p_raw_xml: string
          p_reading_id: string
          p_therapist_id: string
          p_tokens_in: number
          p_tokens_out: number
          p_validation_status: string
        }
        Returns: string
      }
      persist_report_phrases_versioned: {
        Args: {
          p_markdown_blob_url: string
          p_method_version: string
          p_phrases: Json
          p_prompt_sha: string
          p_prompt_version: string
          p_reading_id: string
          p_therapist_id: string
        }
        Returns: string
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
