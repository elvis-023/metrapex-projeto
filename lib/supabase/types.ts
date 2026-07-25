/**
 * Tipos manuais do schema do Milestone 11 (organizations, organization_members,
 * organization_invites, profiles). Regenerar com
 * `supabase gen types typescript --linked` assim que o projeto estiver linkado,
 * e ir ampliando este arquivo a cada nova migration (Milestone 12+).
 */
export type OrgRole = "admin" | "vendedor";
export type OrgPlan = "entrada" | "profissional" | "escala";

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
