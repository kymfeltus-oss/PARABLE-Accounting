export type TenantRow = {
  id: string;
  slug: string;
  display_name: string;
  legal_name: string | null;
  primary_color: string;
  accent_color: string;
  logo_url: string | null;
  custom_domain: string | null;
  tax_id_ein: string | null;
  fiscal_year_start: string;
};
