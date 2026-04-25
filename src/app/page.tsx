import type { Metadata } from "next";
import IntroFlashClient from "./intro/IntroFlashClient";

export const metadata: Metadata = {
  title: "PARABLE Accounting",
  description: "AI-driven fund accounting, ledger integrity, and operational control.",
};

export default function HomePage() {
  return <IntroFlashClient />;
}
