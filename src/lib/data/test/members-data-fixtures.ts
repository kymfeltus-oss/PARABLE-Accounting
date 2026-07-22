import type { MembersData } from "@/lib/data/members-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyMembersData(
  organizationId: string = TEST_ORGANIZATION_ID,
): MembersData {
  return {
    organizationId,
    members: [],
    counts: {
      total: 0,
      active: 0,
      inactive: 0,
    },
  };
}

export function createPopulatedMembersData(): MembersData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    members: [
      {
        id: "member-1",
        organization_id: TEST_ORGANIZATION_ID,
        first_name: "Jordan",
        last_name: "Lee",
        email: "jordan.lee@example.org",
        phone: "555-0100",
        status: "active",
        created_at: "2026-07-05T12:00:00.000Z",
        updated_at: "2026-07-05T12:00:00.000Z",
      },
      {
        id: "member-2",
        organization_id: TEST_ORGANIZATION_ID,
        first_name: "Taylor",
        last_name: "Reed",
        email: null,
        phone: null,
        status: "inactive",
        created_at: "2026-01-15T12:00:00.000Z",
        updated_at: "2026-01-15T12:00:00.000Z",
      },
    ],
    counts: {
      total: 2,
      active: 1,
      inactive: 1,
    },
  };
}
