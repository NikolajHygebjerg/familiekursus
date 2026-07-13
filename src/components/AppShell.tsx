"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import BottomNav from "./BottomNav";
import AddToHomeScreenGuide from "./AddToHomeScreenGuide";

const PUBLIC_PATHS = ["/login", "/workshop-tilmelding"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { email, needsWorkshopRegistration, logout, isAuthReady, isAdmin } = useAuth();
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (!isAuthReady || isPublic) return;
    if (!email) {
      router.replace("/login");
      return;
    }
    if (!isAdmin && needsWorkshopRegistration) {
      router.replace("/workshop-tilmelding");
    }
  }, [isAuthReady, isPublic, email, isAdmin, needsWorkshopRegistration, router]);

  if (isPublic) {
    return <>{children}</>;
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

  const displayName = email || "";

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Image
            src="/images/logo.jpg"
            alt="Familiekursus"
            width={32}
            height={32}
            className="shrink-0 rounded-lg"
          />
          <span className="truncate text-sm text-slate-600">{displayName}</span>
        </div>
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
      <AddToHomeScreenGuide />
      <div className="pb-20">{children}</div>
      <BottomNav />
    </>
  );
}
