import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { getMonthDateRange, unwrapRows } from "./query-helpers";
import type { AuditDocumentRow, AuditEventRow } from "./types/rows";

export type AuditVaultData = {
  organizationId: string;
  events: AuditEventRow[];
  documents: AuditDocumentRow[];
  counts: {
    totalEvents: number;
    totalDocuments: number;
    eventsThisMonth: number;
    documentsThisMonth: number;
  };
};

function isInCurrentMonth(timestamp: string, startDate: string, endDate: string): boolean {
  const date = timestamp.slice(0, 10);
  return date >= startDate && date <= endDate;
}

export async function getAuditVaultData(
  organizationId: string,
): Promise<AuditVaultData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getAuditVaultData",
  );
  const supabase = await createServerSupabaseClient();
  const { startDate, endDate } = getMonthDateRange();

  const [eventsResult, documentsResult] = await Promise.all([
    supabase
      .from("audit_events")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("audit_documents")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("created_at", { ascending: false }),
  ]);

  const events = unwrapRows<AuditEventRow>(
    "getAuditVaultData.events",
    eventsResult,
  );
  const documents = unwrapRows<AuditDocumentRow>(
    "getAuditVaultData.documents",
    documentsResult,
  );

  return {
    organizationId: scopedOrganizationId,
    events,
    documents,
    counts: {
      totalEvents: events.length,
      totalDocuments: documents.length,
      eventsThisMonth: events.filter((event) =>
        isInCurrentMonth(event.occurred_at, startDate, endDate),
      ).length,
      documentsThisMonth: documents.filter((document) =>
        isInCurrentMonth(document.created_at, startDate, endDate),
      ).length,
    },
  };
}
