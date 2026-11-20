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
}

/**
 * Strict anti-runaway matcher:
 * - Anchors strongly to the current line while words in it are still being sung.
 * - Only advances +1 line when words from the immediate next sung line appear (or current line finishes).
 * - Only jumps further ahead (e.g. skipping an instrumental solo or chorus jump) if >= 2 distinct
 *   meaningful content words match in order with high confidence.
 */
export function matchTranscriptToLine(
  recentPhrase: string,
  flatLines: FlatSongLine[],
  currentLineIndex: number
): MatchResult | null {
  const heardWords = tokenizeNormalized(recentPhrase);
  if (heardWords.length === 0 || flatLines.length === 0) return null;

  // Keep only the freshest 6 words so old lines never pull or push erratically
  const freshHeard = heardWords.slice(-6);

  // Build candidate indices: current line, next sung lines (+1, +2, and at most +3 for post-solo skip)
  const candidates: number[] = [];
  if (currentLineIndex >= 0 && currentLineIndex < flatLines.length) {
    candidates.push(currentLineIndex);
  }
  let sungAhead = 0;
  for (
    let i = currentLineIndex + 1;
    i < flatLines.length && sungAhead < 4;
    i++
  ) {
    if (!flatLines[i].line.isInstrumental && !flatLines[i].line.isTablature) {
      candidates.push(i);
      sungAhead++;
    }
  }

  let bestResult: MatchResult | null = null;
  let bestWeightedScore = 0;

  // Evaluate current line first to check if singer is still clearly on this line
  const evalLine = (idx: number) => {
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

    for (const hw of freshHeard) {
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
        totalHits++;
        const isContent = !STOPWORDS.has(lineWords[bestPos]) && lineWords[bestPos].length >= 3;
        if (isContent) contentHits++;
        totalScore += bestSim * (isContent ? 1.25 : 0.65);

        if (bestPos >= lastPos) {
          inOrderHits++;
          lastPos = bestPos;
        }
      }
    }

    if (totalHits === 0) return null;

    const progress =
      lastPos >= 0 ? Math.min(1, (lastPos + 1) / lineWords.length) : 0;

    return {
      idx,
      totalScore,
      contentHits,
      totalHits,
      inOrderHits,
      progress,
      lineWordCount: lineWords.length,
    };
  };

  const currentEval = evalLine(currentLineIndex);

  // If the singer's freshest last 2 words match the current line and haven't finished it,
  // lock onto the current line so repeated chorus words ahead NEVER yank the cursor away!
  if (
    currentEval &&
    currentEval.totalHits >= 1 &&
    currentEval.progress < 0.88 &&
    currentEval.contentHits >= 1
  ) {
    return {
      matchedLineIndex: currentLineIndex,
      wordProgress: currentEval.progress,
      confidence: Math.min(1, currentEval.totalScore / 2.2),
    };
  }

  for (let orderIdx = 0; orderIdx < candidates.length; orderIdx++) {
    const idx = candidates[orderIdx];
    const res = idx === currentLineIndex ? currentEval : evalLine(idx);
    if (!res) continue;

    const sungDistance = orderIdx; // 0 = current, 1 = next sung line, 2+ = further ahead

    // Strict gate against jumping ahead on 1 accidental word
    if (sungDistance === 0) {
      if (res.totalHits < 1) continue;
    } else if (sungDistance === 1) {
      // To advance to the very next line: require either >= 2 matching words OR 1 strong content word
      if (res.totalHits < 2 && res.contentHits < 1) continue;
      // If current line just started (< 35% progress) and has matches, don't jump early on just 1 word
      if (
        currentEval &&
        currentEval.progress < 0.35 &&
        res.contentHits < 2
      ) {
        continue;
      }
    } else {
      // Skipping 2+ sung lines ahead requires strong proof (>= 2 distinct content words in order)
      if (res.contentHits < 2 || res.inOrderHits < 2) continue;
    }

    const distanceWeight =
      sungDistance === 0 ? 1.25 : sungDistance === 1 ? 1.05 : 0.72;
    const weighted = (res.totalScore + res.inOrderHits * 0.2) * distanceWeight;

    if (weighted > bestWeightedScore) {
      bestWeightedScore = weighted;
      bestResult = {
        matchedLineIndex: idx,
        wordProgress: res.progress,
        confidence: Math.min(1, res.totalScore / 2.5),
      };
    }
  }

  return bestResult;
}
