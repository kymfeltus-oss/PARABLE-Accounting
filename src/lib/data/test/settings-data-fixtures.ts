import type { SettingsData } from "@/lib/data/settings-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptySettingsData(
  organizationId: string = TEST_ORGANIZATION_ID,
): SettingsData {
  return {
    organizationId,
    organization: {
      id: organizationId,
      name: "Parable Community Church",
      slug: "parable-community-church",
      status: "active",
      created_at: "2026-01-15T10:00:00.000Z",
      updated_at: "2026-07-01T12:00:00.000Z",
    },
    memberships: [],
    counts: {
      totalMemberships: 0,
    },
  };
}

export function createPopulatedSettingsData(): SettingsData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    organization: {
      id: TEST_ORGANIZATION_ID,
      name: "Parable Community Church",
      slug: "parable-community-church",
      status: "active",
      created_at: "2026-01-15T10:00:00.000Z",
      updated_at: "2026-07-01T12:00:00.000Z",
    },
    memberships: [
      {
        id: "membership-1",
        organization_id: TEST_ORGANIZATION_ID,
        user_id: "11111111-1111-4111-8111-111111111111",
        created_at: "2026-02-01T09:00:00.000Z",
        updated_at: "2026-02-01T09:00:00.000Z",
      },
      {
        id: "membership-2",
        organization_id: TEST_ORGANIZATION_ID,
        user_id: "33333333-3333-4333-8333-333333333333",
        created_at: "2026-03-10T14:30:00.000Z",
        updated_at: "2026-06-20T08:15:00.000Z",
      },
    ],
    counts: {
      totalMemberships: 2,
    },
  };
}
