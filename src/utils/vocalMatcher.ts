import { FlatSongLine } from "../types/song";

const STOPWORDS = new Set([
  "de",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "y",
  "o",
  "a",
  "en",
  "que",
  "se",
  "no",
  "me",
  "te",
  "mi",
  "tu",
  "su",
  "por",
  "con",
  "del",
  "al",
  "lo",
  "pa",
  "the",
  "and",
  "to",
  "of",
  "in",
  "is",
  "it",
  "you",
  "i",
]);

/**
 * Normalizes Spanish & English sung text so phonetic similarities
 * (e.g. "b/v", "s/c/z", "ll/y", elongated vowels "aaamoor") match cleanly
 * even with instrument accompaniment.
 */
export function normalizePhonetic(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/([a-z])\1+/g, "$1")
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
    if (a.includes(b) || b.includes(a)) return 0.85;
  }
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
  isResync?: boolean;
  sectionName?: string;
}

interface LineEval {
  idx: number;
  totalScore: number;
  contentHits: number;
  totalHits: number;
  inOrderHits: number;
  progress: number;
  coverageRatio: number;
}

function evaluateCandidateLine(
  heardWords: string[],
  flatLines: FlatSongLine[],
  idx: number
): LineEval | null {
  const item = flatLines[idx];
  if (!item || item.line.isInstrumental || item.line.isTablature) {
    return null;
  }

  const lineWords = tokenizeNormalized(item.line.lyrics);
  if (lineWords.length === 0) return null;

  let totalScore = 0;
  let contentHits = 0;
  let totalHits = 0;
  let lastPos = -1;
  let inOrderHits = 0;
  const matchedLinePositions = new Set<number>();

  for (const hw of heardWords) {
    let bestSim = 0;
    let bestPos = -1;

    for (let lwIdx = 0; lwIdx < lineWords.length; lwIdx++) {
      const sim = wordSimilarity(hw, lineWords[lwIdx]);
      if (sim >= 0.74 && sim > bestSim) {
        bestSim = sim;
        bestPos = lwIdx;
      }
    }

    if (bestPos !== -1) {
      if (!matchedLinePositions.has(bestPos)) {
        matchedLinePositions.add(bestPos);
        totalHits++;
        const isContent =
          !STOPWORDS.has(lineWords[bestPos]) && lineWords[bestPos].length >= 3;
        if (isContent) contentHits++;
        totalScore += bestSim * (isContent ? 1.25 : 0.6);
      }

      if (bestPos >= lastPos) {
        inOrderHits++;
        lastPos = bestPos;
      }
    }
  }

  if (totalHits === 0) return null;

  const progress =
    lastPos >= 0 ? Math.min(1, (lastPos + 1) / lineWords.length) : 0;
  const coverageRatio = matchedLinePositions.size / lineWords.length;

  return {
    idx,
    totalScore,
    contentHits,
    totalHits,
    inOrderHits,
    progress,
    coverageRatio,
  };
}

/**
 * Compensates for speech/audio processing latency by advancing to the next sung line
 * slightly before the current line finishes, proportional to leadAheadSec.
 */
function applyLeadAhead(
  result: MatchResult,
  flatLines: FlatSongLine[],
  leadAheadSec: number
): MatchResult {
  if (leadAheadSec <= 0) return result;

  const advanceThreshold = Math.max(0.65, 0.94 - leadAheadSec * 0.14);
  if (result.wordProgress < advanceThreshold) {
    return result;
  }

  let nextIdx = result.matchedLineIndex + 1;
  while (
    nextIdx < flatLines.length &&
    (flatLines[nextIdx].line.isInstrumental ||
      flatLines[nextIdx].line.isTablature)
  ) {
    nextIdx++;
  }

  if (nextIdx >= flatLines.length) {
    return result;
  }

  return {
    ...result,
    matchedLineIndex: nextIdx,
    wordProgress: 0.08,
    sectionName: flatLines[nextIdx].sectionName,
  };
}

/**
 * Two-tier lyric matcher:
 * 1. Local tracking (current & next 2 sung lines) for smooth line-by-line progression.
 * 2. Global stanza resync across the ENTIRE song when the singer is clearly on another
 *    verse/chorus (whether ahead because the teleprompter fell behind, or repeating a section).
 */
export function matchTranscriptToLine(
  recentPhrase: string,
  flatLines: FlatSongLine[],
  currentLineIndex: number,
  leadAheadSec = 1.5
): MatchResult | null {
  const heardWords = tokenizeNormalized(recentPhrase);
  if (heardWords.length === 0 || flatLines.length === 0) return null;

  const freshLocalHeard = heardWords.slice(-6);
  const resyncWindowHeard = heardWords.slice(-10);

  // --- Tier 1: Local window (current + next 2 sung lines) ---
  const localCandidates: number[] = [];
  if (currentLineIndex >= 0 && currentLineIndex < flatLines.length) {
    localCandidates.push(currentLineIndex);
  }
  let sungAhead = 0;
  for (
    let i = currentLineIndex + 1;
    i < flatLines.length && sungAhead < 3;
    i++
  ) {
    if (!flatLines[i].line.isInstrumental && !flatLines[i].line.isTablature) {
      localCandidates.push(i);
      sungAhead++;
    }
  }

  const currentEval = evaluateCandidateLine(
    freshLocalHeard,
    flatLines,
    currentLineIndex
  );

  // Keep locked on current line while actively singing through it
  if (
    currentEval &&
    currentEval.totalHits >= 1 &&
    currentEval.progress < 0.88 &&
    currentEval.contentHits >= 1
  ) {
    // Check if another stanza further away matches MUCH more strongly across the 10-word window
    // (handles cases where 1 common word happened to match the old line while user is singing a new verse)
    let strongResyncHit: MatchResult | null = null;
    if (resyncWindowHeard.length >= 4 && currentEval.contentHits <= 1) {
      let bestGlobalScore = currentEval.totalScore + 1.5;
      for (let i = 0; i < flatLines.length; i++) {
        if (i === currentLineIndex) continue;
        const gEval = evaluateCandidateLine(resyncWindowHeard, flatLines, i);
        if (
          gEval &&
          gEval.contentHits >= 3 &&
          gEval.inOrderHits >= 2 &&
          gEval.totalScore > bestGlobalScore
        ) {
          bestGlobalScore = gEval.totalScore;
          strongResyncHit = {
            matchedLineIndex: gEval.idx,
            wordProgress: gEval.progress,
            confidence: Math.min(1, gEval.totalScore / 3),
            isResync: true,
            sectionName: flatLines[gEval.idx].sectionName,
          };
        }
      }
    }

    if (strongResyncHit) return applyLeadAhead(strongResyncHit, flatLines, leadAheadSec);

    return applyLeadAhead(
      {
        matchedLineIndex: currentLineIndex,
        wordProgress: currentEval.progress,
        confidence: Math.min(1, currentEval.totalScore / 2.2),
      },
      flatLines,
      leadAheadSec
    );
  }

  let bestLocal: MatchResult | null = null;
  let bestLocalScore = 0;

  for (let orderIdx = 0; orderIdx < localCandidates.length; orderIdx++) {
    const idx = localCandidates[orderIdx];
    const res =
      idx === currentLineIndex
        ? currentEval
        : evaluateCandidateLine(freshLocalHeard, flatLines, idx);
    if (!res) continue;

    if (orderIdx === 0) {
      if (res.totalHits < 1) continue;
    } else if (orderIdx === 1) {
      if (res.totalHits < 2 && res.contentHits < 1) continue;
      if (currentEval && currentEval.progress < 0.35 && res.contentHits < 2) {
        continue;
      }
    } else {
      if (res.contentHits < 2 || res.inOrderHits < 2) continue;
    }

    const weight = orderIdx === 0 ? 1.22 : orderIdx === 1 ? 1.05 : 0.85;
    const weighted = (res.totalScore + res.inOrderHits * 0.2) * weight;

    if (weighted > bestLocalScore) {
      bestLocalScore = weighted;
      bestLocal = {
        matchedLineIndex: idx,
        wordProgress: res.progress,
        confidence: Math.min(1, res.totalScore / 2.5),
      };
    }
  }

  if (bestLocal) return applyLeadAhead(bestLocal, flatLines, leadAheadSec);

  // --- Tier 2: Global Stanza Resync (when teleprompter fell behind or singer jumped sections) ---
  let bestResync: MatchResult | null = null;
  let bestResyncScore = 0;

  for (let idx = 0; idx < flatLines.length; idx++) {
    const res = evaluateCandidateLine(resyncWindowHeard, flatLines, idx);
    if (!res) continue;

    // Require clear multi-word proof to jump anywhere in the song
    const strongEnough =
      (res.contentHits >= 2 && res.inOrderHits >= 2) ||
      (res.contentHits >= 2 && res.coverageRatio >= 0.45) ||
      (res.totalHits >= 3 && res.inOrderHits >= 2);

    if (!strongEnough) continue;

    // Prefer lines ahead of current position over earlier identical choruses
    const forwardBonus = idx > currentLineIndex ? 1.18 : 0.92;
    const score =
      (res.totalScore + res.inOrderHits * 0.25 + res.coverageRatio) *
      forwardBonus;

    if (score > bestResyncScore) {
      bestResyncScore = score;
      bestResync = {
        matchedLineIndex: idx,
        wordProgress: res.progress,
        confidence: Math.min(1, res.totalScore / 2.8),
        isResync: true,
        sectionName: flatLines[idx].sectionName,
      };
    }
  }

  return bestResync
    ? applyLeadAhead(bestResync, flatLines, leadAheadSec)
    : null;
}
