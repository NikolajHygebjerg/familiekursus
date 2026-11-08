"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";
import AddToHomeScreenGuide from "./AddToHomeScreenGuide";
import SupabaseSourceInfo from "./SupabaseSourceInfo";

const PUBLIC_PATHS = ["/login", "/workshop-tilmelding"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { email, needsWorkshopRegistration, isAuthReady, isAdmin } = useAuth();
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (!isAuthReady || isPublic) return;
    if (!email) {
      router.replace("/login");
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
        {children}
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
      <AddToHomeScreenGuide />
      <div className="pb-20">{children}</div>
      <SupabaseSourceInfo />
      <BottomNav />
    </>
  );
}
