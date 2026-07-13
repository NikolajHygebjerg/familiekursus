import { HOJSKOLESANGE } from "@/data/hojskolesange";
import { LEJRBALSSANGE } from "@/data/lejrbalssange";
import { SANGE } from "@/data/sange";

export type CastSongType = "text" | "pdf";

export interface CastSongData {
  id: string;
  type: CastSongType;
  title: string;
  subtitle?: string;
  stanzas?: string[][];
  page?: number;
}

const FAMILIEKURSUSSANGE: CastSongData[] = SANGE.map((song, index) => ({
  id: `familiekursus-${index + 1}`,
  type: "text",
  title: song.title,
  stanzas: song.stanzas,
}));

const LEJRBAL_CAST: CastSongData[] = LEJRBALSSANGE.map((song) => ({
  id: song.id,
  type: "text",
  title: song.title,
  subtitle: song.artist,
  stanzas: song.stanzas,
}));

const HOJSKOLE_CAST: CastSongData[] = HOJSKOLESANGE.map((song) => ({
  id: song.id,
  type: "pdf",
  title: song.title,
  page: song.page,
}));

const ALL_CAST_SONGS: CastSongData[] = [
  ...FAMILIEKURSUSSANGE,
  ...LEJRBAL_CAST,
  ...HOJSKOLE_CAST,
];

export function getCastSongById(id: string): CastSongData | null {
  return ALL_CAST_SONGS.find((song) => song.id === id) ?? null;
}
