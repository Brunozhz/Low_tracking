import type { Metadata } from "next";
import { Syne, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { AuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

const displayFont = Syne({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Low Tracking | Tracking + IA para Meta Ads",
  description: "Plataforma SaaS de tracking, atribuição e otimização inteligente para Meta Ads.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${displayFont.variable} ${monoFont.variable}`}>
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Toaster richColors theme="dark" />
      </body>
    </html>
  );
}

