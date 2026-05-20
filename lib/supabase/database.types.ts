export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          company_id: string | null
          full_name: string
          role: "admin" | "employee"
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          company_id?: string | null
          full_name: string
          role?: "admin" | "employee"
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          full_name?: string
          role?: "admin" | "employee"
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }

      jobs: {
        Row: {
          id: string
          company_id: string
          assigned_to: string | null
          created_by: string | null
          customer_name: string
          service_name: string
          location_address: string
          scheduled_start: string | null
          scheduled_end: string | null
          status: "open" | "in_progress" | "completed"
          started_at: string | null
          completed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          assigned_to?: string | null
          created_by?: string | null
          customer_name: string
          service_name: string
          location_address: string
          scheduled_start?: string | null
          scheduled_end?: string | null
          status?: "open" | "in_progress" | "completed"
          started_at?: string | null
          completed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          assigned_to?: string | null
          created_by?: string | null
          customer_name?: string
          service_name?: string
          location_address?: string
          scheduled_start?: string | null
          scheduled_end?: string | null
          status?: "open" | "in_progress" | "completed"
          started_at?: string | null
          completed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
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
          }
        ]
      }

      companies: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: "admin" | "employee" | null
      }
    }
    Enums: {
      app_role: "admin" | "employee"
      job_status: "open" | "in_progress" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}