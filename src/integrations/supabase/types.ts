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
      adab_scores: {
        Row: {
          class_id: string
          created_at: string
          id: string
          score: number
          student_id: string
          subject: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          score?: number
          student_id: string
          subject: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          score?: number
          student_id?: string
          subject?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adab_scores_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_answer_keys: {
        Row: {
          answer_key: string | null
          assignment_id: string
          created_at: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          answer_key?: string | null
          assignment_id: string
          created_at?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          answer_key?: string | null
          assignment_id?: string
          created_at?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_answer_keys_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          answer_format: string
          assigned_student_id: string | null
          class_id: string | null
          coin_reward: number
          created_at: string
          description: string | null
          due_at: string | null
          exam_type: string
          game_link: string | null
          id: string
          max_score: number
          muroja_ayat: string | null
          muroja_juz: string | null
          muroja_surah: string | null
          options: Json | null
          questions: Json | null
          quiz_link: string | null
          subject: string | null
          teacher_id: string
          title: string
          updated_at: string
          xp_reward: number
        }
        Insert: {
          answer_format?: string
          assigned_student_id?: string | null
          class_id?: string | null
          coin_reward?: number
          created_at?: string
          description?: string | null
          due_at?: string | null
          exam_type?: string
          game_link?: string | null
          id?: string
          max_score?: number
          muroja_ayat?: string | null
          muroja_juz?: string | null
          muroja_surah?: string | null
          options?: Json | null
          questions?: Json | null
          quiz_link?: string | null
          subject?: string | null
          teacher_id: string
          title: string
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          answer_format?: string
          assigned_student_id?: string | null
          class_id?: string | null
          coin_reward?: number
          created_at?: string
          description?: string | null
          due_at?: string | null
          exam_type?: string
          game_link?: string | null
          id?: string
          max_score?: number
          muroja_ayat?: string | null
          muroja_juz?: string | null
          muroja_surah?: string | null
          options?: Json | null
          questions?: Json | null
          quiz_link?: string | null
          subject?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assigned_student_id_fkey"
            columns: ["assigned_student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          note: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          alpa: number
          created_at: string
          hadir: number
          izin: number
          sakit: number
          teacher_id: string
          updated_at: string
        }
        Insert: {
          alpa?: number
          created_at?: string
          hadir?: number
          izin?: number
          sakit?: number
          teacher_id: string
          updated_at?: string
        }
        Update: {
          alpa?: number
          created_at?: string
          hadir?: number
          izin?: number
          sakit?: number
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          xp_requirement: number | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          xp_requirement?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          xp_requirement?: number | null
        }
        Relationships: []
      }
      class_activities: {
        Row: {
          action: string
          actor_id: string | null
          class_id: string
          created_at: string
          id: string
          metadata: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          class_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          class_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_activities_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          subject: string | null
          subjects: string[]
          teacher_id: string
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          subject?: string | null
          subjects?: string[]
          teacher_id: string
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          subject?: string | null
          subjects?: string[]
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          class_id: string
          created_at: string
          description: string | null
          end_at: string | null
          game_link: string | null
          google_event_id: string | null
          id: string
          location: string | null
          quiz_link: string | null
          start_at: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          description?: string | null
          end_at?: string | null
          game_link?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          quiz_link?: string | null
          start_at: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          description?: string | null
          end_at?: string | null
          game_link?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          quiz_link?: string | null
          start_at?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          access_token: string | null
          created_at: string
          google_email: string | null
          id: string
          refresh_token: string | null
          token_expiry: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          google_email?: string | null
          id?: string
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          google_email?: string | null
          id?: string
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journals: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          student_id: string | null
          subject: string | null
          teacher_id: string
          topic: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          student_id?: string | null
          subject?: string | null
          teacher_id: string
          topic: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          student_id?: string | null
          subject?: string | null
          teacher_id?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journals_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_reads: {
        Row: {
          created_at: string
          id: string
          material_id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_reads_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          class_id: string | null
          content: string | null
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          link: string | null
          media_type: string | null
          media_url: string | null
          subject: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          link?: string | null
          media_type?: string | null
          media_url?: string | null
          subject?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          link?: string | null
          media_type?: string | null
          media_url?: string | null
          subject?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          reactor_id: string
          target_student_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          reactor_id: string
          target_student_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          reactor_id?: string
          target_student_id?: string
        }
        Relationships: []
      }
      profile_private: {
        Row: {
          birthdate: string | null
          created_at: string
          gender: string | null
          hobby: string | null
          id: string
          school_id_number: string | null
          updated_at: string
        }
        Insert: {
          birthdate?: string | null
          created_at?: string
          gender?: string | null
          hobby?: string | null
          id: string
          school_id_number?: string | null
          updated_at?: string
        }
        Update: {
          birthdate?: string | null
          created_at?: string
          gender?: string | null
          hobby?: string | null
          id?: string
          school_id_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          archived_at: string | null
          avatar_url: string | null
          bio: string | null
          character_key: string | null
          class_name: string | null
          coins: number
          created_at: string
          full_name: string
          id: string
          level: number
          motto: string | null
          subject: string | null
          updated_at: string
          username: string | null
          xp: number
        }
        Insert: {
          archived_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          character_key?: string | null
          class_name?: string | null
          coins?: number
          created_at?: string
          full_name: string
          id: string
          level?: number
          motto?: string | null
          subject?: string | null
          updated_at?: string
          username?: string | null
          xp?: number
        }
        Update: {
          archived_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          character_key?: string | null
          class_name?: string | null
          coins?: number
          created_at?: string
          full_name?: string
          id?: string
          level?: number
          motto?: string | null
          subject?: string | null
          updated_at?: string
          username?: string | null
          xp?: number
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          answer: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          game_link: string | null
          grade_level: string | null
          halaqoh_kind: string | null
          id: string
          image_url: string | null
          options: Json | null
          question: string
          quiz_link: string | null
          subject: string | null
          teacher_id: string
          topic: string | null
          type: Database["public"]["Enums"]["question_type"]
          updated_at: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          game_link?: string | null
          grade_level?: string | null
          halaqoh_kind?: string | null
          id?: string
          image_url?: string | null
          options?: Json | null
          question: string
          quiz_link?: string | null
          subject?: string | null
          teacher_id: string
          topic?: string | null
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          game_link?: string | null
          grade_level?: string | null
          halaqoh_kind?: string | null
          id?: string
          image_url?: string | null
          options?: Json | null
          question?: string
          quiz_link?: string | null
          subject?: string | null
          teacher_id?: string
          topic?: string | null
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Relationships: []
      }
      sheet_sync_state: {
        Row: {
          created_at: string
          id: number
          last_status: string | null
          last_synced_at: string | null
          spreadsheet_id: string | null
          spreadsheet_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          last_status?: string | null
          last_synced_at?: string | null
          spreadsheet_id?: string | null
          spreadsheet_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          last_status?: string | null
          last_synced_at?: string | null
          spreadsheet_id?: string | null
          spreadsheet_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      status_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          status_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          status_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_comments_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          status_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          status_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_reactions_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          mood: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          mood?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          mood?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          assignment_id: string
          content: string | null
          created_at: string
          feedback: string | null
          file_url: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          reward_granted: boolean
          score: number | null
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          content?: string | null
          created_at?: string
          feedback?: string | null
          file_url?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          reward_granted?: boolean
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          content?: string | null
          created_at?: string
          feedback?: string | null
          file_url?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          reward_granted?: boolean
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      tahfidz_mutabaah: {
        Row: {
          adab_aurat: boolean
          adab_etika: boolean
          adab_focus: boolean
          ayat_from: number | null
          ayat_to: number | null
          class_id: string | null
          created_at: string
          fashohah_score: number
          id: string
          juz: number | null
          kelancaran_helps: number
          kelancaran_score: number
          notes: string | null
          predikat: string | null
          session_date: string
          session_type: string
          student_id: string
          surah: string | null
          tajwid_errors: number
          tajwid_score: number
          teacher_id: string
          total_score: number
          updated_at: string
        }
        Insert: {
          adab_aurat?: boolean
          adab_etika?: boolean
          adab_focus?: boolean
          ayat_from?: number | null
          ayat_to?: number | null
          class_id?: string | null
          created_at?: string
          fashohah_score?: number
          id?: string
          juz?: number | null
          kelancaran_helps?: number
          kelancaran_score?: number
          notes?: string | null
          predikat?: string | null
          session_date?: string
          session_type?: string
          student_id: string
          surah?: string | null
          tajwid_errors?: number
          tajwid_score?: number
          teacher_id: string
          total_score?: number
          updated_at?: string
        }
        Update: {
          adab_aurat?: boolean
          adab_etika?: boolean
          adab_focus?: boolean
          ayat_from?: number | null
          ayat_to?: number | null
          class_id?: string | null
          created_at?: string
          fashohah_score?: number
          id?: string
          juz?: number | null
          kelancaran_helps?: number
          kelancaran_score?: number
          notes?: string | null
          predikat?: string | null
          session_date?: string
          session_type?: string
          student_id?: string
          surah?: string | null
          tajwid_errors?: number
          tajwid_score?: number
          teacher_id?: string
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tahfidz_mutabaah_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_subjects: {
        Row: {
          created_at: string
          id: string
          name: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          teacher_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      xp_transactions: {
        Row: {
          coin_amount: number
          created_at: string
          id: string
          note: string | null
          source: string
          source_id: string | null
          user_id: string
          xp_amount: number
        }
        Insert: {
          coin_amount?: number
          created_at?: string
          id?: string
          note?: string | null
          source: string
          source_id?: string | null
          user_id: string
          xp_amount?: number
        }
        Update: {
          coin_amount?: number
          created_at?: string
          id?: string
          note?: string | null
          source?: string
          source_id?: string | null
          user_id?: string
          xp_amount?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      grade_quiz_submission: {
        Args: { _answers: Json; _assignment_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_class_member: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_class_owner: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      join_class_by_code: {
        Args: { _code: string }
        Returns: {
          academic_year: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          subject: string | null
          subjects: string[]
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "classes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_students: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          birthdate: string
          character_key: string
          class_name: string
          coins: number
          created_at: string
          full_name: string
          gender: string
          hobby: string
          id: string
          level: number
          motto: string
          school_id_number: string
          subject: string
          updated_at: string
          username: string
          xp: number
        }[]
      }
      search_students: {
        Args: { _term: string }
        Returns: {
          class_name: string
          full_name: string
          id: string
          school_id_number: string
        }[]
      }
    }
    Enums: {
      app_role: "guru" | "siswa" | "admin"
      attendance_status: "hadir" | "izin" | "sakit" | "alpa"
      question_difficulty: "easy" | "medium" | "hard"
      question_type:
        | "multiple_choice"
        | "essay"
        | "true_false"
        | "voice"
        | "complex_multiple_choice"
        | "short_answer"
      submission_status: "draft" | "submitted" | "graded" | "returned"
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
      app_role: ["guru", "siswa", "admin"],
      attendance_status: ["hadir", "izin", "sakit", "alpa"],
      question_difficulty: ["easy", "medium", "hard"],
      question_type: [
        "multiple_choice",
        "essay",
        "true_false",
        "voice",
        "complex_multiple_choice",
        "short_answer",
      ],
      submission_status: ["draft", "submitted", "graded", "returned"],
    },
  },
} as const
