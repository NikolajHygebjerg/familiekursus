import { normalizeWorkshopName } from "@/lib/airtable";

export function lookupWorkshopLokation(
  workshopName: string,
  workshopLocations: Record<string, string>
): string | undefined {
  const trimmed = workshopName.trim();
  if (!trimmed) return undefined;
  return (
    workshopLocations[normalizeWorkshopName(trimmed)] ||
    workshopLocations[trimmed.toLowerCase()] ||
    undefined
  );
}

export function appendLokationToText(name: string, lokation?: string | null): string {
  const location = lokation?.trim();
  if (!location) return name;
  return `${name} (${location})`;
}
