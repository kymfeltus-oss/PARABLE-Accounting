import type { Metadata } from "next";
import IntroFlashClient from "./IntroFlashClient";

export const metadata: Metadata = {
  title: "PARABLE Accounting",
  description: "AI-Driven Financial Integrity for the Modern Ministry.",
};

export default function IntroPage() {
  return <IntroFlashClient />;
}
