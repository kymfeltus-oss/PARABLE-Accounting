/**
 * Foundry (Sovereign) primary rail — one link per module. Accounting drill-down lives
 * in-center on /accounting (not in the left sidebar). See @/lib/accountingHubNav
 * @typedef {{ name: string, icon: string, path: string }} NavModule
 * @type {NavModule[]}
 */
export const sidebarNavigation = [
  { name: "Accounting", icon: "CalculatorIcon", path: "/accounting" },
  { name: "Reporting", icon: "ChartBarIcon", path: "/reporting" },
  { name: "Members", icon: "UsersIcon", path: "/members" },
  { name: "Member portal", icon: "GiftIcon", path: "/member-portal" },
  { name: "Parable Giving", icon: "GiftIcon", path: "/giving" },
  { name: "Project Building Fund", icon: "OfficeBuildingIcon", path: "/building-fund" },
  { name: "Documents", icon: "FolderIcon", path: "/vault" },
];
