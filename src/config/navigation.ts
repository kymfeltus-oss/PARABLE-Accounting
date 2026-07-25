import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Archive,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Calculator,
  CalendarCheck2,
  FileText,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  Users,
  Wallet,
} from "lucide-react";

export type NavItemId =
  | "dashboard"
  | "giving"
  | "members"
  | "banking"
  | "transactions"
  | "expenses"
  | "bills"
  | "vendors"
  | "funds"
  | "budgets"
  | "accounting"
  | "reports"
  | "ai-close"
  | "compliance"
  | "exceptions"
  | "audit-vault"
  | "settings";

export type NavGroupId =
  | "overview"
  | "giving-members"
  | "banking-spending"
  | "vendors-planning"
  | "accounting"
  | "compliance"
  | "system";

export type NavItem = {
  id: NavItemId;
  href: `/${string}`;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  group: NavGroupId;
};

export type NavGroup = {
  id: NavGroupId;
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        id: "dashboard",
        href: "/dashboard",
        label: "Dashboard",
        title: "Dashboard",
        description:
          "Central workspace overview for ministry accounting activity and operational status.",
        icon: LayoutDashboard,
        group: "overview",
      },
    ],
  },
  {
    id: "giving-members",
    label: "Giving & Members",
    items: [
      {
        id: "giving",
        href: "/giving",
        label: "Giving",
        title: "Giving",
        description: "Record and manage donor contributions.",
        icon: HandCoins,
        group: "giving-members",
      },
      {
        id: "members",
        href: "/members",
        label: "Members",
        title: "Members",
        description: "Maintain member contact records for your ministry.",
        icon: Users,
        group: "giving-members",
      },
    ],
  },
  {
    id: "banking-spending",
    label: "Banking & Spending",
    items: [
      {
        id: "banking",
        href: "/banking",
        label: "Banking",
        title: "Banking",
        description:
          "Record ministry bank accounts and match bank transactions manually.",
        icon: Landmark,
        group: "banking-spending",
      },
      {
        id: "transactions",
        href: "/transactions",
        label: "Transactions",
        title: "Transactions",
        description: "Review recorded bank transactions and match status.",
        icon: ArrowLeftRight,
        group: "banking-spending",
      },
      {
        id: "expenses",
        href: "/expenses",
        label: "Expenses",
        title: "Expenses",
        description: "Track ministry spending and expense entries.",
        icon: Receipt,
        group: "banking-spending",
      },
      {
        id: "bills",
        href: "/bills",
        label: "Bills",
        title: "Bills",
        description: "Create, open, pay, and void ministry bills.",
        icon: FileText,
        group: "banking-spending",
      },
    ],
  },
  {
    id: "vendors-planning",
    label: "Vendors & Planning",
    items: [
      {
        id: "vendors",
        href: "/vendors",
        label: "Vendors",
        title: "Vendors",
        description: "Maintain vendor records and payment relationships.",
        icon: Store,
        group: "vendors-planning",
      },
      {
        id: "funds",
        href: "/funds",
        label: "Funds",
        title: "Funds",
        description: "Define and manage designated ministry funds.",
        icon: Wallet,
        group: "vendors-planning",
      },
      {
        id: "budgets",
        href: "/budgets",
        label: "Budgets",
        title: "Budgets",
        description: "Plan and monitor budgets across ministry areas.",
        icon: Calculator,
        group: "vendors-planning",
      },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    items: [
      {
        id: "accounting",
        href: "/accounting",
        label: "Accounting",
        title: "Accounting",
        description:
          "Core accounting workflows and general ledger operations.",
        icon: BookOpen,
        group: "accounting",
      },
      {
        id: "reports",
        href: "/reports",
        label: "Reports",
        title: "Reports",
        description: "View live ledger-backed financial statements and summaries.",
        icon: BarChart3,
        group: "accounting",
      },
      {
        id: "ai-close",
        href: "/ai-close",
        label: "Close",
        title: "Period Close",
        description:
          "Close sessions and tasks from live records. Automated AI close is not available yet.",
        icon: CalendarCheck2,
        group: "accounting",
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    items: [
      {
        id: "compliance",
        href: "/compliance",
        label: "Compliance",
        title: "Compliance",
        description: "Track compliance checklist items for your ministry.",
        icon: ShieldCheck,
        group: "compliance",
      },
      {
        id: "exceptions",
        href: "/exceptions",
        label: "Exceptions",
        title: "Exceptions",
        description: "Review accounting exceptions requiring attention.",
        icon: AlertTriangle,
        group: "compliance",
      },
      {
        id: "audit-vault",
        href: "/audit-vault",
        label: "Audit Vault",
        title: "Audit Vault",
        description: "Review audit events and uploaded audit documents.",
        icon: Archive,
        group: "compliance",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        id: "settings",
        href: "/settings",
        label: "Settings",
        title: "Settings",
        description: "Application configuration and workspace preferences.",
        icon: Settings,
        group: "system",
      },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);

export function getNavItemByPathname(pathname: string): NavItem | undefined {
  return navItems.find((item) => item.href === pathname);
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) {
    return true;
  }

  // Keep parent nav items highlighted on nested routes (e.g. Settings pages).
  if (item.href === "/settings") {
    return pathname.startsWith(`${item.href}/`);
  }

  return false;
}
