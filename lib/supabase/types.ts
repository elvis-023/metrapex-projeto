/**
 * Tipos manuais do schema do Milestone 11 (organizations, organization_members,
 * organization_invites, profiles). Regenerar com
 * `supabase gen types typescript --linked` assim que o projeto estiver linkado,
 * e ir ampliando este arquivo a cada nova migration (Milestone 12+).
 */
export type OrgRole = "admin" | "vendedor";
export type OrgPlan = "entrada" | "profissional" | "escala";
export type TaxMode = "inclusive" | "exclusive";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          created_at?: string;
        };
        Update: Partial<{
          full_name: string;
          email: string;
        }>;
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: OrgPlan;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: OrgPlan;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          slug: string;
          plan: OrgPlan;
        }>;
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role: OrgRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role: OrgRole;
          created_at?: string;
        };
        Update: Partial<{
          role: OrgRole;
        }>;
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_invites: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          role: OrgRole;
          token: string;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          role: OrgRole;
          token?: string;
          invited_by: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          role: OrgRole;
          accepted_at: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "organization_invites_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      product_categories: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
        }>;
        Relationships: [
          {
            foreignKeyName: "product_categories_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      tax_types: {
        Row: {
          id: string;
          org_id: string;
          code: string;
          label: string;
          mode: TaxMode;
          default_rate: number;
          active: boolean;
          display_order: number;
          footer_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          code: string;
          label: string;
          mode: TaxMode;
          default_rate?: number;
          active?: boolean;
          display_order?: number;
          footer_note?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          code: string;
          label: string;
          mode: TaxMode;
          default_rate: number;
          active: boolean;
          display_order: number;
          footer_note: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "tax_types_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      tax_rates: {
        Row: {
          id: string;
          tax_type_id: string;
          category_id: string | null;
          product_id: string | null;
          rate: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tax_type_id: string;
          category_id?: string | null;
          product_id?: string | null;
          rate: number;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          rate: number;
          note: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "tax_rates_tax_type_id_fkey";
            columns: ["tax_type_id"];
            isOneToOne: false;
            referencedRelation: "tax_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tax_rates_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      tax_settings: {
        Row: {
          org_id: string;
          document_footer: string | null;
          show_tax_lines: boolean;
          updated_at: string;
        };
        Insert: {
          org_id: string;
          document_footer?: string | null;
          show_tax_lines?: boolean;
          updated_at?: string;
        };
        Update: Partial<{
          document_footer: string | null;
          show_tax_lines: boolean;
          updated_at: string;
        }>;
        Relationships: [
          {
            foreignKeyName: "tax_settings_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      auth_org_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      auth_is_org_admin: {
        Args: { target_org: string };
        Returns: boolean;
      };
      create_organization: {
        Args: { org_name: string; org_slug: string };
        Returns: Database["public"]["Tables"]["organizations"]["Row"];
      };
      accept_invite: {
        Args: { invite_token: string };
        Returns: Database["public"]["Tables"]["organization_members"]["Row"];
      };
      get_invite_preview: {
        Args: { invite_token: string };
        Returns: {
          org_name: string | null;
          email: string | null;
          role: OrgRole | null;
          invited_by_name: string | null;
          is_valid: boolean;
        }[];
      };
    };
  };
};
