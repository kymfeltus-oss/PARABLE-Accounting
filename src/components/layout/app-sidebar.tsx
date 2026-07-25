import { BrandLogoMark } from "@/components/brand/brand-logo-mark";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { navGroups, navItems } from "@/config/navigation";

import { NavSection } from "./nav-section";

export type WorkspaceShellIdentity = {
  organizationName: string;
  userDisplayName: string;
  userEmail?: string | null;
};

type AppSidebarProps = {
  identity: WorkspaceShellIdentity;
};

function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }

  return label.trim().slice(0, 2).toUpperCase() || "PA";
}

export function AppSidebar({ identity }: AppSidebarProps) {
  const organizationInitials = initialsFromLabel(identity.organizationName);
  const userInitials = initialsFromLabel(identity.userDisplayName);
  const userSubtitle = identity.userEmail?.trim() || "Signed in";

  return (
    <aside className="app-sidebar hidden h-svh w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex md:flex-col">
      <div className="border-b border-sidebar-border px-5 py-5">
        <div className="flex min-h-14 items-center gap-3.5">
          <span className="grid h-14 w-12 shrink-0 place-items-center">
            <BrandLogoMark priority />
          </span>
          <BrandWordmark />
        </div>
        <p className="mt-2 pl-[3.85rem] text-[0.58rem] font-medium tracking-[0.16em] text-[#13C6FF] uppercase">
          Ministry Finance OS
        </p>
      </div>

      <ScrollArea className="flex-1">
        <nav aria-label="Primary navigation" className="px-2.5 py-4">
          {navGroups.map((group) => (
            <div key={group.id}>
              {group.id === "system" ? <Separator className="my-4" /> : null}
              <NavSection group={group} compact />
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="space-y-2 border-t border-sidebar-border p-3">
        <div className="flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-[#0B1220] p-2.5 text-left">
          <span className="grid size-8 shrink-0 place-items-center rounded bg-[#1677FF]/12 font-heading text-xs text-[#13C6FF]">
            {organizationInitials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-[#F7FAFF]">
              {identity.organizationName}
            </span>
            <span className="mt-0.5 block text-[0.65rem] text-[#7E8AA8]">
              Organization
            </span>
          </span>
        </div>
        <div className="flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-[#09111D] p-2.5 text-left">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs text-[#F7FAFF]">
            {userInitials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-[#F7FAFF]">
              {identity.userDisplayName}
            </span>
            <span className="mt-0.5 block truncate text-[0.65rem] text-[#7E8AA8]">
              {userSubtitle}
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}

/** Full desktop navigation list used by shell tests and consumers. */
export const sidebarItems = navItems;

export type { AppSidebarProps };
