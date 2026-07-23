import type { ReactNode } from "react";

import { BrandLogoMark } from "@/components/brand/brand-logo-mark";
import { BrandWordmark } from "@/components/brand/brand-wordmark";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <section
      aria-labelledby="auth-card-title"
      className="brand-surface w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground"
    >
      <header className="space-y-4">
        <div className="flex items-center gap-3.5">
          <BrandLogoMark className="h-auto max-h-12 w-auto object-contain drop-shadow-[0_0_14px_rgba(22,119,255,0.24)]" />
          <BrandWordmark compact />
        </div>
        <div className="space-y-2">
          <h1
            id="auth-card-title"
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            {title}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </header>

      <div className="mt-6">{children}</div>

      {footer ? <div className="mt-6 border-t border-border pt-4">{footer}</div> : null}
    </section>
  );
}

export type { AuthCardProps };
