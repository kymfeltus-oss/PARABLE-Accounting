import { navItems } from "@/config/navigation";
import type { NavItemId } from "@/config/navigation";

type WorkspacePageProps = {
  navId: NavItemId;
};

export function WorkspacePage({ navId }: WorkspacePageProps) {
  const navItem = navItems.find((item) => item.id === navId);

  if (!navItem) {
    throw new Error(`Navigation item not found for navId: ${navId}`);
  }

  return (
    <section aria-labelledby={`${navId}-title`} className="space-y-6">
      <div className="space-y-2">
        <h1
          id={`${navId}-title`}
          className="text-3xl font-semibold text-foreground"
        >
          {navItem.title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {navItem.description}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground">
        <p className="text-sm leading-6 text-muted-foreground">
          This workspace section is not yet configured. Live ministry financial
          data and workflows will appear here in a future implementation phase.
        </p>
      </div>
    </section>
  );
}

export type { WorkspacePageProps };
