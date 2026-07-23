type BrandWordmarkProps = {
  compact?: boolean;
};

export function BrandWordmark({ compact = false }: BrandWordmarkProps) {
  return (
    <div className="min-w-0 space-y-1">
      <p
        className={
          compact
            ? "font-heading text-sm font-medium leading-none tracking-[0.28em] text-foreground"
            : "font-heading whitespace-nowrap text-[0.86rem] font-medium leading-none tracking-[0.3em] text-sidebar-foreground"
        }
      >
        PARABLE
      </p>
      <p
        className={
          compact
            ? "font-heading text-base font-medium leading-none tracking-[0.18em] text-foreground uppercase"
            : "font-heading whitespace-nowrap text-[0.68rem] font-medium leading-none tracking-[0.26em] text-sidebar-foreground/80 uppercase"
        }
      >
        Accounting
      </p>
    </div>
  );
}
