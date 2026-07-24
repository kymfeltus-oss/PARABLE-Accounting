import { ManualJournalEntrySection } from "@/components/accounting/manual-journal-entry-section";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import { getManualJournalOptions } from "@/lib/data/manual-journal-options";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";

export default async function NewManualJournalPage() {
  const organizationId = await getCurrentOrganizationId();

  let options;

  try {
    options = await getManualJournalOptions(organizationId);
  } catch {
    return (
      <section
        aria-labelledby="new-manual-journal-page-title"
        className="space-y-6"
      >
        <header className="space-y-2">
          <h1
            className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            id="new-manual-journal-page-title"
          >
            New manual journal entry
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Record a balanced manual journal entry in the current organization.
          </p>
        </header>

        <WorkspaceDataEmpty message="Manual journal options could not be loaded. Please try again." />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="new-manual-journal-page-title"
      className="space-y-6"
    >
      <header className="space-y-2">
        <h1
          className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          id="new-manual-journal-page-title"
        >
          New manual journal entry
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Record a balanced manual journal entry using active posting accounts,
          active funds, and an open accounting period.
        </p>
      </header>

      <ManualJournalEntrySection
        accounts={options.accounts}
        funds={options.funds}
        periods={options.periods}
      />
    </section>
  );
}
