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
      department_dataset_sections: {
        Row: {
          content: string | null
          created_at: string | null
          dataset_id: string | null
          embedding: string | null
          id: string
          token_count: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          dataset_id?: string | null
          embedding?: string | null
          id?: string
          token_count?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          dataset_id?: string | null
          embedding?: string | null
          id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "department_dataset_sections_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "department_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      department_datasets: {
        Row: {
          created_at: string | null
          department: string
          description: string | null
          detailed_context: string | null
          document_type: string
          embedding: string | null
          file_content: string | null
          file_url: string | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          department: string
          description?: string | null
          detailed_context?: string | null
          document_type: string
          embedding?: string | null
          file_content?: string | null
          file_url?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string
          description?: string | null
          detailed_context?: string | null
          document_type?: string
          embedding?: string | null
          file_content?: string | null
          file_url?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      department_settings: {
        Row: {
          created_at: string | null
          department: string
          id: string
          organization_name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          department: string
          id?: string
          organization_name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string
          id?: string
          organization_name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      department_templates: {
        Row: {
          content: string | null
          department: string
          document_type: string
          file_name: string | null
          file_url: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content?: string | null
          department: string
          document_type: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: string | null
          department?: string
          document_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          archived_by_governor: string | null
          content: string | null
          created_at: string | null
          department: string | null
          id: string
          original_author_role_id: string | null
          reference_source_id: string | null
          school_year: string | null
          status: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string | null
          versions: Json | null
          visibility: string | null
        }
        Insert: {
          archived_by_governor?: string | null
          content?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          original_author_role_id?: string | null
          reference_source_id?: string | null
          school_year?: string | null
          status?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id?: string | null
          versions?: Json | null
          visibility?: string | null
        }
        Update: {
          archived_by_governor?: string | null
          content?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          original_author_role_id?: string | null
          reference_source_id?: string | null
          school_year?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
          versions?: Json | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_original_author_role_id_fkey"
            columns: ["original_author_role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_reference_source_id_fkey"
            columns: ["reference_source_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list: {
        Row: {
          category: string | null
          created_at: string
          id: string
          item_name: string
          price: number | null
          unit: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          item_name: string
          price?: number | null
          unit?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          item_name?: string
          price?: number | null
          unit?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          academic_year: string | null
          created_at: string | null
          department: string | null
          id: string
          managed_by_role_id: string | null
          permissions: Json | null
          role: string
          specific_role: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          academic_year?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          managed_by_role_id?: string | null
          permissions?: Json | null
          role: string
          specific_role?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          academic_year?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          managed_by_role_id?: string | null
          permissions?: Json | null
          role?: string
          specific_role?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_managed_by_role_id_fkey"
            columns: ["managed_by_role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
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
      archive_department_documents: {
        Args: { archive_year: string; target_department: string }
        Returns: number
      }
      archive_specific_term_documents:
        | {
            Args: { archive_year: string; target_role_id: string }
            Returns: number
          }
        | {
            Args: {
              archive_year: string
              governor_name: string
              target_role_id: string
            }
            Returns: number
          }
      match_dataset_sections: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
        }[]
      }
      match_datasets: {
        Args: {
          filter_department: string
          filter_type: string
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          detailed_context: string
          id: string
          similarity: number
        }[]
      }
      unarchive_specific_term_documents: {
        Args: { target_role_id: string }
        Returns: number
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
