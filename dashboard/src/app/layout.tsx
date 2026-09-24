import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "./Sidebar";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "ScrapeFlow - Dashboard",
  description: "Advanced Web Scraping Management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has('scrapeflow_auth');

  return (
    <html lang="es">
      <body className="bg-[#0A0E1A] text-gray-200 flex flex-col md:flex-row h-screen overflow-hidden font-sans">
        {isAuthenticated && <Sidebar />}

        {/* Main Content */}
        <main className={`flex-1 flex flex-col h-screen overflow-y-auto bg-[#0D1117] ${isAuthenticated ? 'pb-16 md:pb-0' : ''}`}>
          <div className={`${isAuthenticated ? 'p-4 md:p-8' : ''} max-w-7xl mx-auto w-full h-full`}>
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
