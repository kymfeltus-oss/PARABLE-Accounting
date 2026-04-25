import { redirect } from "next/navigation";

/**
 * Staff “dashboard” is the command center. `/` is reserved for the member hub.
 */
export default function DashboardIndexPage() {
  redirect("/command-center");
}
