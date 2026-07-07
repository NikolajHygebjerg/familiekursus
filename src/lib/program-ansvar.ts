export interface ProgramAnsvarlig {
  id: string;
  programKey: string;
  adminEmail: string;
  adminNavn: string;
  note: string;
  sortOrder: number;
}

export interface ProgramAnsvarDraft {
  adminEmail: string;
  adminNavn: string;
  note: string;
}

export interface AdminUserOption {
  email: string;
  navn: string;
}

export function buildProgramItemKey(
  dag: string,
  item: { tid?: string; titel: string }
): string {
  const dagPart = dag.trim().toLowerCase();
  const tidPart = (item.tid || "").trim().toLowerCase().replace(/\./g, ":");
  const titelPart = item.titel.trim().toLowerCase().replace(/\s+/g, " ");
  return `${dagPart}|${tidPart}|${titelPart}`;
}

function normalizePersonName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function personNameMatches(adminNavn: string, displayName: string): boolean {
  const adminNorm = normalizePersonName(adminNavn);
  const staffNorm = normalizePersonName(displayName);
  if (!adminNorm || !staffNorm) return false;
  if (adminNorm === staffNorm) return true;
  return (
    staffNorm.startsWith(`${adminNorm} `) ||
    staffNorm.startsWith(`${adminNorm}.`) ||
    adminNorm.startsWith(`${staffNorm} `) ||
    adminNorm.startsWith(`${staffNorm}.`)
  );
}

export function assignmentMatchesAdmin(
  assignment: Pick<ProgramAnsvarlig, "adminEmail" | "adminNavn">,
  email: string | null | undefined,
  adminNavn: string | null | undefined
): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail && assignment.adminEmail.trim().toLowerCase() === normalizedEmail) {
    return true;
  }
  if (!adminNavn?.trim() || !assignment.adminNavn.trim()) return false;
  return personNameMatches(adminNavn, assignment.adminNavn);
}

export function formatAnsvarligLine(
  assignment: Pick<ProgramAnsvarlig, "adminNavn" | "note">
): string {
  const note = assignment.note.trim();
  return note ? `${assignment.adminNavn.trim()} - ${note}` : assignment.adminNavn.trim();
}

export function groupAnsvarligeByKey(
  ansvarlige: ProgramAnsvarlig[]
): Record<string, ProgramAnsvarlig[]> {
  const grouped: Record<string, ProgramAnsvarlig[]> = {};
  for (const entry of ansvarlige) {
    const list = grouped[entry.programKey] || [];
    list.push(entry);
    grouped[entry.programKey] = list;
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.sortOrder - b.sortOrder || a.adminNavn.localeCompare(b.adminNavn, "da"));
  }
  return grouped;
}

export function getVisibleAnsvarLines(
  assignments: ProgramAnsvarlig[],
  options: {
    isSuperAdmin: boolean;
    email: string | null | undefined;
    adminNavn: string | null | undefined;
  }
): string[] {
  if (options.isSuperAdmin) {
    return assignments.map(formatAnsvarligLine);
  }

  return assignments
    .filter((assignment) =>
      assignmentMatchesAdmin(assignment, options.email, options.adminNavn)
    )
    .map(formatAnsvarligLine);
}
