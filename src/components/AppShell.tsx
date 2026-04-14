"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import BottomNav from "./BottomNav";

const PUBLIC_PATHS = ["/login", "/workshop-tilmelding"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { email, needsWorkshopRegistration, logout } = useAuth();
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (isPublic) return;
    if (!email) {
      router.replace("/login");
      return;
    }
    if (needsWorkshopRegistration) {
      router.replace("/workshop-tilmelding");
    }
  }, [isPublic, email, needsWorkshopRegistration, router]);

  if (isPublic) {
    return <>{children}</>;
  }

  if (!email) {
    return null;
  }

  if (needsWorkshopRegistration) {
    return null;
  }

  const displayName = email || "";

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-sm text-slate-600">{displayName}</span>
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="text-sm text-amber-600 hover:text-amber-700"
        >
          Log ud
        </button>
      </header>
      <div className="pb-20">{children}</div>
      <BottomNav />
    </>
  );
}
