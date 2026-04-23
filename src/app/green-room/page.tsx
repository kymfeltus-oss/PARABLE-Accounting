import type { Metadata, Viewport } from "next";
import MinistryAppShell from "@/components/MinistryAppShell";
import InstantPayoutMobile from "@/components/payout/InstantPayoutMobile";

export const metadata: Metadata = {
  title: "Green Room — instant honorarium",
  description: "Sovereign payout: PIN, ledger 7100, W-9 / $2,000 watch.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#040404",
};

export default function GreenRoomPage() {
  return (
    <MinistryAppShell>
      <InstantPayoutMobile />
    </MinistryAppShell>
  );
}
