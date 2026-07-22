import { navGroups } from "@/config/navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { NavSection } from "./nav-section";

export function AppSidebar() {
  return (
    <aside className="hidden h-full w-64 shrink-0 border-r border-border bg-background md:flex md:flex-col">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-[0.2em] text-foreground">
            PARABLE
          </p>
          <p className="text-lg font-semibold text-foreground">Accounting</p>
        </div>
        <Badge variant="secondary">Development Workspace</Badge>
      </div>

      <ScrollArea className="flex-1">
        <nav aria-label="Primary navigation" className="px-2 py-4">
          {navGroups.map((group) => (
            <div key={group.id}>
              {group.id === "system" ? <Separator className="my-4" /> : null}
              <NavSection group={group} />
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">Phase 1A</p>
      </div>
    </aside>
  );
}
