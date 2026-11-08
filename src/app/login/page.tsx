import { redirect } from "next/navigation";

/** Bevar gamle bogmærker — forside er nu «Opret familie». */
export default function LoginLegacyRedirect() {
  redirect("/velkommen");
}
