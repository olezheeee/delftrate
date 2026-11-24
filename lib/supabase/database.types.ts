// The shape of the database, for the Supabase clients.
//
// This file is replaced, not edited: after a migration is applied to the development
// project, run `npm run db:types` (see "The database" in SETUP.md) and commit the result.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      course_professors: {
        Row: {
          course_id: string;
          professor_id: string;
        };
        Insert: {
          course_id: string;
          professor_id: string;
        };
        Update: {
          course_id?: string;
          professor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_professors_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_professors_professor_id_fkey";
            columns: ["professor_id"];
            isOneToOne: false;
            referencedRelation: "professors";
            referencedColumns: ["id"];
          },
        ];
      };
      courses: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name: string;
          programme_id: string;
          year: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          programme_id: string;
          year: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          programme_id?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "courses_programme_id_fkey";
            columns: ["programme_id"];
            isOneToOne: false;
            referencedRelation: "programmes";
            referencedColumns: ["id"];
          },
        ];
      };
      manual_vote_changes: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          course_id: string;
          criterion: Database["public"]["Enums"]["criterion"];
          id: number;
          new_count: number;
          old_count: number;
          professor_id: string | null;
          value: number;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          course_id: string;
          criterion: Database["public"]["Enums"]["criterion"];
          id?: never;
          new_count: number;
          old_count: number;
          professor_id?: string | null;
          value: number;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          course_id?: string;
          criterion?: Database["public"]["Enums"]["criterion"];
          id?: never;
          new_count?: number;
          old_count?: number;
          professor_id?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "manual_vote_changes_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_vote_changes_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_vote_changes_professor_id_fkey";
            columns: ["professor_id"];
            isOneToOne: false;
            referencedRelation: "professors";
            referencedColumns: ["id"];
          },
        ];
      };
      manual_votes: {
        Row: {
          count: number;
          course_id: string;
          criterion: Database["public"]["Enums"]["criterion"];
          id: number;
          professor_id: string | null;
          value: number;
        };
        Insert: {
          count: number;
          course_id: string;
          criterion: Database["public"]["Enums"]["criterion"];
          id?: never;
          professor_id?: string | null;
          value: number;
        };
        Update: {
          count?: number;
          course_id?: string;
          criterion?: Database["public"]["Enums"]["criterion"];
          id?: never;
          professor_id?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "manual_votes_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_votes_course_id_professor_id_fkey";
            columns: ["course_id", "professor_id"];
            isOneToOne: false;
            referencedRelation: "course_professors";
            referencedColumns: ["course_id", "professor_id"];
          },
        ];
      };
      professor_ratings: {
        Row: {
          approachability: number;
          course_id: string;
          created_at: string;
          engagement: number;
          professor_id: string;
          understanding: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          approachability: number;
          course_id: string;
          created_at?: string;
          engagement: number;
          professor_id: string;
          understanding: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          approachability?: number;
          course_id?: string;
          created_at?: string;
          engagement?: number;
          professor_id?: string;
          understanding?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professor_ratings_course_id_professor_id_fkey";
            columns: ["course_id", "professor_id"];
            isOneToOne: false;
            referencedRelation: "course_professors";
            referencedColumns: ["course_id", "professor_id"];
          },
          {
            foreignKeyName: "professor_ratings_user_id_course_id_fkey";
            columns: ["user_id", "course_id"];
            isOneToOne: false;
            referencedRelation: "subject_ratings";
            referencedColumns: ["user_id", "course_id"];
          },
        ];
      };
      professors: {
        Row: {
          created_at: string;
          hidden: boolean;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          hidden?: boolean;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          hidden?: boolean;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          is_admin: boolean;
          programme_id: string;
          year: number;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_admin?: boolean;
          programme_id: string;
          year: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_admin?: boolean;
          programme_id?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_programme_id_fkey";
            columns: ["programme_id"];
            isOneToOne: false;
            referencedRelation: "programmes";
            referencedColumns: ["id"];
          },
        ];
      };
      programmes: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      subject_ratings: {
        Row: {
          course_id: string;
          created_at: string;
          difficulty: number;
          exam_level: number;
          interest: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          difficulty: number;
          exam_level: number;
          interest: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          difficulty?: number;
          exam_level?: number;
          interest?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subject_ratings_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subject_ratings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      course_professor_stats: {
        Args: { p_course_id?: string };
        Returns: {
          approachability: number;
          approachability_votes: number;
          course_id: string;
          enough_votes: boolean;
          engagement: number;
          engagement_votes: number;
          hidden: boolean;
          professor_id: string;
          understanding: number;
          understanding_votes: number;
          votes: number;
        }[];
      };
      course_subject_stats: {
        Args: { p_course_id?: string };
        Returns: {
          course_id: string;
          difficulty: number;
          difficulty_votes: number;
          enough_votes: boolean;
          exam_level: number;
          exam_level_votes: number;
          interest: number;
          interest_votes: number;
          votes: number;
        }[];
      };
      is_admin: { Args: never; Returns: boolean };
      min_votes: { Args: never; Returns: number };
      set_manual_votes: {
        Args: {
          p_count: number;
          p_course_id: string;
          p_criterion: Database["public"]["Enums"]["criterion"];
          p_professor_id?: string;
          p_value: number;
        };
        Returns: undefined;
      };
      submit_rating: {
        Args: {
          p_approachability: number;
          p_course_id: string;
          p_difficulty: number;
          p_engagement: number;
          p_exam_level: number;
          p_interest: number;
          p_professor_id: string;
          p_understanding: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      criterion:
        | "difficulty"
        | "exam_level"
        | "interest"
        | "engagement"
        | "understanding"
        | "approachability";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
