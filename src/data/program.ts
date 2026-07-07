// Rediger dette med programmet fra din PDF
// Ugeprogram: liste over dagene
// Dagens program: bruger samme struktur men viser kun familiens workshops under workshop-slots

export interface ProgramItem {
  tid?: string;
  titel: string;
  lokation?: string;
  beskrivelse?: string;
  workshopSlot?: "workshop1" | "workshop2" | "workshop3" | "workshop4" | "voksen" | "aftengrupper" | "gyserløb" | "sheltertur";
  aldersgrupperItem?: boolean;
}

export interface DagProgram {
  dag: string;
  dato?: string;
  program: ProgramItem[];
}

export const VOKSENCAFE_TID = "21:30";

export const UGEPROGRAM: DagProgram[] = [
  {
    dag: "Mandag",
    dato: "Dag 1",
    program: [
      { tid: "09:00", titel: "Velkomst og introduktion" },
      { tid: "10:00", titel: "Workshop 1", workshopSlot: "workshop1" },
      { tid: "12:00", titel: "Frokost" },
      { tid: "13:00", titel: "Workshop 2", workshopSlot: "workshop2" },
      { tid: "15:00", titel: "Fælles afslutning" },
      { tid: VOKSENCAFE_TID, titel: "Voksencafé - lær hinanden at kende" },
    ],
  },
  {
    dag: "Tirsdag",
    dato: "Dag 2",
    program: [
      { tid: "09:00", titel: "Morgenaktivitet" },
      { tid: "10:00", titel: "Workshop 3", workshopSlot: "workshop3" },
      { tid: "12:00", titel: "Frokost" },
      { tid: "13:00", titel: "Workshop 4", workshopSlot: "workshop4" },
      { tid: "15:00", titel: "Workshop Forældre", workshopSlot: "voksen" },
      { tid: VOKSENCAFE_TID, titel: "Voksencafé - med højskolesang" },
    ],
  },
  {
    dag: "Onsdag",
    dato: "Dag 3",
    program: [
      { tid: "09:00", titel: "Aktiviteter" },
      { tid: "12:00", titel: "Frokost" },
      { tid: "13:00", titel: "Aftengrupper", workshopSlot: "aftengrupper" },
      { tid: "19:00", titel: "Gyserløb", workshopSlot: "gyserløb" },
      { tid: "20:00", titel: "Sheltertur", workshopSlot: "sheltertur" },
      { tid: "21:00", titel: "Afslutning" },
      { tid: VOKSENCAFE_TID, titel: "Voksencafé - med øl-aften" },
    ],
  },
];

export const VOKSENCAFE_BY_DAY: Record<string, string> = {
  Mandag: "Voksencafé - lær hinanden at kende",
  Tirsdag: "Voksencafé - med højskolesang",
  Onsdag: "Voksencafé - med øl-aften",
  Fredag: "Voksencafé - med Højskolesang",
};

function hasVoksencafeItem(program: ProgramItem[]): boolean {
  return program.some((item) => item.titel.toLowerCase().includes("voksencaf"));
}

function sortProgramByTime(program: ProgramItem[]): ProgramItem[] {
  const toMinutes = (tid: string) => {
    const match = tid.replace(/\./g, ":").match(/^(\d{1,2})[.:]?(\d{2})?/);
    if (!match) return Number.MAX_SAFE_INTEGER;
    const hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    return hours * 60 + minutes;
  };

  return [...program].sort(
    (a, b) => toMinutes(a.tid || "") - toMinutes(b.tid || "") || a.titel.localeCompare(b.titel, "da")
  );
}

export function appendVoksencafeProgram<T extends { dag: string; program: ProgramItem[] }>(
  days: T[]
): T[] {
  return days.map((day) => {
    const cafeTitel = VOKSENCAFE_BY_DAY[day.dag];
    const program = day.program.map((item) =>
      item.titel.toLowerCase().includes("voksencaf") && !item.tid
        ? { ...item, tid: VOKSENCAFE_TID }
        : item
    );
    if (!cafeTitel || hasVoksencafeItem(program)) {
      return { ...day, program: sortProgramByTime(program) };
    }
    return {
      ...day,
      program: sortProgramByTime([...program, { tid: VOKSENCAFE_TID, titel: cafeTitel }]),
    };
  });
}
