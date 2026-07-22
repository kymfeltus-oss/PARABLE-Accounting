"use client";

import type { AuditDocumentRow } from "@/lib/data/types/rows";

type AuditDocumentsTableProps = {
  documents: AuditDocumentRow[];
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AuditDocumentsTable({ documents }: AuditDocumentsTableProps) {
  if (documents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No audit documents match the current filter.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Document</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Document Date</th>
            <th className="px-3 py-2 font-medium">Recorded</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id} className="border-b border-border/70 align-top">
              <td className="px-3 py-3">
                <p className="font-medium text-foreground">{document.name}</p>
                {document.description ? (
                  <p className="mt-1 text-muted-foreground">{document.description}</p>
                ) : null}
                {document.audit_event_id ? (
                  <p className="mt-1 text-muted-foreground">
                    Linked event: {document.audit_event_id}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatLabel(document.document_type)}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatLabel(document.status)}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatDate(document.document_date)}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatDateTime(document.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { AuditDocumentsTableProps };
