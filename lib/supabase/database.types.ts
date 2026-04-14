export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
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
      }
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
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_company_id: {
        Args: Record<string, never>
        Returns: string | null
      }
      current_user_role: {
        Args: Record<string, never>
        Returns: "admin" | "employee" | null
      }
      set_updated_at: {
        Args: Record<string, never>
        Returns: unknown
      }
      handle_new_user: {
        Args: Record<string, never>
        Returns: unknown
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