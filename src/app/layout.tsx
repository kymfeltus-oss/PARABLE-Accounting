import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Parable Accounting",
    template: "%s | Parable Accounting",
  },
  description:
    "Ministry Finance OS — AI-driven accounting and financial stewardship for churches and ministries.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05080f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full overflow-x-clip">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} flex min-h-full min-w-0 flex-col overflow-x-clip bg-background font-sans text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
