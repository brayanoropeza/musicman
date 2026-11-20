import { FlatSongLine } from "../types/song";

/**
 * Normalizes Spanish & English sung text so phonetic similarities
 * (e.g. "b/v", "s/c/z", "ll/y", elongated vowels "aaamoor") still match cleanly
 * even when acoustic instruments cause imperfect speech recognition.
 */
export function normalizePhonetic(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/([a-z])\1+/g, "$1") // collapse elongated sung vowels/letters
    .replace(/\bv/g, "b")
    .replace(/c([ei])/g, "s$1")
    .replace(/z/g, "s")
    .replace(/ll/g, "y")
    .replace(/qu/g, "k")
    .replace(/h/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeNormalized(input: string): string[] {
  const clean = normalizePhonetic(input);
  if (!clean) return [];
  return clean.split(" ").filter((w) => w.length > 0);
}

function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (a.length >= 3 && b.length >= 3) {
    if (a.includes(b) || b.includes(a)) return 0.82;
  }
  // Character bigram Jaccard similarity for fuzzy singing matches
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bigramsA = new Set<string>();
  const bigramsB = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2));
  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

export interface MatchResult {
  matchedLineIndex: number;
  wordProgress: number; // 0..1 progress across words in the matched line
  confidence: number;
}

/**
 * Matches a rolling window of live microphone transcript words against the song's
 * upcoming lines, gracefully jumping past instrumental solos/intros when the
 * musician starts singing the next vocal phrase.
 */
export function matchTranscriptToLine(
  transcript: string,
  flatLines: FlatSongLine[],
  currentLineIndex: number
): MatchResult | null {
  const heardWords = tokenizeNormalized(transcript);
  if (heardWords.length === 0 || flatLines.length === 0) return null;

  // Use the last 10 heard words so older phrases don't pull the cursor backward
  const recentHeard = heardWords.slice(-10);

  // Search window: allow 1 line back (in case of quick repeat), and up to 7 lines ahead
  // (automatically skipping instrumental chord-only lines!)
  const minIdx = Math.max(0, currentLineIndex - 1);
  const maxIdx = Math.min(flatLines.length - 1, currentLineIndex + 7);

  let bestScore = 0;
  let bestIdx = currentLineIndex;
  let bestProgress = 0;

  for (let idx = minIdx; idx <= maxIdx; idx++) {
    const candidate = flatLines[idx];
    if (candidate.line.isInstrumental) continue;

    const lineWords = tokenizeNormalized(candidate.line.lyrics);
    if (lineWords.length === 0) continue;

    // Score how many words in this line match the recent sung transcript in order
    let matchedWords = 0;
    let lastMatchedLineWordPos = -1;
    let sequenceBonus = 0;

    for (let hwIdx = 0; hwIdx < recentHeard.length; hwIdx++) {
      const hw = recentHeard[hwIdx];
      let bestWordScore = 0;
      let bestPos = -1;

      for (let lwIdx = 0; lwIdx < lineWords.length; lwIdx++) {
        const sim = wordSimilarity(hw, lineWords[lwIdx]);
        if (sim > 0.68 && sim > bestWordScore) {
          bestWordScore = sim;
          bestPos = lwIdx;
        }
      }

      if (bestPos !== -1) {
        matchedWords += bestWordScore;
        if (bestPos >= lastMatchedLineWordPos) {
          sequenceBonus += 0.2;
          lastMatchedLineWordPos = bestPos;
        }
      }
    }

    const coverage = matchedWords / Math.max(2, Math.min(lineWords.length, 5));
    let score = coverage + sequenceBonus * 0.25;

    // Gentle forward bias: prefer current line or immediate next line over distant repeats
    const distance = idx - currentLineIndex;
    if (distance === 0) score *= 1.15;
    else if (distance === 1) score *= 1.12;
    else if (distance === 2) score *= 1.02;
    else if (distance < 0) score *= 0.65;
    else score *= Math.max(0.75, 1 - distance * 0.04);

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
      bestProgress =
        lastMatchedLineWordPos >= 0
          ? Math.min(1, (lastMatchedLineWordPos + 1) / lineWords.length)
          : 0;
    }
  }

  // Require enough confidence so stray guitar transients don't trigger false jumps
  if (bestScore < 0.36) return null;

  // If the musician already sang >= 85% of the current line, nudge smoothly toward the end
  // or keep them on the current line until the first word of the next line hits.
  return {
    matchedLineIndex: bestIdx,
    wordProgress: bestProgress,
    confidence: Math.min(1, bestScore),
  };
}
