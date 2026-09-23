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
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <Database className="w-6 h-6 text-indigo-600 mr-2" />
        <span className="text-xl font-bold text-slate-800 tracking-tight">ScrapeFlow</span>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-6">
        <ul className="space-y-1.5 px-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <li key={item.name}>
                <Link 
                  href={item.href} 
                  className={`flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    isActive 
                      ? "bg-indigo-50 text-indigo-700" 
                      : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                  }`}
                >
                  <div className="flex items-center">
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </div>
                  {item.badge ? (
                    <span className="flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      {item.badge} activa{item.badge !== 1 ? 's' : ''}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
