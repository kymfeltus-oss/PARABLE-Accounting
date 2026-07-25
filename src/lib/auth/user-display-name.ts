type UserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export function getUserDisplayName(user: UserLike): string {
  const metadata = user.user_metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
  const name = typeof metadata.name === "string" ? metadata.name.trim() : "";
  const email = user.email?.trim() ?? "";

  return fullName || name || email || "Signed-in user";
}
