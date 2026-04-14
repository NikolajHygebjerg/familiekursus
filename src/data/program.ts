// Rediger dette med programmet fra din PDF
// Ugeprogram: liste over dagene
// Dagens program: bruger samme struktur men viser kun familiens workshops under workshop-slots

export interface ProgramItem {
  tid?: string;
  titel: string;
  beskrivelse?: string;
  workshopSlot?: "workshop1" | "workshop2" | "workshop3" | "workshop4" | "voksen" | "aftengrupper" | "gyserløb" | "sheltertur"; // Hvis sat, vises tilmeldte i "Dagens program"
}

export interface DagProgram {
  dag: string;
  dato?: string;
  program: ProgramItem[];
}

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
    ],
  },
];
