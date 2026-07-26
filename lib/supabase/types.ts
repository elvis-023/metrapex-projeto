/**
 * Tipos manuais do schema do Milestone 11 (organizations, organization_members,
 * organization_invites, profiles). Regenerar com
 * `supabase gen types typescript --linked` assim que o projeto estiver linkado,
 * e ir ampliando este arquivo a cada nova migration (Milestone 12+).
 */
export type OrgRole = "admin" | "vendedor";
export type OrgPlan = "entrada" | "profissional" | "escala";
export type TaxMode = "inclusive" | "exclusive";
export type RateSource = "org_default" | "category" | "product";
export type PaymentConditionKind = "a_vista" | "cartao" | "boleto";
export type QuoteStatus = "gerado" | "enviado" | "negociacao" | "convertido" | "expirado";
export type QuoteDiscountType = "fixed" | "percent";

/**
 * Payloads jsonb das funções `save_quote_draft` / `issue_quote`. Todo valor
 * monetário viaja como STRING de 6 casas (`Decimal.toFixed(6)`), nunca como
 * `number` — o driver serializaria o número via float64 antes de a coluna
 * `numeric(18,6)` recebê-lo (convenção de dinheiro do briefing §3).
 */
export type QuoteDraftPayload = {
  status?: QuoteStatus;
  owner_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_document: string;
  customer_source_id: string | null;
  discount_type: QuoteDiscountType;
  discount_value: string;
  payment_condition_id: string | null;
  expires_at: string | null;
};

export type QuoteDraftItemPayload = {
  product_id: string;
  product_external_code: string;
  product_name: string;
  category_id_snapshot: string | null;
  category_name: string | null;
  quantity: string;
};

export type QuoteIssueTaxPayload = {
  tax_type_id: string;
  tax_code: string;
  tax_label: string;
  mode: TaxMode;
  rate_applied: string;
  rate_source: RateSource;
  note: string | null;
  base_amount: string;
  tax_amount: string;
  display_order: number;
};

export type QuoteIssueItemPayload = {
  position: number;
  unit_price_charged: string;
  unit_base_display: string;
  line_total: string;
  taxes: QuoteIssueTaxPayload[];
};

export type QuoteIssueSnapshotPayload = {
  subtotal: string;
  total: string;
  discount_amount: string;
  payment_discount_amount: string;
  payment_condition_label: string | null;
  payment_condition_kind: PaymentConditionKind | null;
  payment_condition_discount_percent: string | null;
  payment_condition_installments: number | null;
  payment_condition_term_days: number | null;
  payment_band_label: string | null;
  tax_footer_note: string | null;
  show_tax_lines: boolean;
};

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
          {
            foreignKeyName: "tax_rates_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          org_id: string;
          external_code: string;
          name: string;
          price: number;
          stock: number;
          category_id: string | null;
          photo_url: string | null;
          alternative_title: string;
          catalog_url: string;
          manual_url: string;
          video_url: string;
          certificate_eligible: boolean;
          lead_time: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          external_code: string;
          name: string;
          // number | string: numeric(18,6) aceita string na escrita — evita o
          // bounce por float64 do driver ao serializar um Decimal.js (ver
          // lib/catalog/actions.ts, convenção de dinheiro do briefing §3).
          price: number | string;
          stock?: number;
          category_id?: string | null;
          photo_url?: string | null;
          alternative_title?: string;
          catalog_url?: string;
          manual_url?: string;
          video_url?: string;
          certificate_eligible?: boolean;
          lead_time?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          external_code: string;
          name: string;
          price: number | string;
          stock: number;
          category_id: string | null;
          photo_url: string | null;
          alternative_title: string;
          catalog_url: string;
          manual_url: string;
          video_url: string;
          certificate_eligible: boolean;
          lead_time: string;
          updated_at: string;
        }>;
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_id_fkey";
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
      payment_conditions: {
        Row: {
          id: string;
          org_id: string;
          label: string;
          kind: PaymentConditionKind;
          discount_percent: number;
          installments: number;
          term_days: number;
          active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          label: string;
          kind: PaymentConditionKind;
          discount_percent?: number | string;
          installments?: number;
          term_days?: number;
          active?: boolean;
          display_order?: number;
        };
        Update: Partial<{
          label: string;
          kind: PaymentConditionKind;
          discount_percent: number | string;
          installments: number;
          term_days: number;
          active: boolean;
          display_order: number;
        }>;
        Relationships: [
          {
            foreignKeyName: "payment_conditions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_value_bands: {
        Row: {
          id: string;
          org_id: string;
          label: string;
          min_value: number;
          max_value: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          label: string;
          min_value?: number | string;
          max_value?: number | string | null;
        };
        Update: Partial<{
          label: string;
          min_value: number | string;
          max_value: number | string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "payment_value_bands_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_band_conditions: {
        Row: {
          band_id: string;
          payment_condition_id: string;
        };
        Insert: {
          band_id: string;
          payment_condition_id: string;
        };
        Update: Partial<{
          band_id: string;
          payment_condition_id: string;
        }>;
        Relationships: [
          {
            foreignKeyName: "payment_band_conditions_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "payment_value_bands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_band_conditions_payment_condition_id_fkey";
            columns: ["payment_condition_id"];
            isOneToOne: false;
            referencedRelation: "payment_conditions";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_sequences: {
        Row: {
          org_id: string;
          last_sequence: number;
        };
        Insert: {
          org_id: string;
          last_sequence?: number;
        };
        Update: Partial<{
          last_sequence: number;
        }>;
        Relationships: [
          {
            foreignKeyName: "quote_sequences_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          id: string;
          org_id: string;
          sequence: number;
          revision: number;
          previous_revision_id: string | null;
          superseded_by_revision_id: string | null;
          status: QuoteStatus;
          owner_id: string | null;
          customer_id: string | null;
          customer_name: string;
          customer_document: string;
          customer_source_id: string | null;
          discount_type: QuoteDiscountType;
          discount_value: number;
          discount_amount: number | null;
          payment_condition_id: string | null;
          payment_condition_label: string | null;
          payment_condition_kind: PaymentConditionKind | null;
          payment_condition_discount_percent: number | null;
          payment_condition_installments: number | null;
          payment_condition_term_days: number | null;
          payment_band_label: string | null;
          payment_discount_amount: number | null;
          subtotal: number | null;
          total: number | null;
          tax_snapshot_at: string | null;
          tax_footer_note: string | null;
          show_tax_lines: boolean;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          sequence: number;
          revision?: number;
          previous_revision_id?: string | null;
          status?: QuoteStatus;
          owner_id?: string | null;
          customer_id?: string | null;
          customer_name: string;
          customer_document?: string;
          customer_source_id?: string | null;
          discount_type?: QuoteDiscountType;
          discount_value?: number | string;
          payment_condition_id?: string | null;
          expires_at?: string | null;
        };
        /**
         * Só o que a trigger `quotes_guard_issued_immutable` deixa mudar num
         * documento já emitido: metadados de pipeline. Conteúdo do documento
         * (preço, imposto, desconto, condição, totais) é escrito uma única vez,
         * por `issue_quote`.
         */
        Update: Partial<{
          status: QuoteStatus;
          expires_at: string | null;
          superseded_by_revision_id: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "quotes_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          position: number;
          product_id: string | null;
          product_external_code: string;
          product_name: string;
          category_id_snapshot: string | null;
          category_name: string | null;
          quantity: number;
          unit_price_charged: number | null;
          unit_base_display: number | null;
          line_total: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          position: number;
          product_id?: string | null;
          product_external_code: string;
          product_name: string;
          category_id_snapshot?: string | null;
          category_name?: string | null;
          quantity: number | string;
        };
        Update: Partial<{
          quantity: number | string;
          unit_price_charged: number | string | null;
          unit_base_display: number | string | null;
          line_total: number | string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_item_taxes: {
        Row: {
          id: string;
          quote_item_id: string;
          /** Sem FK — snapshot, não referência viva. Nunca faça join com `tax_types`. */
          tax_type_id: string | null;
          tax_code: string;
          tax_label: string;
          mode: TaxMode;
          rate_applied: number;
          rate_source: RateSource;
          note: string | null;
          base_amount: number;
          tax_amount: number;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_item_id: string;
          tax_type_id?: string | null;
          tax_code: string;
          tax_label: string;
          mode: TaxMode;
          rate_applied: number | string;
          rate_source: RateSource;
          note?: string | null;
          base_amount: number | string;
          tax_amount: number | string;
          display_order?: number;
        };
        Update: Partial<never>;
        Relationships: [
          {
            foreignKeyName: "quote_item_taxes_quote_item_id_fkey";
            columns: ["quote_item_id"];
            isOneToOne: false;
            referencedRelation: "quote_items";
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
      upsert_product_by_external_code: {
        Args: {
          p_org_id: string;
          p_external_code: string;
          p_name: string;
          p_price: number | string;
          p_stock: number;
          p_category_id: string | null;
        };
        Returns: Database["public"]["Tables"]["products"]["Row"];
      };
      next_quote_sequence: {
        Args: { p_org_id: string };
        Returns: number;
      };
      save_quote_draft: {
        Args: {
          p_org_id: string;
          p_quote: QuoteDraftPayload;
          p_items: QuoteDraftItemPayload[];
          p_previous_revision_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["quotes"]["Row"];
      };
      issue_quote: {
        Args: {
          p_quote_id: string;
          p_items: QuoteIssueItemPayload[];
          p_snapshot: QuoteIssueSnapshotPayload;
        };
        Returns: Database["public"]["Tables"]["quotes"]["Row"];
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
