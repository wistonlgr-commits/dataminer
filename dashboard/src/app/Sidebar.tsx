"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlaySquare, Activity, Database } from "lucide-react";
import { useEffect, useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const [activeJobs, setActiveJobs] = useState(0);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch('/api/jobs');
        if (res.ok) {
          const jobs = await res.json();
          const running = jobs.filter((j: any) => j.status === 'running').length;
          setActiveJobs(running);
        }
      } catch (e) {}
    };
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { name: "Resumen", href: "/", icon: LayoutDashboard },
    { name: "Nueva Búsqueda", href: "/jobs", icon: PlaySquare },
    { name: "Monitorización", href: "/monitor", icon: Activity, badge: activeJobs },
  ];

  return (
    <>
      {/* Mobile Header (Only visible on small screens) */}
      <div className="md:hidden h-14 flex items-center justify-center bg-[#0A0E1A] border-b border-gray-800 shrink-0 shadow-sm z-10">
        <img src="https://vissionsolutions.com/wp-content/uploads/2024/12/moon-1.png" alt="Vission" className="w-6 h-6 mr-2 object-contain" />
        <span className="text-lg font-bold text-white tracking-tight">ScrapeFlow</span>
      </div>

      {/* Sidebar / Bottom Nav */}
      <aside className="fixed bottom-0 left-0 w-full bg-[#0A0E1A] border-t border-gray-800 flex flex-row md:relative md:flex-col md:w-64 md:border-t-0 md:border-r md:shadow-lg z-20">
        <div className="hidden md:flex h-20 items-center px-6 border-b border-gray-800">
          <img src="https://vissionsolutions.com/wp-content/uploads/2024/12/moon-1.png" alt="Vission Solutions" className="w-8 h-8 mr-3 object-contain filter drop-shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent tracking-tight">ScrapeFlow</span>
        </div>
        
        <nav className="flex-1 md:overflow-y-auto w-full md:py-6">
          <ul className="flex flex-row justify-around md:flex-col md:space-y-1.5 md:px-4 m-0 p-0 w-full h-16 md:h-auto items-center md:items-stretch">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <li key={item.name} className="flex-1 md:flex-none h-full md:h-auto">
                  <Link 
                    href={item.href} 
                    className={`flex flex-col md:flex-row items-center justify-center md:justify-between h-full px-2 py-1 md:px-4 md:py-3 text-[10px] md:text-sm font-medium transition-all ${
                      isActive 
                        ? "text-white md:bg-[#161B22] border-t-2 md:border-t-0 border-blue-500 md:border-l-2 md:border-blue-500 md:rounded-r-lg shadow-[inset_0_0_12px_rgba(37,99,235,0.1)]" 
                        : "text-gray-400 hover:text-white md:hover:bg-[#161B22] border-t-2 md:border-t-0 border-transparent md:border-l-2 md:rounded-r-lg"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row items-center gap-1 md:gap-0">
                      <item.icon className="w-5 h-5 md:mr-3" />
                      <span className="text-center">{item.name}</span>
                    </div>
                    {item.badge ? (
                      <span className={`flex items-center justify-center bg-blue-100 text-blue-700 text-[9px] md:text-xs font-bold md:font-semibold px-1.5 py-0.5 rounded-full animate-pulse absolute top-1 right-2 md:static md:right-auto md:top-auto md:gap-1.5`}>
                        <span className="hidden md:block w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        {item.badge} <span className="hidden md:inline">activa{item.badge !== 1 ? 's' : ''}</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
