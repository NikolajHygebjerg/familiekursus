export const POST_REGISTRATION_WELCOME_KEY = "familiekursus_post_registration_welcome";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

/** Efter workshop-tilmelding — gemmes i både session og localStorage (mere robust på mobil). */
export function markPostRegistrationWelcome(): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(POST_REGISTRATION_WELCOME_KEY, "1");
    localStorage.setItem(POST_REGISTRATION_WELCOME_KEY, "1");
  } catch {
    // Privat browsing / storage fuld
  }
}

export function consumePostRegistrationWelcome(): boolean {
  if (!canUseStorage()) return false;
  const ok =
    sessionStorage.getItem(POST_REGISTRATION_WELCOME_KEY) === "1" ||
    localStorage.getItem(POST_REGISTRATION_WELCOME_KEY) === "1";
  if (ok) {
    try {
      sessionStorage.removeItem(POST_REGISTRATION_WELCOME_KEY);
      localStorage.removeItem(POST_REGISTRATION_WELCOME_KEY);
    } catch {
      // ignore
    }
  }
  return ok;
}

export function peekPostRegistrationWelcome(): boolean {
  if (!canUseStorage()) return false;
  try {
    return (
      sessionStorage.getItem(POST_REGISTRATION_WELCOME_KEY) === "1" ||
      localStorage.getItem(POST_REGISTRATION_WELCOME_KEY) === "1"
    );
  } catch {
    return false;
  }
}
