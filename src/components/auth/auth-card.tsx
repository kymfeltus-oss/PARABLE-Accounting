import type { ReactNode } from "react";

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
      className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <header className="space-y-2">
        <h1
          id="auth-card-title"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          {title}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </header>

      <div className="mt-6">{children}</div>

      {footer ? <div className="mt-6 border-t border-border pt-4">{footer}</div> : null}
    </section>
  );
}

export type { AuthCardProps };
