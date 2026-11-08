"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/** Fast topbjælke med log ud — bruges på alle indloggede skærme. */
export default function AppHeader() {
  const router = useRouter();
  const { email, familyName, logout, isAdmin, isAuthReady } = useAuth();

  if (!isAuthReady || !email) return null;

  const displayName = isAdmin ? "Kursusleder" : familyName || email;

  return (
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
        type="button"
        onClick={() => {
          logout();
          router.push("/login");
        }}
        className="shrink-0 text-sm font-medium text-amber-600 hover:text-amber-700"
      >
        Log ud
      </button>
    </header>
  );
}
