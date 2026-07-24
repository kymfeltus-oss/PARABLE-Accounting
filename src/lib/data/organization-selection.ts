import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

export const ORGANIZATION_SELECTION_COOKIE =
  "parable_active_organization_id";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export async function getSelectedOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ORGANIZATION_SELECTION_COOKIE)?.value?.trim();

  return value && value.length > 0 ? value : null;
}

export async function setSelectedOrganizationId(
  organizationId: string,
): Promise<void> {
  const scopedOrganizationId = organizationId.trim();

  if (!scopedOrganizationId) {
    throw new Error("Organization id is required to persist selection");
  }

  const cookieStore = await cookies();
  cookieStore.set(ORGANIZATION_SELECTION_COOKIE, scopedOrganizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearSelectedOrganizationId(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ORGANIZATION_SELECTION_COOKIE);
}

export function createInviteToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  return { token, tokenHash };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}
