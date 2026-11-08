export const POST_REGISTRATION_WELCOME_KEY = "familiekursus_post_registration_welcome";

export function markPostRegistrationWelcome(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(POST_REGISTRATION_WELCOME_KEY, "1");
}

export function consumePostRegistrationWelcome(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const ok = sessionStorage.getItem(POST_REGISTRATION_WELCOME_KEY) === "1";
  if (ok) sessionStorage.removeItem(POST_REGISTRATION_WELCOME_KEY);
  return ok;
}

export function peekPostRegistrationWelcome(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(POST_REGISTRATION_WELCOME_KEY) === "1";
}
