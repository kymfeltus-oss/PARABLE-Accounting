"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { AuditDocumentsTable } from "@/components/audit-vault/audit-documents-table";
import { AuditEventsTable } from "@/components/audit-vault/audit-events-table";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { AuditVaultData } from "@/lib/data/audit-vault-repository";

const summaryLabels = [
  "Total Audit Events",
  "Total Audit Documents",
  "Audit Events This Month",
  "Documents Added This Month",
] as const;

const documentTypeFilters = [
  { id: "all", label: "All Documents" },
  { id: "financial", label: "Financial" },
  { id: "banking", label: "Banking" },
  { id: "giving", label: "Giving" },
  { id: "compliance", label: "Compliance" },
  { id: "governance", label: "Governance" },
  { id: "exception", label: "Exception" },
  { id: "other", label: "Other" },
] as const;

type DocumentTypeFilterId = (typeof documentTypeFilters)[number]["id"];

const navigationLinks = [
  {
    id: "accounting",
    label: "Accounting",
    href: "/accounting",
    description: "Review ledger activity and journal records",
    icon: BookOpen,
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    description: "Open report-ready summaries",
    icon: FileText,
  },
  {
    id: "compliance",
    label: "Compliance",
    href: "/compliance",
    description: "Review compliance checkpoints",
    icon: ShieldCheck,
  },
  {
    id: "exceptions",
    label: "Exceptions",
    href: "/exceptions",
    description: "Inspect recorded exceptions",
    icon: TriangleAlert,
  },
] as const;

type AuditVaultPageContentProps = {
  data: AuditVaultData;
};

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: AuditVaultData,
): string {
  switch (label) {
    case "Total Audit Events":
      return String(data.counts.totalEvents);
    case "Total Audit Documents":
      return String(data.counts.totalDocuments);
    case "Audit Events This Month":
      return String(data.counts.eventsThisMonth);
    case "Documents Added This Month":
      return String(data.counts.documentsThisMonth);
    default:
      return "0";
  }
}

function hasAuditActivity(data: AuditVaultData): boolean {
  return data.events.length > 0 || data.documents.length > 0;
}

export function AuditVaultPageContent({ data }: AuditVaultPageContentProps) {
  const auditVaultNav = getNavItemByPathname("/audit-vault");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [documentTypeFilter, setDocumentTypeFilter] =
    useState<DocumentTypeFilterId>("all");
  const [eventSearch, setEventSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");

  if (!auditVaultNav) {
    throw new Error("Audit Vault navigation item is not configured.");
  }

  const eventTypeFilters = useMemo(() => {
    const distinctTypes = [...new Set(data.events.map((event) => event.event_type))].sort();

    return [
      { id: "all", label: "All Events" },
      ...distinctTypes.map((eventType) => ({
        id: eventType,
        label: eventType.replace(/_/g, " "),
      })),
    ];
  }, [data.events]);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = eventSearch.trim().toLowerCase();

    return data.events.filter((event) => {
      const matchesType =
        eventTypeFilter === "all" || event.event_type === eventTypeFilter;

      if (!matchesType) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        event.event_type,
        event.source_type,
        event.actor_type,
        event.description ?? "",
        event.source_id ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [data.events, eventSearch, eventTypeFilter]);

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = documentSearch.trim().toLowerCase();

    return data.documents.filter((document) => {
      const matchesType =
        documentTypeFilter === "all" ||
        document.document_type === documentTypeFilter;

      if (!matchesType) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        document.name,
        document.description ?? "",
        document.document_type,
        document.status,
        document.audit_event_id ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [data.documents, documentSearch, documentTypeFilter]);

  return (
    <section aria-labelledby="audit-vault-title" className="space-y-8">
      <header className="space-y-2">
        <h1
          id="audit-vault-title"
          className="text-3xl font-semibold tracking-tight text-foreground"
        >
          {auditVaultNav.title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {auditVaultNav.description}
        </p>
      </header>

      {!hasAuditActivity(data) ? (
        <WorkspaceDataEmpty message="No audit records yet." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryLabels.map((label) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {formatSummaryValue(label, data)}
            </p>
          </article>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Audit Vault reflects recorded audit events and document metadata in the
        current system. Cryptographic verification, legal chain-of-custody
        certification, and automated audit conclusions are not implemented unless
        explicitly supported by recorded data.
      </p>

      <section
        aria-labelledby="audit-vault-events-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="audit-vault-events-title"
            className="text-lg font-semibold text-foreground"
          >
            Recent Audit Events
          </h2>
          <p className="text-sm text-muted-foreground">
            Recorded event type, source, actor, and occurrence time.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {eventTypeFilters.map((filter) => (
            <Button
              key={filter.id}
              aria-pressed={eventTypeFilter === filter.id}
              size="sm"
              type="button"
              variant={eventTypeFilter === filter.id ? "default" : "outline"}
              onClick={() => setEventTypeFilter(filter.id)}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-foreground">
            Search audit events
            <input
              className="mt-2 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Search by event type, source, actor, or description"
              type="search"
              value={eventSearch}
              onChange={(event) => setEventSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-6">
          {data.events.length === 0 ? (
            <WorkspaceDataEmpty message="No audit events yet." />
          ) : filteredEvents.length === 0 ? (
            <WorkspaceDataEmpty message="No audit events match the current filter." />
          ) : (
            <AuditEventsTable events={filteredEvents.slice(0, 20)} />
          )}
        </div>
      </section>

      <section
        aria-labelledby="audit-vault-documents-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="audit-vault-documents-title"
            className="text-lg font-semibold text-foreground"
          >
            Audit Documents
          </h2>
          <p className="text-sm text-muted-foreground">
            Document metadata recorded with the audit vault.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {documentTypeFilters.map((filter) => (
            <Button
              key={filter.id}
              aria-pressed={documentTypeFilter === filter.id}
              size="sm"
              type="button"
              variant={documentTypeFilter === filter.id ? "default" : "outline"}
              onClick={() => setDocumentTypeFilter(filter.id)}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-foreground">
            Search audit documents
            <input
              className="mt-2 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Search by name, type, status, or linked event"
              type="search"
              value={documentSearch}
              onChange={(event) => setDocumentSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-6">
          {data.documents.length === 0 ? (
            <WorkspaceDataEmpty message="No audit documents yet." />
          ) : filteredDocuments.length === 0 ? (
            <WorkspaceDataEmpty message="No audit documents match the current filter." />
          ) : (
            <AuditDocumentsTable documents={filteredDocuments.slice(0, 20)} />
          )}
        </div>
      </section>

      <section
        aria-labelledby="audit-vault-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="audit-vault-related-workspaces-title"
            className="text-lg font-semibold text-foreground"
          >
            Related Workspaces
          </h2>
          <p className="text-sm text-muted-foreground">
            Navigate to connected audit and review areas.
          </p>
        </div>

        <ul className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {navigationLinks.map((link) => (
            <li key={link.id}>
              <Button
                asChild
                className="h-auto w-full justify-start px-3 py-3"
                variant="outline"
              >
                <Link href={link.href}>
                  <link.icon aria-hidden className="size-4" />
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="inline-flex items-center gap-1 font-medium">
                      {link.label}
                      <ArrowUpRight aria-hidden className="size-3.5" />
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {link.description}
                    </span>
                  </span>
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

export type { AuditVaultPageContentProps };
