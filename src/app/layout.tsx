import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppProviders from "@/components/AppProviders";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PARABLE Accounting — Ministry fund accounting",
  description:
    "PARABLE Accounting: audit-oriented ledger for churches and ministries — fund segregation, append-only events, and alignment with the PARABLE ecosystem (streaming, giving, compliance).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full dark`}>
      <body className={`${inter.className} min-h-full bg-[#070708] text-white antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
