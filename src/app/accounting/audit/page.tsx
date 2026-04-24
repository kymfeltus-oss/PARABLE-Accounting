import { redirect } from "next/navigation";

/** Internal controls & IRS Pub. 1828 heuristics — main workspace lives in Compliance. */
export default function AccountingAuditRedirect() {
  redirect("/compliance");
}
