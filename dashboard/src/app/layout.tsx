import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, PlaySquare, Activity, Key, Settings, Database } from "lucide-react";

import { Sidebar } from "./Sidebar";

export const metadata: Metadata = {
  title: "ScrapeFlow - Dashboard",
  description: "Advanced Web Scraping Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 flex h-screen overflow-hidden font-sans">
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50/50">
          <div className="p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
