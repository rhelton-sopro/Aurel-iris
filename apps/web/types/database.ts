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
      social_posts: {
        Row: {
          caption: string
          comment: string | null
          created_at: string
          format: string
          generated_by: string[]
          id: string
          media: Json
          pilar: string | null
          scheduled_at: string | null
          sort_order: number
          status: string
          suggested_slot: string | null
          tags: string[]
          updated_at: string
          why: string | null
        }
        Insert: {
          caption?: string
          comment?: string | null
          created_at?: string
          format?: string
          generated_by?: string[]
          id?: string
          media?: Json
          pilar?: string | null
          scheduled_at?: string | null
          sort_order?: number
          status?: string
          suggested_slot?: string | null
          tags?: string[]
          updated_at?: string
          why?: string | null
        }
        Update: {
          caption?: string
          comment?: string | null
          created_at?: string
          format?: string
          generated_by?: string[]
          id?: string
          media?: Json
          pilar?: string | null
          scheduled_at?: string | null
          sort_order?: number
          status?: string
          suggested_slot?: string | null
          tags?: string[]
          updated_at?: string
          why?: string | null
        }
        Relationships: []
      }
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
      asaas_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          payload: Json
          payment_id: string | null
          processed_at: string | null
          received_at: string
          status: string
        }
        Insert: {
          event_id: string
          event_type: string
          payload: Json
          payment_id?: string | null
          processed_at?: string | null
          received_at?: string
          status?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
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
          notify_on_capture_complete: boolean
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
          notify_on_capture_complete?: boolean
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
          notify_on_capture_complete?: boolean
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
      credit_packages: {
        Row: {
          active: boolean
          badge: string | null
          created_at: string
          display_order: number
          id: string
          leituras_count: number
          name: string
          price_brl: number
          sku: string
        }
        Insert: {
          active?: boolean
          badge?: string | null
          created_at?: string
          display_order?: number
          id?: string
          leituras_count: number
          name: string
          price_brl: number
          sku: string
        }
        Update: {
          active?: boolean
          badge?: string | null
          created_at?: string
          display_order?: number
          id?: string
          leituras_count?: number
          name?: string
          price_brl?: number
          sku?: string
        }
        Relationships: []
      }
      credit_reservations: {
        Row: {
          created_at: string
          credit_id: string | null
          expires_at: string
          id: string
          reading_id: string
          released_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_id?: string | null
          expires_at: string
          id?: string
          reading_id: string
          released_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_id?: string | null
          expires_at?: string
          id?: string
          reading_id?: string
          released_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_reservations_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "customer_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          created_at: string
          credit_id: string | null
          id: string
          notes: string | null
          reading_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          created_at?: string
          credit_id?: string | null
          id?: string
          notes?: string | null
          reading_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          created_at?: string
          credit_id?: string | null
          id?: string
          notes?: string | null
          reading_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "customer_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credits: {
        Row: {
          asaas_installment_id: string | null
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          asaas_payment_status: string | null
          created_at: string
          expires_at: string
          id: string
          leituras_purchased: number
          leituras_remaining: number
          leituras_reserved: number
          package_id: string
          paid_brl: number | null
          purchase_date: string
          status: string
          user_id: string
        }
        Insert: {
          asaas_installment_id?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          asaas_payment_status?: string | null
          created_at?: string
          expires_at: string
          id?: string
          leituras_purchased: number
          leituras_remaining: number
          leituras_reserved?: number
          package_id: string
          paid_brl?: number | null
          purchase_date?: string
          status?: string
          user_id: string
        }
        Update: {
          asaas_installment_id?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          asaas_payment_status?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          leituras_purchased?: number
          leituras_remaining?: number
          leituras_reserved?: number
          package_id?: string
          paid_brl?: number | null
          purchase_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_user_id_fkey"
            columns: ["user_id"]
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
          address: string | null
          address_complement: string | null
          address_number: string | null
          asaas_customer_id: string | null
          beta_readings_used: number
          bio: string | null
          cep: string | null
          city: string | null
          cpf: string | null
          created_at: string | null
          district: string | null
          full_name: string
          id: string
          internal_use: boolean
          onboarding_dismissed_at: string | null
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
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          asaas_customer_id?: string | null
          beta_readings_used?: number
          bio?: string | null
          cep?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string | null
          district?: string | null
          full_name: string
          id: string
          internal_use?: boolean
          onboarding_dismissed_at?: string | null
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
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          asaas_customer_id?: string | null
          beta_readings_used?: number
          bio?: string | null
          cep?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string | null
          district?: string | null
          full_name?: string
          id?: string
          internal_use?: boolean
          onboarding_dismissed_at?: string | null
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
          notification_sent_at: string | null
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
          notification_sent_at?: string | null
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
          notification_sent_at?: string | null
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
          cache_creation_input_tokens: number | null
          cache_read_input_tokens: number | null
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
          cache_creation_input_tokens?: number | null
          cache_read_input_tokens?: number | null
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
          cache_creation_input_tokens?: number | null
          cache_read_input_tokens?: number | null
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
          cache_creation_input_tokens: number | null
          cache_read_input_tokens: number | null
          canonical_fallback_count: number | null
          client_id: string | null
          cost_usd: number | null
          created_at: string
          generated_at: string
          id: string
          latency_ms: number | null
          method: string
          method_version: string | null
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
          cache_creation_input_tokens?: number | null
          cache_read_input_tokens?: number | null
          canonical_fallback_count?: number | null
          client_id?: string | null
          cost_usd?: number | null
          created_at?: string
          generated_at?: string
          id?: string
          latency_ms?: number | null
          method: string
          method_version?: string | null
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
          cache_creation_input_tokens?: number | null
          cache_read_input_tokens?: number | null
          canonical_fallback_count?: number | null
          client_id?: string | null
          cost_usd?: number | null
          created_at?: string
          generated_at?: string
          id?: string
          latency_ms?: number | null
          method?: string
          method_version?: string | null
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
      therapist_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          invited_by: string
          token: string
          used_at: string | null
          used_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          invited_by: string
          token?: string
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          invited_by?: string
          token?: string
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_status: {
        Row: {
          ended_at: string | null
          ended_reason: string | null
          trial_expires_at: string
          trial_readings_max: number
          trial_readings_used: number
          trial_started_at: string
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          ended_reason?: string | null
          trial_expires_at?: string
          trial_readings_max?: number
          trial_readings_used?: number
          trial_started_at?: string
          user_id: string
        }
        Update: {
          ended_at?: string | null
          ended_reason?: string | null
          trial_expires_at?: string
          trial_readings_max?: number
          trial_readings_used?: number
          trial_started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      fifo_reserve_credit: {
        Args: { p_reading_id: string; p_user_id: string }
        Returns: {
          credit_id: string
          reservation_id: string
          source: string
        }[]
      }
      increment_beta_readings_used: {
        Args: { p_therapist: string }
        Returns: undefined
      }
      is_in_trial: { Args: { p_user_id: string }; Returns: boolean }
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
          p_cache_creation_input_tokens?: number
          p_cache_read_input_tokens?: number
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
      release_reservation: {
        Args: { p_reading_id: string; p_reason?: string }
        Returns: boolean
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
