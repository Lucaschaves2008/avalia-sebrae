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
      courses: {
        Row: {
          access_link: string | null
          activation_date: string | null
          age_months: number | null
          bcg_classification: string | null
          created_at: string
          current_year_attendance: number | null
          fgv_bncc: string | null
          fgv_community: string | null
          fgv_conceptual: string | null
          fgv_context: string | null
          fgv_entrecomp: string | null
          fgv_learning_eval: string | null
          fgv_life_project: string | null
          fgv_socioemotional: string | null
          fgv_transversal: string | null
          fgv_visual: string | null
          has_class_plans: boolean | null
          has_consultant_manual: boolean | null
          has_manager_manual: boolean | null
          has_marketing_kit: boolean | null
          has_moa: boolean | null
          has_multiplicator_manual: boolean | null
          has_slides: boolean | null
          has_student_manual: boolean | null
          has_teacher_guide: boolean | null
          has_technical_sheet: boolean | null
          id: string
          ids_score: number | null
          instrument: string | null
          modality: string | null
          solution_name: string
          target_audience: string | null
        }
        Insert: {
          access_link?: string | null
          activation_date?: string | null
          age_months?: number | null
          bcg_classification?: string | null
          created_at?: string
          current_year_attendance?: number | null
          fgv_bncc?: string | null
          fgv_community?: string | null
          fgv_conceptual?: string | null
          fgv_context?: string | null
          fgv_entrecomp?: string | null
          fgv_learning_eval?: string | null
          fgv_life_project?: string | null
          fgv_socioemotional?: string | null
          fgv_transversal?: string | null
          fgv_visual?: string | null
          has_class_plans?: boolean | null
          has_consultant_manual?: boolean | null
          has_manager_manual?: boolean | null
          has_marketing_kit?: boolean | null
          has_moa?: boolean | null
          has_multiplicator_manual?: boolean | null
          has_slides?: boolean | null
          has_student_manual?: boolean | null
          has_teacher_guide?: boolean | null
          has_technical_sheet?: boolean | null
          id: string
          ids_score?: number | null
          instrument?: string | null
          modality?: string | null
          solution_name: string
          target_audience?: string | null
        }
        Update: {
          access_link?: string | null
          activation_date?: string | null
          age_months?: number | null
          bcg_classification?: string | null
          created_at?: string
          current_year_attendance?: number | null
          fgv_bncc?: string | null
          fgv_community?: string | null
          fgv_conceptual?: string | null
          fgv_context?: string | null
          fgv_entrecomp?: string | null
          fgv_learning_eval?: string | null
          fgv_life_project?: string | null
          fgv_socioemotional?: string | null
          fgv_transversal?: string | null
          fgv_visual?: string | null
          has_class_plans?: boolean | null
          has_consultant_manual?: boolean | null
          has_manager_manual?: boolean | null
          has_marketing_kit?: boolean | null
          has_moa?: boolean | null
          has_multiplicator_manual?: boolean | null
          has_slides?: boolean | null
          has_student_manual?: boolean | null
          has_teacher_guide?: boolean | null
          has_technical_sheet?: boolean | null
          id?: string
          ids_score?: number | null
          instrument?: string | null
          modality?: string | null
          solution_name?: string
          target_audience?: string | null
        }
        Relationships: []
      }
      judgments: {
        Row: {
          course_id: string
          decision: string
          id: string
          notes: string
          priority: string
          region: string
          updated_at: string
          updates_required: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          decision: string
          id?: string
          notes: string
          priority: string
          region: string
          updated_at?: string
          updates_required?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          decision?: string
          id?: string
          notes?: string
          priority?: string
          region?: string
          updated_at?: string
          updates_required?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judgments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_first_access: boolean | null
          name: string
          phone: string | null
          region: string
          unity: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_first_access?: boolean | null
          name: string
          phone?: string | null
          region: string
          unity: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_first_access?: boolean | null
          name?: string
          phone?: string | null
          region?: string
          unity?: string
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gestor"
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
      app_role: ["admin", "gestor"],
    },
  },
} as const
