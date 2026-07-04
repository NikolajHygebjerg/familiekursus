"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import MeetUsIcon from "@/components/MeetUsIcon";
import type { ReactNode } from "react";

const BASE_NAV_ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/program", label: "Program", icon: "📅" },
  { href: "/mod-os", label: "Mød os", icon: <MeetUsIcon className="h-6 w-6" /> },
  { href: "/tilmeldte", label: "Dine workshops", icon: "✅" },
  { href: "/", label: "Workshopoversigt", icon: "📊" },
  { href: "/tilmeld", label: "Tilmeld", icon: "📝" },
];

const ADMIN_NAV_ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/familieloeb", label: "Familieløbet", icon: "🏃" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const navItems = isAdmin ? [...BASE_NAV_ITEMS, ...ADMIN_NAV_ITEMS] : BASE_NAV_ITEMS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="mx-auto flex max-w-6xl items-center justify-around">
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 px-0.5 py-2.5 text-xs transition-colors sm:text-sm ${
                isActive ? "text-amber-600 font-semibold" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="flex h-6 items-center justify-center text-lg">{icon}</span>
              <span className="text-center leading-tight">{label}</span>
              {isActive && <span className="h-0.5 w-12 rounded-full bg-amber-500" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
