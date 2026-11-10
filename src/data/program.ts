// Ugeprogram 2027 (Familiekursus) — kilde: program-PDF
// Dagens program: familiens valgte workshops vises under punkter med workshopSlot

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

const WORKSHOP1_LIST =
  "Keramik · T-shirt fabrikken 1 · Lasergames · Fra jord til bord · Lego Byg Amok · Kageworkshop · Træværksted";
const WORKSHOP2_LIST =
  "Pimp din egen nøglering og taskevedhæng · Adventurerace · T-shirt fabrikken 2 · Eksperimentariet · Klatring · Blomsterworkshop · Dans for sjov · Batik";
const WORKSHOP3_LIST =
  "Smykker · Rollespil · Linoleum · Maleri · Fra fasan til flammer · Tur til Økolariet og skovlegepladsen";
const WORKSHOP4_LIST =
  "Friluftsbadet · Natursafari · Bolsjer · Miniplaneter – kreaværksted · Fodbold";

function eveningWindDown(): ProgramItem[] {
  return [
    { tid: "20:30", titel: "Aftenkaffe" },
    { tid: "20:30", titel: "Tidlig godnathistorie" },
    { tid: "21:00", titel: "Sen godnathistorie" },
  ];
}

function morningBlock(): ProgramItem[] {
  return [
    { tid: "07:15-08:15", titel: "Morgenmad" },
    { tid: "08:30", titel: "Morgensamling" },
  ];
}

export const UGEPROGRAM: DagProgram[] = [
  {
    dag: "Mandag",
    dato: "16/7",
    program: [
      { tid: "14:00", titel: "Ankomst" },
      { tid: "16:00", titel: "Velkomst og rundvisning" },
      { tid: "17:30-18:45", titel: "Aftensmad" },
      { tid: "19:00", titel: "Velkomstlege sammen i familierne" },
      {
        tid: "19:00-22:00",
        titel: "Teenagere i egen gruppe",
        beskrivelse: "Teenagere samles i egen gruppe (parallelt med familiens velkomstlege).",
      },
    ],
  },
  {
    dag: "Tirsdag",
    dato: "17/7",
    program: [
      ...morningBlock(),
      {
        tid: "09:30-11:45",
        titel: "Børn i aldersgrupper",
        aldersgrupperItem: true,
        beskrivelse:
          "3–5 år: Hulehygge · 6 år: Bille Zoo · 7 år: Kreaworkshop · 8 år: Natursafari · 9 år: Skattejagt / Natursafari · 10–11 år: Battle / Krea · 11–12 år: Battle · 13+: Eget program",
      },
      {
        tid: "09:45-11:30",
        titel: "Drømmeworkshop",
        workshopSlot: "voksen",
        beskrivelse: "Forældreworkshop",
      },
      { tid: "12:00-13:30", titel: "Frokost" },
      { tid: "14:00-16:00", titel: "Det store familieløb" },
      { tid: "17:30-18:45", titel: "Aftensmad" },
      { tid: "19:00", titel: "Smuglerløb: Ugens adrenalinpumpende højdepunkt!" },
      ...eveningWindDown(),
    ],
  },
  {
    dag: "Onsdag",
    dato: "18/7",
    program: [
      ...morningBlock(),
      {
        tid: "09:30-11:45",
        titel: "Workshop 1",
        workshopSlot: "workshop1",
        beskrivelse: WORKSHOP1_LIST,
      },
      { tid: "12:00-13:30", titel: "Frokost" },
      {
        tid: "14:00-16:00",
        titel: "Workshop 2",
        workshopSlot: "workshop2",
        beskrivelse: `Fortsætter til 16.00. ${WORKSHOP2_LIST}`,
      },
      { tid: "17:30-18:45", titel: "Aftensmad" },
      { tid: "19:00", titel: "Den stor versusquiz for hele familien" },
      ...eveningWindDown(),
    ],
  },
  {
    dag: "Torsdag",
    dato: "19/7",
    program: [
      ...morningBlock(),
      {
        tid: "09:30-11:45",
        titel: "Workshop 2",
        workshopSlot: "workshop2",
        beskrivelse: WORKSHOP2_LIST,
      },
      { tid: "12:00-13:30", titel: "Frokost" },
      { tid: "14:00-16:00", titel: "Fri eftermiddag" },
      { tid: "17:30-18:45", titel: "Aftensmad" },
      {
        tid: "19:00",
        titel: "Bålaften i parken",
        beskrivelse: "Pandekager, snobrød, popcorn og lejrbålshygge.",
      },
      {
        tid: "20:30",
        titel: "Sheltertur for 13+",
        workshopSlot: "sheltertur",
        beskrivelse: "Med overnatning.",
      },
      { tid: "20:30", titel: "Aftenkaffe" },
      { tid: "20:30", titel: "Tidlig godnathistorie" },
      { tid: "21:00", titel: "Sen godnathistorie" },
    ],
  },
  {
    dag: "Fredag",
    dato: "20/7",
    program: [
      ...morningBlock(),
      {
        tid: "09:30-11:45",
        titel: "Workshop 3",
        workshopSlot: "workshop3",
        beskrivelse: WORKSHOP3_LIST,
      },
      { tid: "12:00-13:30", titel: "Frokost" },
      {
        tid: "14:00-16:00",
        titel: "Workshop 3",
        workshopSlot: "workshop3",
        beskrivelse: `Fortsætter til 16.00. ${WORKSHOP3_LIST}`,
      },
      { tid: "17:30-18:45", titel: "Aftensmad" },
      {
        tid: "19:00",
        titel: "Sommerbio og debat",
        beskrivelse: "Børn: Sommerbio. Forældre: Debatarrangement.",
      },
      ...eveningWindDown(),
      { tid: "22:00", titel: "Gyserløb", workshopSlot: "gyserløb" },
    ],
  },
  {
    dag: "Lørdag",
    dato: "21/7",
    program: [
      ...morningBlock(),
      {
        tid: "09:30-11:45",
        titel: "Workshop 4",
        workshopSlot: "workshop4",
        beskrivelse: WORKSHOP4_LIST,
      },
      { tid: "12:00-13:30", titel: "Frokost" },
      { tid: "14:00-16:00", titel: "Sommeraktiviteter med de største is" },
      { tid: "17:30-18:45", titel: "Aftensmad" },
      { tid: "19:00", titel: "Festaften for alle aldre med liveband" },
      ...eveningWindDown(),
    ],
  },
  {
    dag: "Søndag",
    dato: "22/7",
    program: [
      { tid: "08:30-09:00", titel: "Pakning af biler" },
      { tid: "09:00", titel: "Værelserne skal være forladt" },
      { tid: "09:00-09:30", titel: "Morgensamling med fælles farvel" },
      { tid: "09:30-10:30", titel: "Vi hjælper hinanden med at rydde op – farvel!" },
    ],
  },
];

export const VOKSENCAFE_BY_DAY: Record<string, string> = {
  Mandag: "Voksencafé - med icebreaking",
  Tirsdag: "Voksencafé - med højskolesang",
  Onsdag: "Voksencafé - med ølsmagning (Jelling bryghus)",
  Torsdag: "Voksencafé - med højskolesang",
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
