import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import AppProviders from "@/components/AppProviders";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.parableaccountant.com"),
  title: "PARABLE Accounting — Ministry fund accounting",
  description:
    "PARABLE Accounting (www.parableaccountant.com): audit-oriented ledger for churches and ministries — fund segregation, append-only events, and alignment with the PARABLE ecosystem (streaming, giving, compliance).",
};

/** Scales to phone / tablet / desktop; allows pinch-zoom (accessibility). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070708",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full min-w-0 dark`}>
      <body className={`${inter.className} min-h-full min-w-0 overflow-x-clip bg-[#070708] text-white antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
