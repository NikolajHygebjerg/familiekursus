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
const ADMIN_EMAIL = "nh@brandbjerg.dk";
const ADMIN_CODE = "Design86930881";
const DEFAULT_CODE = "1234";

export const KURSUSLEDER = "Kursusleder";

interface AuthState {
  email: string | null;
  familyName: string | null;
  isAdmin: boolean;
  needsWorkshopRegistration: boolean;
}

interface AuthContextType extends AuthState {
  setAuth: (email: string, familyName: string | null, needsWorkshopRegistration: boolean) => void;
  logout: () => void;
  isKursusleder: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>({
    email: null,
    familyName: null,
    isAdmin: false,
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
          needsWorkshopRegistration: parsed.needsWorkshopRegistration ?? false,
        });
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const setAuth = useCallback(
    (email: string, familyName: string | null, needsWorkshopRegistration: boolean) => {
      const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const state: AuthState = {
        email,
        familyName: isAdmin ? KURSUSLEDER : familyName,
        isAdmin,
        needsWorkshopRegistration,
      };
      setAuthState(state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    []
  );

  const logout = useCallback(() => {
    setAuthState({
      email: null,
      familyName: null,
      isAdmin: false,
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

export { ADMIN_EMAIL, ADMIN_CODE, DEFAULT_CODE };
