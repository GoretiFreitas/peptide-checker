export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_activity: {
        Row: {
          created_at: string | null;
          id: string;
          kind: string;
          message: string;
          meta: Json | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          kind: string;
          message: string;
          meta?: Json | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          kind?: string;
          message?: string;
          meta?: Json | null;
        };
        Relationships: [];
      };
      board_items: {
        Row: {
          batch_id: string | null;
          coa_url: string | null;
          created_at: string;
          description: string | null;
          funding_deadline: string | null;
          goal_cents: number | null;
          id: string;
          lab: string;
          nominated_by: string | null;
          operations_margin_cents: number;
          product_name: string;
          sample_cost_cents: number;
          seller: string;
          sequence: string | null;
          source_url: string | null;
          state: Database["public"]["Enums"]["board_state"];
          test_battery: Json;
          test_cost_cents: number;
          thumbnail_url: string | null;
          updated_at: string;
          us_only: boolean;
        };
        Insert: {
          batch_id?: string | null;
          coa_url?: string | null;
          created_at?: string;
          description?: string | null;
          funding_deadline?: string | null;
          goal_cents?: number | null;
          id?: string;
          lab?: string;
          nominated_by?: string | null;
          operations_margin_cents?: number;
          product_name: string;
          sample_cost_cents?: number;
          seller?: string;
          sequence?: string | null;
          source_url?: string | null;
          state?: Database["public"]["Enums"]["board_state"];
          test_battery?: Json;
          test_cost_cents?: number;
          thumbnail_url?: string | null;
          updated_at?: string;
          us_only?: boolean;
        };
        Update: {
          batch_id?: string | null;
          coa_url?: string | null;
          created_at?: string;
          description?: string | null;
          funding_deadline?: string | null;
          goal_cents?: number | null;
          id?: string;
          lab?: string;
          nominated_by?: string | null;
          operations_margin_cents?: number;
          product_name?: string;
          sample_cost_cents?: number;
          seller?: string;
          sequence?: string | null;
          source_url?: string | null;
          state?: Database["public"]["Enums"]["board_state"];
          test_battery?: Json;
          test_cost_cents?: number;
          thumbnail_url?: string | null;
          updated_at?: string;
          us_only?: boolean;
        };
        Relationships: [];
      };
      board_stretch_goals: {
        Row: {
          add_cost_cents: number;
          created_at: string;
          id: string;
          item_id: string;
          label: string;
          unlocked: boolean;
        };
        Insert: {
          add_cost_cents: number;
          created_at?: string;
          id?: string;
          item_id: string;
          label: string;
          unlocked?: boolean;
        };
        Update: {
          add_cost_cents?: number;
          created_at?: string;
          id?: string;
          item_id?: string;
          label?: string;
          unlocked?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "board_stretch_goals_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "board_items";
            referencedColumns: ["id"];
          },
        ];
      };
      certificate_register: {
        Row: {
          batch_id: string | null;
          first_seen_at: string;
          id: string;
          issue_date: string | null;
          issuing_lab: string | null;
          last_seen_at: string;
          normalized_sha256: string | null;
          product_name: string | null;
          purity_percent: number | null;
          seen_count: number;
          sequence: string | null;
          sha256: string;
        };
        Insert: {
          batch_id?: string | null;
          first_seen_at?: string;
          id?: string;
          issue_date?: string | null;
          issuing_lab?: string | null;
          last_seen_at?: string;
          normalized_sha256?: string | null;
          product_name?: string | null;
          purity_percent?: number | null;
          seen_count?: number;
          sequence?: string | null;
          sha256: string;
        };
        Update: {
          batch_id?: string | null;
          first_seen_at?: string;
          id?: string;
          issue_date?: string | null;
          issuing_lab?: string | null;
          last_seen_at?: string;
          normalized_sha256?: string | null;
          product_name?: string | null;
          purity_percent?: number | null;
          seen_count?: number;
          sequence?: string | null;
          sha256?: string;
        };
        Relationships: [];
      };
      community_fund: {
        Row: {
          id: boolean;
          total_cents: number;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          total_cents?: number;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          total_cents?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      pledges: {
        Row: {
          amount_cents: number;
          backer_email: string | null;
          created_at: string;
          display_mode: string;
          environment: string;
          hide_amount: boolean;
          id: string;
          item_id: string;
          payment_method_type: string | null;
          refunded_cents: number;
          rolled_over_at: string | null;
          rolled_over_from_item_id: string | null;
          status: Database["public"]["Enums"]["pledge_status"];
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          updated_at: string;
          user_id: string;
          x_handle: string | null;
        };
        Insert: {
          amount_cents: number;
          backer_email?: string | null;
          created_at?: string;
          display_mode?: string;
          environment?: string;
          hide_amount?: boolean;
          id?: string;
          item_id: string;
          payment_method_type?: string | null;
          refunded_cents?: number;
          rolled_over_at?: string | null;
          rolled_over_from_item_id?: string | null;
          status?: Database["public"]["Enums"]["pledge_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
          user_id: string;
          x_handle?: string | null;
        };
        Update: {
          amount_cents?: number;
          backer_email?: string | null;
          created_at?: string;
          display_mode?: string;
          environment?: string;
          hide_amount?: boolean;
          id?: string;
          item_id?: string;
          payment_method_type?: string | null;
          refunded_cents?: number;
          rolled_over_at?: string | null;
          rolled_over_from_item_id?: string | null;
          status?: Database["public"]["Enums"]["pledge_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
          user_id?: string;
          x_handle?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pledges_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "board_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pledges_rolled_over_from_item_id_fkey";
            columns: ["rolled_over_from_item_id"];
            isOneToOne: false;
            referencedRelation: "board_items";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          handle: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          handle?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          handle?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          amount_cents: number;
          created_at: string | null;
          credited_to_fund: boolean;
          currency: string;
          environment: string;
          fund_credit_cents: number;
          id: string;
          kind: string;
          metadata: Json | null;
          net_cents: number | null;
          payment_method_type: string | null;
          price_id: string | null;
          product_id: string;
          refunded_cents: number;
          status: string;
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_payment_intent_id: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          amount_cents: number;
          created_at?: string | null;
          credited_to_fund?: boolean;
          currency?: string;
          environment?: string;
          fund_credit_cents?: number;
          id?: string;
          kind: string;
          metadata?: Json | null;
          net_cents?: number | null;
          payment_method_type?: string | null;
          price_id?: string | null;
          product_id: string;
          refunded_cents?: number;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          amount_cents?: number;
          created_at?: string | null;
          credited_to_fund?: boolean;
          currency?: string;
          environment?: string;
          fund_credit_cents?: number;
          id?: string;
          kind?: string;
          metadata?: Json | null;
          net_cents?: number | null;
          payment_method_type?: string | null;
          price_id?: string | null;
          product_id?: string;
          refunded_cents?: number;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      results: {
        Row: {
          batch_id: string | null;
          created_at: string;
          findings: Json;
          id: string;
          item_id: string;
          lab_name: string | null;
          published_at: string | null;
          raw_findings: Json;
          sampled_at: string | null;
          signed_off_at: string | null;
          signed_off_by: string | null;
          summary: string | null;
          tested_at: string | null;
          updated_at: string;
          verdict: Database["public"]["Enums"]["result_verdict"];
        };
        Insert: {
          batch_id?: string | null;
          created_at?: string;
          findings?: Json;
          id?: string;
          item_id: string;
          lab_name?: string | null;
          published_at?: string | null;
          raw_findings?: Json;
          sampled_at?: string | null;
          signed_off_at?: string | null;
          signed_off_by?: string | null;
          summary?: string | null;
          tested_at?: string | null;
          updated_at?: string;
          verdict?: Database["public"]["Enums"]["result_verdict"];
        };
        Update: {
          batch_id?: string | null;
          created_at?: string;
          findings?: Json;
          id?: string;
          item_id?: string;
          lab_name?: string | null;
          published_at?: string | null;
          raw_findings?: Json;
          sampled_at?: string | null;
          signed_off_at?: string | null;
          signed_off_by?: string | null;
          summary?: string | null;
          tested_at?: string | null;
          updated_at?: string;
          verdict?: Database["public"]["Enums"]["result_verdict"];
        };
        Relationships: [
          {
            foreignKeyName: "results_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: true;
            referencedRelation: "board_items";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null;
          created_at: string | null;
          current_period_end: string | null;
          current_period_start: string | null;
          environment: string;
          id: string;
          price_id: string;
          product_id: string;
          status: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          environment?: string;
          id?: string;
          price_id: string;
          product_id: string;
          status?: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          environment?: string;
          id?: string;
          price_id?: string;
          product_id?: string;
          status?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_role: "admin" | "supporter" | "registry_member";
      board_state:
        "nominated" | "funding" | "funded" | "procuring" | "testing" | "published" | "expired";
      pledge_status:
        "authorized" | "captured" | "cancelled" | "failed" | "pending" | "paid" | "refunded";
      result_verdict: "consistent" | "concerns" | "failed" | "insufficient";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "supporter", "registry_member"],
      board_state: [
        "nominated",
        "funding",
        "funded",
        "procuring",
        "testing",
        "published",
        "expired",
      ],
      pledge_status: [
        "authorized",
        "captured",
        "cancelled",
        "failed",
        "pending",
        "paid",
        "refunded",
      ],
      result_verdict: ["consistent", "concerns", "failed", "insufficient"],
    },
  },
} as const;
