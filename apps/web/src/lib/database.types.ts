export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          emoji: string
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          emoji?: string
          color?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          emoji?: string
          color?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          project_id: string
          title: string
          content: Json | null
          parent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          content?: Json | null
          parent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: Json | null
          parent_id?: string | null
          updated_at?: string
        }
      }
      block_history: {
        Row: {
          id: string
          block_id: string
          doc_id: string
          before_content: string | null
          after_content: string
          source: 'manual' | 'meeting' | 'ai'
          author_name: string | null
          author_color: string | null
          meeting_id: string | null
          meeting_title: string | null
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          block_id: string
          doc_id: string
          before_content?: string | null
          after_content: string
          source?: 'manual' | 'meeting' | 'ai'
          author_name?: string | null
          author_color?: string | null
          meeting_id?: string | null
          meeting_title?: string | null
          reason?: string | null
          created_at?: string
        }
        Update: {
          reason?: string | null
        }
      }
    }
  }
}
