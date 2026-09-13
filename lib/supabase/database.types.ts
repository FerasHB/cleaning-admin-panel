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
      _qa_phase4_ids: {
        Row: {
          k: string
          v: string | null
        }
        Insert: {
          k: string
          v?: string | null
        }
        Update: {
          k?: string
          v?: string | null
        }
        Relationships: []
      }
      _qa_phase5_ids: {
        Row: {
          k: string
          v: string | null
        }
        Insert: {
          k: string
          v?: string | null
        }
        Update: {
          k?: string
          v?: string | null
        }
        Relationships: []
      }
      absence_evidence: {
        Row: {
          absence_id: string
          company_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          document_path: string | null
          id: string
          note: string | null
          status: Database["public"]["Enums"]["au_evidence_status"]
          submitted_at: string
          updated_at: string
        }
        Insert: {
          absence_id: string
          company_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          document_path?: string | null
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["au_evidence_status"]
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          absence_id?: string
          company_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          document_path?: string | null
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["au_evidence_status"]
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_evidence_absence_id_fkey"
            columns: ["absence_id"]
            isOneToOne: true
            referencedRelation: "employee_absences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_evidence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_evidence_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_vacation_annual_entitlement_days: number | null
          default_vacation_management_enabled: boolean
          default_vacation_reference_days_per_week: number | null
          id: string
          locale: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_vacation_annual_entitlement_days?: number | null
          default_vacation_management_enabled?: boolean
          default_vacation_reference_days_per_week?: number | null
          id?: string
          locale?: string
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_vacation_annual_entitlement_days?: number | null
          default_vacation_management_enabled?: boolean
          default_vacation_reference_days_per_week?: number | null
          id?: string
          locale?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_absences: {
        Row: {
          admin_note: string | null
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_note: string | null
          end_date: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
          vacation_deducted_days_snapshot: number | null
        }
        Insert: {
          admin_note?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          employee_name_snapshot: string
          employee_note?: string | null
          end_date?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          type: Database["public"]["Enums"]["absence_type"]
          updated_at?: string
          vacation_deducted_days_snapshot?: number | null
        }
        Update: {
          admin_note?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          employee_name_snapshot?: string
          employee_note?: string | null
          end_date?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["absence_status"]
          type?: Database["public"]["Enums"]["absence_type"]
          updated_at?: string
          vacation_deducted_days_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_absences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_absences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_absences_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_time_adjustments: {
        Row: {
          assignment_id: string
          changed_by: string | null
          created_at: string
          employee_id: string | null
          id: string
          job_id: string
          new_completed_at: string | null
          new_started_at: string | null
          old_completed_at: string | null
          old_started_at: string | null
          reason: string
        }
        Insert: {
          assignment_id: string
          changed_by?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          job_id: string
          new_completed_at?: string | null
          new_started_at?: string | null
          old_completed_at?: string | null
          old_started_at?: string | null
          reason: string
        }
        Update: {
          assignment_id?: string
          changed_by?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          job_id?: string
          new_completed_at?: string | null
          new_started_at?: string | null
          old_completed_at?: string | null
          old_started_at?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_time_adjustments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "job_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_adjustments_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_adjustments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          attendance: Database["public"]["Enums"]["attendance_state"]
          counts_for_timesheet: boolean | null
          employee_completed_at: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_started_at: string | null
          id: string
          job_id: string
          review: Database["public"]["Enums"]["attendance_review"] | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          attendance?: Database["public"]["Enums"]["attendance_state"]
          counts_for_timesheet?: boolean | null
          employee_completed_at?: string | null
          employee_id?: string | null
          employee_name_snapshot: string
          employee_started_at?: string | null
          id?: string
          job_id: string
          review?: Database["public"]["Enums"]["attendance_review"] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          attendance?: Database["public"]["Enums"]["attendance_state"]
          counts_for_timesheet?: boolean | null
          employee_completed_at?: string | null
          employee_id?: string | null
          employee_name_snapshot?: string
          employee_started_at?: string | null
          id?: string
          job_id?: string
          review?: Database["public"]["Enums"]["attendance_review"] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_comment_reads: {
        Row: {
          job_id: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          job_id: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          job_id?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_comment_reads_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_comment_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_comments: {
        Row: {
          author_id: string | null
          company_id: string
          created_at: string
          id: string
          job_id: string
          message: string
        }
        Insert: {
          author_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          job_id: string
          message: string
        }
        Update: {
          author_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          job_id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_comments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_occurrence_assignment_overrides: {
        Row: {
          customized_at: string
          customized_by: string | null
          job_id: string
        }
        Insert: {
          customized_at?: string
          customized_by?: string | null
          job_id: string
        }
        Update: {
          customized_at?: string
          customized_by?: string | null
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_occurrence_assignment_overrides_customized_by_fkey"
            columns: ["customized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_occurrence_assignment_overrides_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          company_id: string
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          job_id: string
          mime_type: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          job_id: string
          mime_type?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          job_id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          date: string | null
          id: string
          is_active: boolean
          job_type: Database["public"]["Enums"]["job_type"]
          location_address: string
          notes: string | null
          parent_job_id: string | null
          planned_duration_minutes: number | null
          recurrence_end_date: string | null
          recurrence_start_date: string | null
          recurring_days: string[] | null
          scheduled_end: string | null
          scheduled_start: string | null
          service_name: string
          start_time: string | null
          started_at: string | null
          started_by: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          date?: string | null
          id?: string
          is_active?: boolean
          job_type?: Database["public"]["Enums"]["job_type"]
          location_address: string
          notes?: string | null
          parent_job_id?: string | null
          planned_duration_minutes?: number | null
          recurrence_end_date?: string | null
          recurrence_start_date?: string | null
          recurring_days?: string[] | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_name: string
          start_time?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          date?: string | null
          id?: string
          is_active?: boolean
          job_type?: Database["public"]["Enums"]["job_type"]
          location_address?: string
          notes?: string | null
          parent_job_id?: string | null
          planned_duration_minutes?: number | null
          recurrence_end_date?: string | null
          recurrence_start_date?: string | null
          recurring_days?: string[] | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_name?: string
          start_time?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          claimed_at: string | null
          company_id: string
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          outbox_id: string
          recipient_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          company_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          outbox_id: string
          recipient_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          outbox_id?: string
          recipient_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "notification_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          absence_end_date: string | null
          absence_start_date: string | null
          assignment_id: string | null
          company_id: string
          created_at: string
          customer_name: string | null
          employee_id: string | null
          employee_name: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          fanned_out_at: string | null
          id: string
          job_id: string | null
          job_status: string | null
          service_name: string | null
        }
        Insert: {
          absence_end_date?: string | null
          absence_start_date?: string | null
          assignment_id?: string | null
          company_id: string
          created_at?: string
          customer_name?: string | null
          employee_id?: string | null
          employee_name?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          fanned_out_at?: string | null
          id?: string
          job_id?: string | null
          job_status?: string | null
          service_name?: string | null
        }
        Update: {
          absence_end_date?: string | null
          absence_start_date?: string | null
          assignment_id?: string | null
          company_id?: string
          created_at?: string
          customer_name?: string | null
          employee_id?: string | null
          employee_name?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          fanned_out_at?: string | null
          id?: string
          job_id?: string | null
          job_status?: string | null
          service_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "job_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_deletion_reserved_at: string | null
          account_deletion_token: string | null
          company_id: string | null
          created_at: string
          employment_end_date: string | null
          employment_start_date: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          expo_push_token: string | null
          full_name: string
          id: string
          invite_accepted_at: string | null
          invited_at: string | null
          is_active: boolean
          phone: string | null
          phone_verified_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          vacation_annual_entitlement_days: number | null
          vacation_management_enabled: boolean
          vacation_reference_days_per_week: number | null
        }
        Insert: {
          account_deletion_reserved_at?: string | null
          account_deletion_token?: string | null
          company_id?: string | null
          created_at?: string
          employment_end_date?: string | null
          employment_start_date?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          expo_push_token?: string | null
          full_name: string
          id: string
          invite_accepted_at?: string | null
          invited_at?: string | null
          is_active?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          vacation_annual_entitlement_days?: number | null
          vacation_management_enabled?: boolean
          vacation_reference_days_per_week?: number | null
        }
        Update: {
          account_deletion_reserved_at?: string | null
          account_deletion_token?: string | null
          company_id?: string | null
          created_at?: string
          employment_end_date?: string | null
          employment_start_date?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          expo_push_token?: string | null
          full_name?: string
          id?: string
          invite_accepted_at?: string | null
          invited_at?: string | null
          is_active?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          vacation_annual_entitlement_days?: number | null
          vacation_management_enabled?: boolean
          vacation_reference_days_per_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_ledger: {
        Row: {
          absence_id: string | null
          amount_days: number
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          entry_type: Database["public"]["Enums"]["vacation_ledger_entry_type"]
          evidence_id: string | null
          id: string
          note: string | null
          vacation_year_id: string
        }
        Insert: {
          absence_id?: string | null
          amount_days: number
          company_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          entry_type: Database["public"]["Enums"]["vacation_ledger_entry_type"]
          evidence_id?: string | null
          id?: string
          note?: string | null
          vacation_year_id: string
        }
        Update: {
          absence_id?: string | null
          amount_days?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          entry_type?: Database["public"]["Enums"]["vacation_ledger_entry_type"]
          evidence_id?: string | null
          id?: string
          note?: string | null
          vacation_year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_ledger_absence_id_fkey"
            columns: ["absence_id"]
            isOneToOne: false
            referencedRelation: "employee_absences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_ledger_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "absence_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_ledger_vacation_year_id_fkey"
            columns: ["vacation_year_id"]
            isOneToOne: false
            referencedRelation: "vacation_years"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_years: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string
          id: string
          updated_at: string
          year: number
        }
        Insert: {
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          updated_at?: string
          year: number
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vacation_years_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_years_employee_id_fkey"
            columns: ["employee_id"]
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
      accept_own_invite: { Args: never; Returns: boolean }
      admin_add_vacation_adjustment: {
        Args: {
          p_amount_days: number
          p_employee_id: string
          p_note: string
          p_year: number
        }
        Returns: string
      }
      admin_correct_assignment_time: {
        Args: {
          assignment_id_input: string
          new_completed_at: string
          new_started_at: string
          reason_input: string
        }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          attendance: Database["public"]["Enums"]["attendance_state"]
          counts_for_timesheet: boolean | null
          employee_completed_at: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_started_at: string | null
          id: string
          job_id: string
          review: Database["public"]["Enums"]["attendance_review"] | null
          reviewed_at: string | null
          reviewed_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "job_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_create_absence: {
        Args: {
          employee_id_input: string
          end_date_input?: string
          note_input?: string
          start_date_input: string
          type_input: Database["public"]["Enums"]["absence_type"]
        }
        Returns: {
          admin_note: string | null
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_note: string | null
          end_date: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
          vacation_deducted_days_snapshot: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "employee_absences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_initialize_vacation_year: {
        Args: { p_employee_id: string; p_year: number }
        Returns: string
      }
      admin_restore_vacation_from_au: {
        Args: { p_evidence_id: string; p_restorations: Json }
        Returns: number
      }
      admin_review_au: {
        Args: { p_absence_id: string; p_decision: string; p_note?: string }
        Returns: string
      }
      admin_review_vacation: {
        Args: {
          absence_id_input: string
          admin_note_input?: string
          decision_input: string
          p_deductions?: Json
        }
        Returns: {
          admin_note: string | null
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_note: string | null
          end_date: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
          vacation_deducted_days_snapshot: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "employee_absences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cancel_own_sickness: {
        Args: { absence_id_input: string }
        Returns: {
          admin_note: string | null
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_note: string | null
          end_date: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
          vacation_deducted_days_snapshot: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "employee_absences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cancel_own_vacation: {
        Args: { absence_id_input: string }
        Returns: {
          admin_note: string | null
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_note: string | null
          end_date: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
          vacation_deducted_days_snapshot: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "employee_absences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_notification_deliveries: {
        Args: {
          company_id_filter?: string
          max_rows?: number
          processing_timeout_seconds?: number
        }
        Returns: {
          absence_end_date: string
          absence_start_date: string
          attempts: number
          company_id: string
          customer_name: string
          delivery_id: string
          employee_id: string
          employee_name: string
          entity_id: string
          entity_type: string
          event_type: string
          expo_push_token: string
          job_id: string
          job_status: string
          outbox_id: string
          recipient_active: boolean
          recipient_id: string
          recipient_role: string
          service_name: string
        }[]
      }
      clear_my_push_token: { Args: never; Returns: undefined }
      compat_assignment_sync_active: { Args: never; Returns: boolean }
      compat_primary_assignee: { Args: { p_job_id: string }; Returns: string }
      complete_notification_delivery: {
        Args: {
          delivery_id_input: string
          error_input?: string
          max_attempts?: number
          outcome: string
        }
        Returns: string
      }
      complete_own_job: {
        Args: { completed_at_input?: string; job_id_input: string }
        Returns: string
      }
      current_user_company_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      enqueue_absence_notification: {
        Args: {
          p_absence_id: string
          p_company_id: string
          p_employee_id: string
          p_employee_name: string
          p_end_date: string
          p_event_type: string
          p_recipient_id?: string
          p_start_date: string
        }
        Returns: string
      }
      fanout_notification_events: {
        Args: { company_id_filter?: string; max_events?: number }
        Returns: number
      }
      generate_job_occurrences: {
        Args: { parent_job_id_input: string }
        Returns: number
      }
      get_au_restoration_candidates: {
        Args: { p_absence_id: string }
        Returns: {
          already_restored: number
          deducted_days: number
          full_coverage: boolean
          overlap_end: string
          overlap_start: string
          restorable_days: number
          vacation_absence_id: string
          vacation_end: string
          vacation_start: string
          year: number
        }[]
      }
      get_company_employee_emails: {
        Args: never
        Returns: {
          email: string
          id: string
        }[]
      }
      get_job_comments: {
        Args: { p_job_id: string }
        Returns: {
          author_id: string
          author_name: string
          created_at: string
          id: string
          job_id: string
          message: string
        }[]
      }
      get_unread_comment_job_ids: { Args: never; Returns: string[] }
      inherit_occurrence_assignments: {
        Args: { p_only_job_id?: string; p_parent_job_id: string }
        Returns: number
      }
      is_assigned_to_job: { Args: { p_job_id: string }; Returns: boolean }
      job_in_current_company: { Args: { p_job_id: string }; Returns: boolean }
      prepare_self_account_deletion: { Args: never; Returns: string }
      recover_stale_account_deletion_reservations: {
        Args: never
        Returns: number
      }
      register_admin_with_company: {
        Args: {
          p_company_name: string
          p_company_slug: string
          p_full_name: string
        }
        Returns: Json
      }
      report_own_sickness: {
        Args: {
          employee_note_input?: string
          end_date_input?: string
          start_date_input: string
        }
        Returns: {
          admin_note: string | null
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_note: string | null
          end_date: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
          vacation_deducted_days_snapshot: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "employee_absences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      request_own_vacation: {
        Args: {
          employee_note_input?: string
          end_date_input: string
          start_date_input: string
        }
        Returns: {
          admin_note: string | null
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_note: string | null
          end_date: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
          vacation_deducted_days_snapshot: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "employee_absences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reset_job_occurrence_assignments: {
        Args: { p_job_id: string }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          attendance: Database["public"]["Enums"]["attendance_state"]
          counts_for_timesheet: boolean | null
          employee_completed_at: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_started_at: string | null
          id: string
          job_id: string
          review: Database["public"]["Enums"]["attendance_review"] | null
          reviewed_at: string | null
          reviewed_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "job_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rollback_self_account_deletion: {
        Args: { p_token: string }
        Returns: undefined
      }
      set_job_assignments: {
        Args: { p_employee_ids?: string[]; p_job_id: string }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          attendance: Database["public"]["Enums"]["attendance_state"]
          counts_for_timesheet: boolean | null
          employee_completed_at: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_started_at: string | null
          id: string
          job_id: string
          review: Database["public"]["Enums"]["attendance_review"] | null
          reviewed_at: string | null
          reviewed_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "job_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      setup_company_for_admin: {
        Args: {
          company_name: string
          p_admin_phone?: string
          p_contact_email?: string
          p_contact_phone?: string
        }
        Returns: string
      }
      start_own_job: {
        Args: { job_id_input: string; started_at_input?: string }
        Returns: string
      }
      update_job_occurrences: {
        Args: { parent_job_id_input: string }
        Returns: number
      }
      update_my_push_token: { Args: { new_token: string }; Returns: undefined }
      update_own_company: {
        Args: {
          p_contact_email: string
          p_contact_phone: string
          p_name: string
        }
        Returns: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_vacation_annual_entitlement_days: number | null
          default_vacation_management_enabled: boolean
          default_vacation_reference_days_per_week: number | null
          id: string
          locale: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_own_sickness_end: {
        Args: { absence_id_input: string; new_end_date_input: string }
        Returns: {
          admin_note: string | null
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string | null
          employee_name_snapshot: string
          employee_note: string | null
          end_date: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
          vacation_deducted_days_snapshot: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "employee_absences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      absence_status:
        | "requested"
        | "approved"
        | "rejected"
        | "cancelled"
        | "reported"
      absence_type: "vacation" | "sickness"
      app_role: "admin" | "employee"
      attendance_review: "present" | "absent"
      attendance_state: "assigned" | "started" | "completed"
      au_evidence_status: "pending" | "confirmed" | "rejected"
      employment_type:
        | "vollzeit"
        | "teilzeit"
        | "minijob"
        | "aushilfe"
        | "sonstiges"
      job_status: "open" | "in_progress" | "completed"
      job_type: "single" | "recurring"
      vacation_ledger_entry_type:
        | "annual_entitlement"
        | "approved_vacation"
        | "vacation_cancellation"
        | "manual_adjustment"
        | "carry_over"
        | "au_restoration"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      absence_status: [
        "requested",
        "approved",
        "rejected",
        "cancelled",
        "reported",
      ],
      absence_type: ["vacation", "sickness"],
      app_role: ["admin", "employee"],
      attendance_review: ["present", "absent"],
      attendance_state: ["assigned", "started", "completed"],
      au_evidence_status: ["pending", "confirmed", "rejected"],
      employment_type: [
        "vollzeit",
        "teilzeit",
        "minijob",
        "aushilfe",
        "sonstiges",
      ],
      job_status: ["open", "in_progress", "completed"],
      job_type: ["single", "recurring"],
      vacation_ledger_entry_type: [
        "annual_entitlement",
        "approved_vacation",
        "vacation_cancellation",
        "manual_adjustment",
        "carry_over",
        "au_restoration",
      ],
    },
  },
} as const
