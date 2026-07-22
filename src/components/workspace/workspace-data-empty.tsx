type WorkspaceDataEmptyProps = {
  message: string;
};

export function WorkspaceDataEmpty({ message }: WorkspaceDataEmptyProps) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-sm leading-6 text-muted-foreground">
      {message}
    </p>
  );
}
