"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";
import SupabaseSourceInfo from "./SupabaseSourceInfo";

const PUBLIC_PATHS = [
  "/velkommen",
  "/log-ind",
  "/login",
  "/betingelser",
  "/workshop-tilmelding",
  "/velkommen-til-app",
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { email, needsWorkshopRegistration, isAuthReady, isAdmin } = useAuth();
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (!isAuthReady || isPublic) return;
    if (!email) {
      router.replace("/velkommen");
      return;
    }
    if (
      !isAdmin &&
      needsWorkshopRegistration &&
      pathname !== "/workshop-tilmelding"
    ) {
      router.replace("/workshop-tilmelding");
    }
  }, [isAuthReady, isPublic, email, isAdmin, needsWorkshopRegistration, router, pathname]);

  if (isPublic) {
    return (
      <>
        <AppHeader />
        <div className="app-safe-x min-w-0">{children}</div>
        <SupabaseSourceInfo />
      </>
    );
  }

  if (!isAuthReady) {
    return null;
  }

  if (!email) {
    return null;
  }

  if (needsWorkshopRegistration && !isAdmin) {
    return null;
  }

  return (
    <>
      <AppHeader />
      <div className="app-safe-x min-w-0 pb-20">{children}</div>
      <SupabaseSourceInfo />
      <BottomNav />
    </>
  );
}
