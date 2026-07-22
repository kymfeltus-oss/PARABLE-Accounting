import { type NavGroup } from "@/config/navigation";

import { NavLink } from "./nav-link";

type NavSectionProps = {
  group: NavGroup;
  onNavigate?: () => void;
  compact?: boolean;
};

export function NavSection({ group, onNavigate, compact }: NavSectionProps) {
  return (
    <section aria-labelledby={`nav-group-${group.id}`}>
      <h2
        id={`nav-group-${group.id}`}
        className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {group.label}
      </h2>
      <ul className="space-y-1">
        {group.items.map((item) => (
          <li key={item.id}>
            <NavLink item={item} onNavigate={onNavigate} compact={compact} />
          </li>
        ))}
      </ul>
    </section>
  );
}
