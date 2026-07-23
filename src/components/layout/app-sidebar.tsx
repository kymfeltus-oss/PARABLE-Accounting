import { ChevronDown } from "lucide-react";
import { BrandLogoMark } from "@/components/brand/brand-logo-mark";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getNavItemByPathname } from "@/config/navigation";
import { NavLink } from "./nav-link";

const sidebarPaths = ["/dashboard","/giving","/expenses","/vendors","/banking","/accounting","/reports","/compliance","/members","/settings"] as const;
const sidebarItems = sidebarPaths.map((path) => {
  const item=getNavItemByPathname(path);
  if(!item)throw new Error(`Missing sidebar navigation item for ${path}`);
  return path==="/dashboard"?{...item,label:"Overview"}:item;
});

export function AppSidebar() {
  return <aside className="app-sidebar hidden h-svh w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex md:flex-col">
    <div className="border-b border-sidebar-border px-5 py-5"><div className="flex min-h-14 items-center gap-3.5"><span className="grid h-14 w-12 shrink-0 place-items-center"><BrandLogoMark priority/></span><BrandWordmark/></div><p className="mt-2 pl-[3.85rem] text-[0.58rem] font-medium tracking-[0.16em] text-[#13C6FF] uppercase">Ministry Finance OS</p></div>
    <ScrollArea className="flex-1"><nav aria-label="Primary navigation" className="px-2.5 py-4"><ul className="space-y-1">{sidebarItems.map((item)=><li key={item.id}><NavLink item={item}/></li>)}</ul></nav></ScrollArea>
    <div className="space-y-2 border-t border-sidebar-border p-3">
      <button type="button" className="flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-[#0B1220] p-2.5 text-left hover:border-[#1677FF]/35"><span className="grid size-8 shrink-0 place-items-center rounded bg-[#1677FF]/12 font-heading text-xs text-[#13C6FF]">PA</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-[#F7FAFF]">Parable Accounting</span><span className="mt-0.5 block text-[0.65rem] text-[#7E8AA8]">Development</span></span><ChevronDown aria-hidden className="size-3.5 text-[#7E8AA8]"/></button>
      <button type="button" className="flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-[#09111D] p-2.5 text-left hover:border-[#1677FF]/35"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs text-[#F7FAFF]">KF</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-[#F7FAFF]">Kym Feltus</span><span className="mt-0.5 block text-[0.65rem] text-[#7E8AA8]">Owner</span></span><ChevronDown aria-hidden className="size-3.5 text-[#7E8AA8]"/></button>
      <div className="rounded-md border border-sidebar-border bg-black/10 px-3 py-2.5"><p className="flex items-center gap-2 text-[0.68rem] text-[#D6DEEB]"><span className="size-1.5 rounded-full bg-[#39D98A]"/>All systems operational</p><p className="mt-1 pl-3.5 text-[0.6rem] text-[#7E8AA8]">Last synced 2 min ago</p></div>
    </div>
  </aside>;
}

export { sidebarItems };
