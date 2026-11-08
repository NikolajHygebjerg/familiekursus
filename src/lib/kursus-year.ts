/** Aktivt familiekursus-år (deltager-/tilmeldingstabel). */
export const DEFAULT_KURSUS_YEAR = 2027;

export function getKursusYear(): number {
  const raw = process.env.KURSUS_YEAR?.trim();
  if (raw) {
    const year = parseInt(raw, 10);
    if (Number.isFinite(year) && year >= 2000 && year <= 2100) return year;
  }
  return DEFAULT_KURSUS_YEAR;
}
