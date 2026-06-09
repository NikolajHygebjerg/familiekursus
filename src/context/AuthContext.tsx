"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "familiekursus_auth";

export const KURSUSLEDER = "Kursusleder";

interface AuthState {
  email: string | null;
  familyName: string | null;
  isAdmin: boolean;
  adminNavn: string | null;
  needsWorkshopRegistration: boolean;
}

interface AuthContextType extends AuthState {
  setAuth: (
    email: string,
    familyName: string | null,
    needsWorkshopRegistration: boolean,
    isAdmin?: boolean,
    adminNavn?: string | null
  ) => void;
  logout: () => void;
  isKursusleder: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>({
    email: null,
    familyName: null,
    isAdmin: false,
    adminNavn: null,
    needsWorkshopRegistration: false,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setAuthState({
          email: parsed.email ?? null,
          familyName: parsed.familyName ?? null,
          isAdmin: parsed.isAdmin ?? false,
          adminNavn: parsed.adminNavn ?? null,
          needsWorkshopRegistration: parsed.needsWorkshopRegistration ?? false,
        });
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const setAuth = useCallback(
    (
      email: string,
      familyName: string | null,
      needsWorkshopRegistration: boolean,
      isAdmin?: boolean,
      adminNavn?: string | null
    ) => {
      setAuthState((prev) => {
        const admin = isAdmin ?? prev.isAdmin;
        const state: AuthState = {
          email,
          familyName: admin ? KURSUSLEDER : familyName,
          isAdmin: admin,
          adminNavn: admin ? (adminNavn ?? prev.adminNavn ?? null) : null,
          needsWorkshopRegistration: admin ? false : needsWorkshopRegistration,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return state;
      });
    },
    []
  );

  const logout = useCallback(() => {
    setAuthState({
      email: null,
      familyName: null,
      isAdmin: false,
      adminNavn: null,
      needsWorkshopRegistration: false,
    });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isKursusleder = auth.familyName === KURSUSLEDER;

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        setAuth,
        logout,
        isKursusleder,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
