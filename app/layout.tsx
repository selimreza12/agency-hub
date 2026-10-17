import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agency Hub & Client Radar | Verified B2B Engine",
  description: "Autonomous Web3 & AI client acquisition radar with 100% verified founder channels and 1-click tailored outreach.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-neutral-950 text-neutral-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-300`}>
        {children}
      </body>
    </html>
  );
}
