import {
  ChordPlacement,
  FlatSongLine,
  NotationSystem,
  Song,
  SongLine,
  SongSection,
} from "../types/song";

const NOTES_SHARP = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const NOTES_FLAT = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

const LATIN_ROOTS: Record<string, string> = {
  Do: "C",
  Re: "D",
  Mi: "E",
  Fa: "F",
  Sol: "G",
  La: "A",
  Si: "B",
};

const AMERICAN_TO_LATIN: Record<string, string> = {
  C: "Do",
  D: "Re",
  E: "Mi",
  F: "Fa",
  G: "Sol",
  A: "La",
  B: "Si",
};

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

function normalizeLatinTokenToAmerican(token: string): string {
  const match = token.match(
    /^(Do|Re|Mi|Fa|Sol|La|Si)([#b]?)(.*)$/i
  );
  if (!match) return token;
  const [, latinRaw, accidental, suffix] = match;
  const latinKey =
    latinRaw.charAt(0).toUpperCase() + latinRaw.slice(1).toLowerCase();
  const root = LATIN_ROOTS[latinKey];
  if (!root) return token;
  return `${root}${accidental}${suffix}`;
}

function transposeSingleNote(
  note: string,
  semitones: number,
  preferFlats: boolean
): string {
  const idx = NOTE_TO_SEMITONE[note];
  if (idx === undefined) return note;
  const shifted = ((idx + semitones) % 12 + 12) % 12;
  return preferFlats ? NOTES_FLAT[shifted] : NOTES_SHARP[shifted];
}

export function transposeChord(
  chordRaw: string,
  semitones: number,
  notation: NotationSystem = "american"
): string {
  const americanChord = normalizeLatinTokenToAmerican(chordRaw.trim());

  const parts = americanChord.split("/");
  const transposedParts = parts.map((part) => {
    const match = part.match(/^([A-G])([#b]?)(.*)$/);
    if (!match) return part;
    const [, letter, accidental, rest] = match;
    const baseNote = `${letter}${accidental}`;
    const preferFlats = accidental === "b";
    const newNote =
      semitones === 0
        ? baseNote
        : transposeSingleNote(baseNote, semitones, preferFlats);

    if (notation === "latin") {
      const rootLetter = newNote.charAt(0);
      const rootAcc = newNote.slice(1);
      const latinName = AMERICAN_TO_LATIN[rootLetter] || rootLetter;
      return `${latinName}${rootAcc}${rest}`;
    }

    return `${newNote}${rest}`;
  });

  return transposedParts.join("/");
}

export function formatKeyName(
  keyRaw: string,
  semitones: number,
  notation: NotationSystem
): string {
  return transposeChord(keyRaw || "C", semitones, notation);
}

export function getCapoHint(semitones: number): string | null {
  if (semitones === 0) return null;
  // Positive transposition (+N semitones) can be played with original shapes + Capo on fret N
  if (semitones > 0 && semitones <= 7) {
    return `Capo traste ${semitones} (formas originales)`;
  }
  const capoDown = ((semitones % 12) + 12) % 12;
  if (capoDown > 0 && capoDown <= 7) {
    return `Capo traste ${capoDown} (formas originales)`;
  }
  return null;
}

export function getScaleOptions(
  originalKey: string,
  notation: NotationSystem
): { semitones: number; label: string }[] {
  const options: { semitones: number; label: string }[] = [];
  for (let s = -6; s <= 6; s++) {
    const keyLabel = formatKeyName(originalKey, s, notation);
    const offsetStr = s === 0 ? "Original" : s > 0 ? `+${s}` : `${s}`;
    options.push({
      semitones: s,
      label: `${keyLabel} (${offsetStr})`,
    });
  }
  return options;
}

const CHORD_TOKEN_REGEX =
  /^(Do|Re|Mi|Fa|Sol|La|Si|[A-G])([#b]?)(m|min|maj|dim|aug|sus|add)?([0-9]{0,2})(\/[A-G|Do|Re|Mi|Fa|Sol|La|Si][#b]?)?$/i;

export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\[.*\]$/.test(trimmed)) return false;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  for (const token of tokens) {
    const clean = token.replace(/[()|,]/g, "");
    if (!clean) continue;
    if (CHORD_TOKEN_REGEX.test(clean)) {
      chordCount++;
    } else if (/^[xX][0-9]+$/.test(clean) || clean === "%" || clean === "/") {
      // Repeat markers like x2 or bar separators
      continue;
    } else {
      return false;
    }
  }
  return chordCount > 0;
}

export function extractChordsFromLine(chordLine: string): ChordPlacement[] {
  const placements: ChordPlacement[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(chordLine)) !== null) {
    const token = match[0].replace(/[()|]/g, "");
    if (CHORD_TOKEN_REGEX.test(token)) {
      placements.push({
        chord: normalizeLatinTokenToAmerican(token),
        column: match.index,
      });
    }
  }
  return placements;
}

function parseInlineBracketChords(line: string): {
  lyrics: string;
  chords: ChordPlacement[];
} {
  const chords: ChordPlacement[] = [];
  let lyrics = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] === "[") {
      const closeIdx = line.indexOf("]", i);
      if (closeIdx !== -1) {
        const inner = line.slice(i + 1, closeIdx).trim();
        if (CHORD_TOKEN_REGEX.test(inner)) {
          chords.push({
            chord: normalizeLatinTokenToAmerican(inner),
            column: lyrics.length,
          });
          i = closeIdx + 1;
          continue;
        }
      }
    }
    lyrics += line[i];
    i++;
  }
  return { lyrics, chords };
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function parseLaCuerdaText(
  rawText: string,
  meta?: { title?: string; artist?: string; originalKey?: string; bpm?: number }
): Song {
  const rawLines = rawText.replace(/\r\n/g, "\n").split("\n");
  const sections: SongSection[] = [];
  let currentSection: SongSection = {
    id: makeId("sec"),
    name: "Verso 1",
    lines: [],
  };

  let detectedTitle = meta?.title?.trim() || "";
  let detectedArtist = meta?.artist?.trim() || "";

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Detect "Título - Artista" on first non-chord line if not provided
    if (
      i === 0 &&
      !detectedTitle &&
      !isChordLine(trimmed) &&
      !/^\[/.test(trimmed) &&
      trimmed.includes(" - ")
    ) {
      const [t, a] = trimmed.split(" - ");
      detectedTitle = t.trim();
      detectedArtist = a.trim();
      i++;
      continue;
    }

    // Section header: [Coro], [Intro], CORO:, Verso 1:
    const bracketSectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    const colonSectionMatch = trimmed.match(
      /^(intro|verso\s*\d*|estrofa\s*\d*|coro|estribillo|puente|pre-coro|solo|interludio|final|outro)\s*:?$/i
    );

    if (bracketSectionMatch || colonSectionMatch) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      const sectionName = (
        bracketSectionMatch?.[1] ||
        colonSectionMatch?.[1] ||
        "Sección"
      ).trim();
      currentSection = {
        id: makeId("sec"),
        name: sectionName.charAt(0).toUpperCase() + sectionName.slice(1),
        lines: [],
      };
      i++;
      continue;
    }

    // Check if inline bracket format like "[G]Canta y no [D7]llores"
    if (/\[[A-G|Do|Re|Mi|Fa|Sol|La|Si]/.test(line)) {
      const { lyrics, chords } = parseInlineBracketChords(line);
      currentSection.lines.push({
        id: makeId("line"),
        lyrics,
        chords,
        isInstrumental: lyrics.trim().length === 0,
      });
      i++;
      continue;
    }

    // Standard two-line LaCuerda format: chord line followed by lyric line
    if (isChordLine(line)) {
      const chords = extractChordsFromLine(line);
      const nextLine = i + 1 < rawLines.length ? rawLines[i + 1] : "";
      const nextTrimmed = nextLine.trim();

      if (
        nextTrimmed &&
        !isChordLine(nextLine) &&
        !/^\[([^\]]+)\]$/.test(nextTrimmed)
      ) {
        currentSection.lines.push({
          id: makeId("line"),
          lyrics: nextLine,
          chords,
          isInstrumental: false,
        });
        i += 2;
        continue;
      } else {
        currentSection.lines.push({
          id: makeId("line"),
          lyrics: "",
          chords,
          isInstrumental: true,
        });
        i++;
        continue;
      }
    }

    // Plain lyric line without chords above
    currentSection.lines.push({
      id: makeId("line"),
      lyrics: line,
      chords: [],
      isInstrumental: false,
    });
    i++;
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  // Fallback first chord as key
  let inferredKey = meta?.originalKey?.trim() || "";
  if (!inferredKey) {
    for (const sec of sections) {
      for (const l of sec.lines) {
        if (l.chords.length > 0) {
          inferredKey = l.chords[0].chord;
          break;
        }
      }
      if (inferredKey) break;
    }
  }

  return {
    id: makeId("song"),
    title: detectedTitle || "Canción importada",
    artist: detectedArtist || "Repertorio personal",
    originalKey: inferredKey || "C",
    bpm: meta?.bpm || 100,
    language: "es",
    source: "lacuerda",
    createdAt: new Date().toISOString(),
    sections:
      sections.length > 0
        ? sections
        : [
            {
              id: makeId("sec"),
              name: "Letra",
              lines: [
                {
                  id: makeId("line"),
                  lyrics: rawText.trim() || "Sin letra",
                  chords: [],
                },
              ],
            },
          ],
  };
}

export function buildChordLineString(
  chords: ChordPlacement[],
  semitones: number,
  notation: NotationSystem
): string {
  if (!chords || chords.length === 0) return "";
  const sorted = [...chords].sort((a, b) => a.column - b.column);
  let output = "";
  for (const item of sorted) {
    const label = transposeChord(item.chord, semitones, notation);
    const targetCol = Math.max(output.length + (output.length > 0 ? 1 : 0), item.column);
    output += " ".repeat(Math.max(0, targetCol - output.length)) + label;
  }
  return output;
}

export function songToEditableText(song: Song): string {
  const chunks: string[] = [];
  for (const section of song.sections) {
    chunks.push(`[${section.name}]`);
    for (const line of section.lines) {
      if (line.chords.length > 0) {
        chunks.push(buildChordLineString(line.chords, 0, "american"));
      }
      if (line.lyrics) {
        chunks.push(line.lyrics);
      }
    }
    chunks.push("");
  }
  return chunks.join("\n").trim();
}

export function flattenSongLines(song: Song): FlatSongLine[] {
  const flat: FlatSongLine[] = [];
  let idx = 0;
  for (const section of song.sections) {
    for (const line of section.lines) {
      flat.push({
        globalIndex: idx++,
        sectionId: section.id,
        sectionName: section.name,
        line,
      });
    }
  }
  return flat;
}
