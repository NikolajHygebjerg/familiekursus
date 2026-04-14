"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";

const KURSUSLEDER = "Kursusleder";

interface FamilyContextType {
  selectedFamily: string | null;
  setSelectedFamily: (family: string | null) => void;
  isKursusleder: boolean;
  clearFamily: () => void;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { email, isAdmin, logout } = useAuth();

  const selectedFamily = email ? (isAdmin ? KURSUSLEDER : email) : null;
  const isKursusleder = isAdmin;

  const setSelectedFamily = useCallback(() => {
    // No-op: family is derived from auth
  }, []);

  const clearFamily = useCallback(() => {
    logout();
  }, [logout]);

  return (
    <FamilyContext.Provider
      value={{
        selectedFamily,
        setSelectedFamily,
        isKursusleder,
        clearFamily,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within FamilyProvider");
  return ctx;
}

export { KURSUSLEDER };
