"use client";

import { useState } from "react";

import { AppHeader } from "./app-header";
import {
  AppSidebar,
  type WorkspaceShellIdentity,
} from "./app-sidebar";
import { MobileNav } from "./mobile-nav";

type AppShellProps = {
  children: React.ReactNode;
  identity: WorkspaceShellIdentity;
};

export function AppShell({ children, identity }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="app-shell flex min-h-svh min-w-0 overflow-x-clip bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        Skip to main content
      </a>
      <AppSidebar identity={identity} />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col overflow-x-clip">
        <AppHeader onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main
          id="main-content"
          className="app-main min-w-0 flex-1 overflow-x-auto overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 md:px-7 lg:px-8 lg:py-7"
        >
          {children}
        </main>
      </div>
      <MobileNav
        identity={identity}
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
      />
    </div>
  );
}

export type { AppShellProps };
