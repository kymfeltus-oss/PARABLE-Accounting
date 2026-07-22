import type { AuditVaultData } from "@/lib/data/audit-vault-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyAuditVaultData(
  organizationId: string = TEST_ORGANIZATION_ID,
): AuditVaultData {
  return {
    organizationId,
    events: [],
    documents: [],
    counts: {
      totalEvents: 0,
      totalDocuments: 0,
      eventsThisMonth: 0,
      documentsThisMonth: 0,
    },
  };
}

export function createPopulatedAuditVaultData(): AuditVaultData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    events: [
      {
        id: "audit-event-1",
        organization_id: TEST_ORGANIZATION_ID,
        event_type: "journal_entry_posted",
        source_type: "journal_entry",
        source_id: "journal-1",
        actor_type: "user",
        actor_user_id: null,
        description: "Journal entry posted to general ledger.",
        occurred_at: "2026-07-10T14:30:00.000Z",
        created_at: "2026-07-10T14:30:00.000Z",
      },
      {
        id: "audit-event-2",
        organization_id: TEST_ORGANIZATION_ID,
        event_type: "compliance_item_completed",
        source_type: "compliance_item",
        source_id: "compliance-1",
        actor_type: "system",
        actor_user_id: null,
        description: null,
        occurred_at: "2026-07-08T09:00:00.000Z",
        created_at: "2026-07-08T09:00:00.000Z",
      },
      {
        id: "audit-event-3",
        organization_id: TEST_ORGANIZATION_ID,
        event_type: "exception_resolved",
        source_type: "exception",
        source_id: "exception-1",
        actor_type: "integration",
        actor_user_id: null,
        description: "Exception marked resolved by integration sync.",
        occurred_at: "2026-06-15T16:00:00.000Z",
        created_at: "2026-06-15T16:00:00.000Z",
      },
    ],
    documents: [
      {
        id: "audit-document-1",
        organization_id: TEST_ORGANIZATION_ID,
        audit_event_id: "audit-event-1",
        name: "July Board Financial Summary",
        document_type: "financial",
        document_date: "2026-07-01",
        description: "Monthly board packet financial section.",
        status: "active",
        created_at: "2026-07-10T15:00:00.000Z",
        updated_at: "2026-07-10T15:00:00.000Z",
      },
      {
        id: "audit-document-2",
        organization_id: TEST_ORGANIZATION_ID,
        audit_event_id: null,
        name: "Bank Reconciliation Workpaper",
        document_type: "banking",
        document_date: "2026-07-05",
        description: null,
        status: "active",
        created_at: "2026-07-09T11:00:00.000Z",
        updated_at: "2026-07-09T11:00:00.000Z",
      },
      {
        id: "audit-document-3",
        organization_id: TEST_ORGANIZATION_ID,
        audit_event_id: "audit-event-2",
        name: "Compliance Attestation Record",
        document_type: "compliance",
        document_date: null,
        description: "Archived compliance attestation metadata.",
        status: "archived",
        created_at: "2026-06-01T10:00:00.000Z",
        updated_at: "2026-06-20T10:00:00.000Z",
      },
    ],
    counts: {
      totalEvents: 3,
      totalDocuments: 3,
      eventsThisMonth: 2,
      documentsThisMonth: 2,
    },
  };
}
