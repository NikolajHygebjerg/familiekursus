import { createClient } from "@supabase/supabase-js";
import ws from "ws";

function cleanEnv(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function resolveSupabaseUrl(): string | null {
  const raw =
    cleanEnv(process.env.SUPABASE_URL) ||
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).origin;
    } catch {
      return null;
    }
  }
  if (/^[a-z0-9-]+\.supabase\.co$/i.test(raw)) {
    return `https://${raw}`;
  }
  return null;
}

function resolveSupabaseServiceKey(): string | null {
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return key.length > 0 ? key : null;
}

export function getSupabaseConfigError(): string | null {
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseServiceKey();
  if (!url && !key) {
    return "Supabase er ikke konfigureret (mangler SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY på serveren).";
  }
  if (!url) {
    return "Supabase-URL mangler eller er ugyldig. Sæt SUPABASE_URL til fx https://xxxx.supabase.co i Vercel.";
  }
  if (!key) {
    return "Supabase service-nøgle mangler. Sæt SUPABASE_SERVICE_ROLE_KEY i Vercel.";
  }
  if (key.startsWith("sb_publishable_")) {
    return "SUPABASE_SERVICE_ROLE_KEY skal være secret/service-nøglen, ikke publishable-nøglen.";
  }
  return null;
}

/**
 * Server-only Supabase client (service role).
 * Omgår RLS — importer aldrig i klientkomponenter.
 */
export function createAdminClient() {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }
  const url = resolveSupabaseUrl()!;
  const key = resolveSupabaseServiceKey()!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          headers: {
            ...(init?.headers ?? {}),
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        }),
    },
  });
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigError() === null;
}

/** Projektreference fra URL (fx zngchdmlxefxvdayiwbu) — til at afstemme Vercel vs lokal .env. */
export function getSupabaseProjectRef(): string | null {
  const url = resolveSupabaseUrl();
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

/** Offentlig vært (fx zngchdmlxefxvdayiwbu.supabase.co) — ingen hemmeligheder. */
export function getSupabasePublicHost(): string | null {
  const url = resolveSupabaseUrl();
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
