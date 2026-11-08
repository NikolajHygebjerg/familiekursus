import type { WorkshopSlotKey } from "@/lib/airtable";

export type WorkshopCapacityUnit = "person" | "family";

export interface WorkshopCapacitySpec {
  max: number;
  unit: WorkshopCapacityUnit;
}

/** Fallback kapacitet fra kursusoversigt (bruges hvis Workshopoversigt mangler max). */
export const WORKSHOP_KAPACITET: Record<
  Exclude<WorkshopSlotKey, "voksen">,
  Record<string, WorkshopCapacitySpec>
> = {
  workshop1: {
    Keramik: { max: 30, unit: "person" },
    "T-shirt fabrikken 1": { max: 30, unit: "person" },
    Lasergames: { max: 30, unit: "person" },
    "Fra jord til bord": { max: 40, unit: "person" },
    "Lego Byg Amok": { max: 20, unit: "person" },
    Kageworkshop: { max: 50, unit: "person" },
    Træværksted: { max: 30, unit: "person" },
  },
  workshop2: {
    "Pimp din egen nøglering og taskevedhæng": { max: 30, unit: "person" },
    Adventurerace: { max: 50, unit: "person" },
    "T-shirtfabrikken 2": { max: 30, unit: "person" },
    Eksperimentariet: { max: 50, unit: "person" },
    Klatring: { max: 30, unit: "person" },
    Blomsterworkshop: { max: 30, unit: "person" },
    "Dans for sjov": { max: 20, unit: "person" },
    Batik: { max: 20, unit: "person" },
  },
  workshop3: {
    Smykker: { max: 30, unit: "person" },
    Rollespil: { max: 100, unit: "person" },
    Linoleum: { max: 25, unit: "person" },
    Maleri: { max: 35, unit: "person" },
    "Vildt! (snak og æd)": { max: 40, unit: "person" },
    "Tur til Økolariet og skovlegepladsen": { max: 100, unit: "person" },
  },
  workshop4: {
    Friluftsbadet: { max: 100, unit: "person" },
    Naturbingo: { max: 30, unit: "person" },
    Bolsjer: { max: 28, unit: "family" },
    "Miniplaneter - kreaværksted": { max: 30, unit: "person" },
    Fodbold: { max: 22, unit: "person" },
  },
};
