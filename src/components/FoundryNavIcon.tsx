import type { FoundrySubIconId } from "@/lib/sidebarFoundryNav";

const CYBER = "rgb(var(--brand-cyber-rgb) / 0.9)";

type Props = {
  name: FoundrySubIconId | "calculator" | "chartbar" | "users" | "building" | "folder" | "gift";
  className?: string;
  size?: number;
};

/** Minimal line icons — 12/14px, sovereign / tech-noir */
export default function FoundryNavIcon({ name, className = "shrink-0", size = 14 }: Props) {
  const s = size;
  const common = { width: s, height: s, className, "aria-hidden": true as const };

  switch (name) {
    case "document":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
          <path d="M14 2v6h6" />
        </svg>
      );
    case "bank":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10h18" />
          <path d="M4 10V8l8-4 8 4v2" />
          <path d="M6 10v8h4v-4h4v4h4v-8" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "fileTax":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h4l2 3h8v14H4V4Z" />
          <path d="M8 14h4M8 18h8" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20V10M10 20V4M16 20v-6M22 20V14" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 6v5c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="rgb(var(--brand-cyber-rgb) / 0.15)" stroke={CYBER} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round">
          <path d="M13 2 3 14h7l-1.5 8L21 8h-7.5L13 2Z" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 2h6l4 4v12l-2 1-2-1-2 1-2-1-2 1V2Z" />
          <path d="M10 7h2M9 10h3" />
        </svg>
      );
    case "calculator":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h8M8 10h2M8 14h2M8 18h2M12 10h2M12 14h2M12 18h2M16 10h1M16 14h1M16 18h1" />
        </svg>
      );
    case "chartbar":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20V4" />
          <rect x="7" y="12" width="3" height="6" fill="rgb(var(--brand-cyber-rgb) / 0.2)" />
          <rect x="12" y="8" width="3" height="10" fill="rgb(var(--brand-cyber-rgb) / 0.2)" />
          <rect x="17" y="4" width="3" height="14" fill="rgb(var(--brand-cyber-rgb) / 0.2)" />
        </svg>
      );
    case "users":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 11a3 3 0 1 0-3-3" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M20 19a4 4 0 0 0-5-3.5" />
        </svg>
      );
    case "building":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
          <path d="M6 10h3v4H6" />
          <path d="M6 6h3v2H6" />
          <path d="M15 14h2M15 10h2" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h5l1.4 1.5H20V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" fill="rgb(var(--brand-cyber-rgb) / 0.1)" />
        </svg>
      );
    case "gift":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={CYBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="8" width="18" height="14" rx="1" fill="rgb(var(--brand-cyber-rgb) / 0.1)" />
          <path d="M12 8V21M3 10c0-2.5 2-4 4.5-4C10 6 12 7 12 7s2-1 4.5-1C19 6 21 7.5 21 10" />
        </svg>
      );
    default:
      return <span className="inline-block h-3.5 w-0.5 rounded-full bg-[rgb(var(--brand-cyber-rgb)/0.4)]" style={{ width: 2, height: s }} aria-hidden />;
  }
}
