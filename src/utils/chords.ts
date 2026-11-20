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

function toNotationNote(americanNote: string, notation: NotationSystem): string {
  if (notation === "american") return americanNote;
  const rootLetter = americanNote.charAt(0);
  const rootAcc = americanNote.slice(1);
  const latinName = AMERICAN_TO_LATIN[rootLetter] || rootLetter;
  return `${latinName}${rootAcc}`;
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

    return `${toNotationNote(newNote, notation)}${rest}`;
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

export interface ScaleGuideInfo {
  keyName: string;
  modeLabel: "Mayor" | "Menor";
  notes: string[];
  diatonicChords: { degree: string; chord: string }[];
}

export function getMusicalScaleInfo(
  originalKeyRaw: string,
  semitones: number,
  notation: NotationSystem
): ScaleGuideInfo {
  const transposedAmerican = transposeChord(
    originalKeyRaw || "C",
    semitones,
    "american"
  );
  const match = transposedAmerican.match(/^([A-G][#b]?)(m|min)?/i);
  const rootAmerican = match?.[1] || "C";
  const isMinor = Boolean(match?.[2]);
  const rootSemitone = NOTE_TO_SEMITONE[rootAmerican] ?? 0;
  const preferFlats =
    rootAmerican.includes("b") ||
    (!isMinor && (rootAmerican === "F" || rootAmerican === "Bb" || rootAmerican === "Eb")) ||
    (isMinor && (rootAmerican === "D" || rootAmerican === "G" || rootAmerican === "C"));

  const intervals = isMinor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const qualities = isMinor
    ? ["m", "dim", "", "m", "m", "", ""]
    : ["", "m", "m", "", "", "m", "dim"];
  const degrees = isMinor
    ? ["i", "ii°", "III", "iv", "v", "VI", "VII"]
    : ["I", "ii", "iii", "IV", "V", "vi", "vii°"];

  const notes: string[] = [];
  const diatonicChords: { degree: string; chord: string }[] = [];

  for (let i = 0; i < intervals.length; i++) {
    const idx = (rootSemitone + intervals[i]) % 12;
    const noteAm = preferFlats ? NOTES_FLAT[idx] : NOTES_SHARP[idx];
    const displayNote = toNotationNote(noteAm, notation);
    notes.push(displayNote);
    diatonicChords.push({
      degree: degrees[i],
      chord: `${displayNote}${qualities[i]}`,
    });
  }

  return {
    keyName: `${toNotationNote(rootAmerican, notation)}${isMinor ? "m" : ""}`,
    modeLabel: isMinor ? "Menor" : "Mayor",
    notes,
    diatonicChords,
  };
}

/**
 * Detects ASCII guitar / bass / ukulele tablature lines such as:
 * e|---0---2---3---|
 * B|---1---3---3---|
 * G|--0h2p0--------|
 */
export function isTablatureLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Standard string prefix like e|, B|, G|, D|, A|, E|, 1|, || followed by dashes/frets
  if (/^([A-Ga-g][#b]?|[1-6])?\|[-0-9hHpPbBrRsS/\\~xX().|\s]{4,}$/.test(trimmed)) {
    return true;
  }
  // Tab line without prefix if it has >= 5 dashes and pipe bars
  if (/^\|[-0-9hHpPbBrRsS/\\~xX().\s]+\|/.test(trimmed) && (trimmed.match(/-/g)?.length ?? 0) >= 4) {
    return true;
  }
  return false;
}

export function transposeTabLine(line: string, semitones: number): string {
  if (semitones === 0) return line;
  // Preserve leading string label (e|, B|, etc.) and transpose fret numbers inside the tab body
  const pipeIdx = line.indexOf("|");
  const prefix = pipeIdx !== -1 ? line.slice(0, pipeIdx + 1) : "";
  const body = pipeIdx !== -1 ? line.slice(pipeIdx + 1) : line;

  const shiftedBody = body.replace(/\b(\d{1,2})\b/g, (full, numStr) => {
    const fret = parseInt(numStr, 10);
    if (Number.isNaN(fret)) return full;
    let nextFret = fret + semitones;
    if (nextFret < 0) nextFret += 12;
    if (nextFret > 24) nextFret -= 12;
    return String(nextFret);
  });

  return `${prefix}${shiftedBody}`;
}

const CHORD_TOKEN_REGEX =
  /^(Do|Re|Mi|Fa|Sol|La|Si|[A-G])([#b]?)(m|min|maj|dim|aug|sus|add)?([0-9]{0,2})(\/[A-G|Do|Re|Mi|Fa|Sol|La|Si][#b]?)?$/i;

export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\[.*\]$/.test(trimmed)) return false;
  if (isTablatureLine(trimmed)) return false;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  for (const token of tokens) {
    const clean = token.replace(/[()|,]/g, "");
    if (!clean) continue;
    if (CHORD_TOKEN_REGEX.test(clean)) {
      chordCount++;
    } else if (/^[xX][0-9]+$/.test(clean) || clean === "%" || clean === "/" || clean === "-") {
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
    const token = match[0].replace(/[()|,-]/g, "");
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

    if (
      i === 0 &&
      !detectedTitle &&
      !isChordLine(trimmed) &&
      !isTablatureLine(trimmed) &&
      !/^\[/.test(trimmed) &&
      trimmed.includes(" - ")
    ) {
      const [t, a] = trimmed.split(" - ");
      detectedTitle = t.trim();
      detectedArtist = a.trim();
      i++;
      continue;
    }

    const bracketSectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    const colonSectionMatch = trimmed.match(
      /^(intro|verso\s*\d*|estrofa\s*\d*|coro|estribillo|puente|pre-coro|solo|riff|tablatura|interludio|final|outro)\s*:?$/i
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

    // Group consecutive ASCII tablature lines into a single Tablature block
    if (isTablatureLine(trimmed)) {
      const tabLines: string[] = [];
      while (i < rawLines.length && isTablatureLine(rawLines[i])) {
        tabLines.push(rawLines[i].trimEnd());
        i++;
      }
      currentSection.lines.push({
        id: makeId("line"),
        lyrics: "",
        chords: [],
        isInstrumental: true,
        isTablature: true,
        tabLines,
      });
      continue;
    }

    // Inline bracket format: "[G]Canta y no [D7]llores"
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

    // Two-line format: chord line followed by lyric line
    if (isChordLine(line)) {
      const chords = extractChordsFromLine(line);
      const nextLine = i + 1 < rawLines.length ? rawLines[i + 1] : "";
      const nextTrimmed = nextLine.trim();

      if (
        nextTrimmed &&
        !isChordLine(nextLine) &&
        !isTablatureLine(nextLine) &&
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

    // Plain lyric line
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

  let inferredKey = meta?.originalKey?.trim() || "";
  if (inferredKey) {
    inferredKey = normalizeLatinTokenToAmerican(inferredKey);
  } else {
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

/**
 * Deterministic client-side fallback for combining separate chord/tab notes and copied lyrics
 * when hosted statically without a backend server (e.g. GitHub Pages).
 */
export function alignChordsAndLyricsLocally(params: {
  title?: string;
  artist?: string;
  originalKey?: string;
  chordsText: string;
  lyricsText: string;
}): Song {
  const { title, artist, originalKey, chordsText, lyricsText } = params;

  const chordTokens = chordsText
    .split(/[\s,\-–|]+/)
    .map((t) => t.trim())
    .filter((t) => CHORD_TOKEN_REGEX.test(t))
    .map((t) => normalizeLatinTokenToAmerican(t));

  const tabLinesOnly = chordsText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => isTablatureLine(l));

  if (!lyricsText.trim()) {
    const parsedChords = parseLaCuerdaText(chordsText, {
      title: title || "Progresión / Tablatura",
      artist: artist || "Notas propias",
      originalKey,
    });
    return parsedChords;
  }

  const baseSong = parseLaCuerdaText(lyricsText, {
    title: title || "Canción combinada",
    artist: artist || "Repertorio personal",
    originalKey: originalKey || chordTokens[0] || "C",
  });

  let chordIdx = 0;
  if (chordTokens.length > 0) {
    baseSong.sections = baseSong.sections.map((sec) => ({
      ...sec,
      lines: sec.lines.map((line) => {
        if (line.isInstrumental || line.chords.length > 0 || !line.lyrics.trim()) {
          return line;
        }
        const firstChord = chordTokens[chordIdx % chordTokens.length];
        chordIdx++;
        const placements: ChordPlacement[] = [{ chord: firstChord, column: 0 }];
        if (line.lyrics.length > 22 && chordTokens.length > 1) {
          const secondChord = chordTokens[chordIdx % chordTokens.length];
          chordIdx++;
          const midCol = Math.floor(line.lyrics.length * 0.52);
          placements.push({ chord: secondChord, column: midCol });
        }
        return { ...line, chords: placements };
      }),
    }));
  }

  if (tabLinesOnly.length > 0) {
    baseSong.sections.unshift({
      id: makeId("sec"),
      name: "Intro / Tablatura",
      lines: [
        {
          id: makeId("line"),
          lyrics: "",
          chords: [],
          isInstrumental: true,
          isTablature: true,
          tabLines: tabLinesOnly,
        },
      ],
    });
  }

  return baseSong;
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
    const targetCol = Math.max(
      output.length + (output.length > 0 ? 1 : 0),
      item.column
    );
    output += " ".repeat(Math.max(0, targetCol - output.length)) + label;
  }
  return output;
}

export function songToEditableText(song: Song): string {
  const chunks: string[] = [];
  for (const section of song.sections) {
    chunks.push(`[${section.name}]`);
    for (const line of section.lines) {
      if (line.isTablature && line.tabLines && line.tabLines.length > 0) {
        chunks.push(...line.tabLines);
        continue;
      }
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
