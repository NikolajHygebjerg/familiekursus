"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NavIcon, { type NavIconName } from "@/components/NavIcons";

interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  adminOnly?: boolean;
  userOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/program", label: "Program", icon: "program" },
  { href: "/mod-os", label: "Mød os", icon: "meetUs" },
  { href: "/sange", label: "Sange", icon: "songs" },
  { href: "/evaluering", label: "Evaluering", icon: "evaluation" },
  { href: "/tilmeldte", label: "Dine workshops", icon: "myWorkshops" },
  { href: "/", label: "Workshops", icon: "workshops", adminOnly: true },
  { href: "/tilmeld", label: "Tilmeld", icon: "register", userOnly: true },
  { href: "/familieloeb", label: "Familieløbet", icon: "race", adminOnly: true },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const navItems = NAV_ITEMS.filter(
    (item) => !(item.adminOnly && !isAdmin) && !(item.userOnly && isAdmin)
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-stretch justify-around">
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2.5 text-[11px] transition-colors sm:text-xs ${
                isActive
                  ? "font-semibold text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <NavIcon
                name={icon}
                className={`h-6 w-6 shrink-0 ${isActive ? "text-slate-900" : "text-slate-400"}`}
              />
              <span className="max-w-full truncate text-center leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
