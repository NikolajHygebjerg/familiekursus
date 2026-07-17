import { getBrugerByEmail, emailExistsIn2026 } from "@/lib/airtable";

export async function canAccessBilledupload(email: string): Promise<boolean> {
  const bruger = await getBrugerByEmail(email);
  if (bruger?.isAdmin) return true;
  return emailExistsIn2026(email);
}
