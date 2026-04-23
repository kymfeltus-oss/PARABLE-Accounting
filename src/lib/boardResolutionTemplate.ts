import type { TenantRow } from "@/types/tenant";

const TEMPLATE = `BOARD RESOLUTION — MINISTER HOUSING ALLOWANCE DESIGNATION
{{LEGAL_NAME}}  ·  EIN {{EIN}}  ·  Fiscal year {{FISCAL_YEAR}}

WHEREAS, {{LEGAL_NAME}} (the "Organization") compensates ministerial staff in accordance with Internal Revenue Code Section 107; and

WHEREAS, the governing board desires to designate a housing allowance for qualifying minister(s) before amounts are paid or designated;

NOW, THEREFORE, BE IT RESOLVED that the Organization hereby designates a housing allowance for the qualifying minister(s) identified in the confidential payroll / board packet, effective for the Organization's {{FISCAL_YEAR}} tax year, in amounts not exceeding the fair rental value of the home plus amounts paid for utilities and furnishings, as provided under Section 107; and

BE IT FURTHER RESOLVED that the treasurer (or designee) shall document the designation in payroll records contemporaneously and retain this resolution with the Organization's permanent minutes; and

BE IT FURTHER RESOLVED that this resolution shall remain in effect until superseded by a subsequent board action.

Adopted this {{ASSEMBLY_DATE}}.

____________________________________          ____________________________________
Board Chair (print & sign)                    Secretary (print & sign)

DISCLAIMER: This template is for board workflow only and is not legal or tax advice. Have qualified counsel review before adoption.
`;

export type BoardResolutionVars = {
  fiscalYear: number;
  /** ISO or display date string */
  assemblyDate: string;
};

export function buildBoardResolutionText(tenant: TenantRow | null, vars: BoardResolutionVars): string {
  const legal = tenant?.legal_name?.trim() || tenant?.display_name?.trim() || "[Organization legal name]";
  const ein = tenant?.tax_id_ein?.trim() || "[EIN — set in tenants.tax_id_ein]";
  return TEMPLATE.replaceAll("{{LEGAL_NAME}}", legal)
    .replaceAll("{{EIN}}", ein)
    .replaceAll("{{FISCAL_YEAR}}", String(vars.fiscalYear))
    .replaceAll("{{ASSEMBLY_DATE}}", vars.assemblyDate);
}
