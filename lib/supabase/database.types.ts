// The shape of the database, for the Supabase clients.
//
// This file is replaced, not edited: after a migration is applied to the development
// project, run `npm run db:types` (see "The database" in SETUP.md) and commit the result.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      course_professors: {
        Row: {
          course_id: string
          professor_id: string
        }
        Insert: {
          course_id: string
          professor_id: string
        }
        Update: {
          course_id?: string
          professor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_professors_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_professors_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          programme_id: string
          quarters: number[]
          year: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          programme_id: string
          quarters?: number[]
          year: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          programme_id?: string
          quarters?: number[]
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "courses_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_vote_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          course_id: string
          criterion: Database["public"]["Enums"]["criterion"]
          id: number
          new_count: number
          old_count: number
          professor_id: string | null
          value: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          course_id: string
          criterion: Database["public"]["Enums"]["criterion"]
          id?: never
          new_count: number
          old_count: number
          professor_id?: string | null
          value: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          course_id?: string
          criterion?: Database["public"]["Enums"]["criterion"]
          id?: never
          new_count?: number
          old_count?: number
          professor_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "manual_vote_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_votes: {
        Row: {
          count: number
          course_id: string
          criterion: Database["public"]["Enums"]["criterion"]
          id: number
          professor_id: string | null
          value: number
        }
        Insert: {
          count: number
          course_id: string
          criterion: Database["public"]["Enums"]["criterion"]
          id?: never
          professor_id?: string | null
          value: number
        }
        Update: {
          count?: number
          course_id?: string
          criterion?: Database["public"]["Enums"]["criterion"]
          id?: never
          professor_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "manual_votes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_votes_course_id_professor_id_fkey"
            columns: ["course_id", "professor_id"]
            isOneToOne: false
            referencedRelation: "course_professors"
            referencedColumns: ["course_id", "professor_id"]
          },
        ]
      }
      professor_ratings: {
        Row: {
          approachability: number
          course_id: string
          created_at: string
          engagement: number
          professor_id: string
          understanding: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approachability: number
          course_id: string
          created_at?: string
          engagement: number
          professor_id: string
          understanding: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approachability?: number
          course_id?: string
          created_at?: string
          engagement?: number
          professor_id?: string
          understanding?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_ratings_course_id_professor_id_fkey"
            columns: ["course_id", "professor_id"]
            isOneToOne: false
            referencedRelation: "course_professors"
            referencedColumns: ["course_id", "professor_id"]
          },
          {
            foreignKeyName: "professor_ratings_user_id_course_id_fkey"
            columns: ["user_id", "course_id"]
            isOneToOne: false
            referencedRelation: "subject_ratings"
            referencedColumns: ["user_id", "course_id"]
          },
        ]
      }
      professors: {
        Row: {
          created_at: string
          hidden: boolean
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          hidden?: boolean
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          hidden?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          programme_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id: string
          is_admin?: boolean
          programme_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          programme_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      subject_ratings: {
        Row: {
          course_id: string
          created_at: string
          difficulty: number
          exam_level: number
          interest: number
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          difficulty: number
          exam_level: number
          interest: number
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          difficulty?: number
          exam_level?: number
          interest?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_ratings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_ratings_user_id_fkey"
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
      calendar_scores: {
        Args: never
        Returns: {
          code: string
          load: number | null
          score: number | null
          teach: number | null
        }[]
      }
      cancel_unfinished_registration: { Args: never; Returns: boolean }
      course_professor_stats: {
        Args: { p_course_id?: string }
        Returns: {
          approachability: number | null
          approachability_votes: number
          course_id: string
          engagement: number | null
          engagement_votes: number
          enough_votes: boolean
          hidden: boolean
          professor_id: string
          understanding: number | null
          understanding_votes: number
          votes: number
        }[]
      }
      course_ranks: {
        Args: { p_course_id: string }
        Returns: {
          lighter_load: number | null
          professor_id: string | null
          score_of: number | null
          score_rank: number | null
          teach_of: number | null
          teach_rank: number | null
        }[]
      }
      course_subject_stats: {
        Args: { p_course_id?: string }
        Returns: {
          course_id: string
          difficulty: number | null
          difficulty_votes: number
          enough_votes: boolean
          exam_level: number | null
          exam_level_votes: number
          interest: number | null
          interest_votes: number
          votes: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      min_votes: { Args: never; Returns: number }
      set_manual_votes: {
        Args: {
          p_count: number
          p_course_id: string
          p_criterion: Database["public"]["Enums"]["criterion"]
          p_professor_id?: string
          p_value: number
        }
        Returns: undefined
      }
      site_totals: {
        Args: never
        Returns: {
          courses: number
          students: number
          votes: number
        }[]
      }
      submit_rating: {
        Args: {
          p_approachability: number
          p_course_id: string
          p_difficulty: number
          p_engagement: number
          p_exam_level: number
          p_interest: number
          p_professor_id: string
          p_understanding: number
        }
        Returns: undefined
      }
    }
    Enums: {
      criterion:
        | "difficulty"
        | "exam_level"
        | "interest"
        | "engagement"
        | "understanding"
        | "approachability"
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
      criterion: [
        "difficulty",
        "exam_level",
        "interest",
        "engagement",
        "understanding",
        "approachability",
      ],
    },
  },
} as const
