export interface ChordPlacement {
  chord: string;
  column: number;
}

export interface SongLine {
  id: string;
  lyrics: string;
  chords: ChordPlacement[];
  isInstrumental?: boolean;
  isTablature?: boolean;
  tabLines?: string[];
}

export interface SongSection {
  id: string;
  name: string;
  lines: SongLine[];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  originalKey: string;
  bpm: number;
  language: "es" | "en";
  source: "pdf" | "lacuerda" | "sample";
  createdAt: string;
  sections: SongSection[];
}

export interface FlatSongLine {
  globalIndex: number;
  sectionId: string;
  sectionName: string;
  line: SongLine;
}

export type InstrumentProfile =
  | "acoustic_guitar"
  | "electric_guitar"
  | "piano"
  | "vocals_only";

export type TrackingMode =
  | "voice_local"
  | "vocal_cadence"
  | "voice_ai"
  | "auto_tempo";

export type NotationSystem = "american" | "latin";

export type StageDisplayMode = "chords_tabs" | "lyrics_only";

export type AppView = "stage" | "calibrate";
