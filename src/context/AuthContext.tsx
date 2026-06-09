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
  isAuthReady: boolean;
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

function readStoredAuth(): AuthState {
  const empty: AuthState = {
    email: null,
    familyName: null,
    isAdmin: false,
    adminNavn: null,
    needsWorkshopRegistration: false,
  };

  if (typeof window === "undefined") return empty;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return empty;
    const parsed = JSON.parse(stored);
    return {
      email: parsed.email ?? null,
      familyName: parsed.familyName ?? null,
      isAdmin: parsed.isAdmin ?? false,
      adminNavn: parsed.adminNavn ?? null,
      needsWorkshopRegistration: parsed.needsWorkshopRegistration ?? false,
    };
  } catch {
    return empty;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>(() => readStoredAuth());
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    setAuthState(readStoredAuth());
    setIsAuthReady(true);
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
        isAuthReady,
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
