import { useEffect, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Sun,
} from "lucide-react";
import {
  ChordPlacement,
  FlatSongLine,
  NotationSystem,
  Song,
} from "../types/song";
import {
  formatKeyName,
  getCapoHint,
  getScaleOptions,
  transposeChord,
} from "../utils/chords";

interface TeleprompterStageProps {
  song: Song;
  flatLines: FlatSongLine[];
  activeLineIndex: number;
  wordProgress: number;
  transposeSemitones: number;
  onChangeTranspose: (semitones: number) => void;
  notation: NotationSystem;
  onChangeNotation: (notation: NotationSystem) => void;
  fontSizePx: number;
  onChangeFontSize: (px: number) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSelectLine: (index: number) => void;
  onEditSong: () => void;
  isListening: boolean;
}

interface ChordSegment {
  chord: string | null;
  text: string;
}

function buildAlignedSegments(
  lyrics: string,
  chords: ChordPlacement[],
  semitones: number,
  notation: NotationSystem
): ChordSegment[] {
  if (!chords || chords.length === 0) {
    return [{ chord: null, text: lyrics }];
  }

  const sorted = [...chords].sort((a, b) => a.column - b.column);
  const segments: ChordSegment[] = [];
  let cursor = 0;

  for (let i = 0; i < sorted.length; i++) {
    const col = Math.max(cursor, Math.min(sorted[i].column, lyrics.length));
    if (col > cursor) {
      segments.push({
        chord: null,
        text: lyrics.slice(cursor, col),
      });
    }
    const nextCol =
      i + 1 < sorted.length
        ? Math.max(col, Math.min(sorted[i + 1].column, lyrics.length))
        : lyrics.length;

    segments.push({
      chord: transposeChord(sorted[i].chord, semitones, notation),
      text: lyrics.slice(col, nextCol),
    });
    cursor = nextCol;
  }

  if (cursor < lyrics.length) {
    segments.push({
      chord: null,
      text: lyrics.slice(cursor),
    });
  }

  return segments;
}

export function TeleprompterStage({
  song,
  flatLines,
  activeLineIndex,
  wordProgress,
  transposeSemitones,
  onChangeTranspose,
  notation,
  onChangeNotation,
  fontSizePx,
  onChangeFontSize,
  isDarkMode,
  onToggleTheme,
  isFullscreen,
  onToggleFullscreen,
  onSelectLine,
  onEditSong,
  isListening,
}: TeleprompterStageProps) {
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const scaleOptions = useMemo(
    () => getScaleOptions(song.originalKey, notation),
    [song.originalKey, notation]
  );

  const currentKeyLabel = formatKeyName(
    song.originalKey,
    transposeSemitones,
    notation
  );
  const capoHint = getCapoHint(transposeSemitones);

  // Smoothly keep the active line in the comfortable upper-center reading zone
  useEffect(() => {
    const el = lineRefs.current[activeLineIndex];
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeLineIndex, song.id]);

  // Precompute global index lookup by line id
  const lineGlobalMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of flatLines) {
      map.set(item.line.id, item.globalIndex);
    }
    return map;
  }, [flatLines]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950">
      {/* Workspace Song & Scale Toolbar */}
      <div className="border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 py-3 bg-white dark:bg-zinc-950">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Song Title & Clean Metadata */}
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-50 truncate">
                {song.title}
              </h1>
              <button
                type="button"
                onClick={onEditSong}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Editar letra o acordes"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
              </button>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <span>{song.artist}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-amber-700 dark:text-amber-400 font-semibold">
                Tono {currentKeyLabel}
              </span>
              {capoHint && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{capoHint}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono">{song.bpm} BPM</span>
            </div>
          </div>

          {/* Musician Controls: Scale Transpose, Notation, Font Size, Theme, Fullscreen */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Vocal Scale Transposer */}
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 p-0.5">
              <button
                type="button"
                onClick={() =>
                  onChangeTranspose(Math.max(-6, transposeSemitones - 1))
                }
                disabled={transposeSemitones <= -6}
                className="p-1.5 rounded-md text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-35 cursor-pointer"
                title="Bajar 1 semitono"
                aria-label="Bajar 1 semitono"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <select
                aria-label="Seleccionar escala para tu voz"
                value={transposeSemitones}
                onChange={(e) => onChangeTranspose(Number(e.target.value))}
                className="px-2 py-1 text-xs font-mono font-semibold bg-transparent text-slate-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
              >
                {scaleOptions.map((opt) => (
                  <option
                    key={opt.semitones}
                    value={opt.semitones}
                    className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  onChangeTranspose(Math.min(6, transposeSemitones + 1))
                }
                disabled={transposeSemitones >= 6}
                className="p-1.5 rounded-md text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-35 cursor-pointer"
                title="Subir 1 semitono"
                aria-label="Subir 1 semitono"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Notation Switch: American vs Latin */}
            <div
              role="group"
              aria-label="Sistema de cifrado"
              className="flex items-center gap-0.5 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => onChangeNotation("american")}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  notation === "american"
                    ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-50 shadow-xs"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                C D E
              </button>
              <button
                type="button"
                onClick={() => onChangeNotation("latin")}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  notation === "latin"
                    ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-50 shadow-xs"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                Do Re Mi
              </button>
            </div>

            {/* Font Size Control */}
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 p-0.5">
              <button
                type="button"
                onClick={() => onChangeFontSize(Math.max(18, fontSizePx - 2))}
                className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 rounded-md cursor-pointer"
                title="Reducir tamaño de letra"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => onChangeFontSize(Math.min(40, fontSizePx + 2))}
                className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 rounded-md cursor-pointer"
                title="Aumentar tamaño de letra"
              >
                A+
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              title={isDarkMode ? "Cambiar a Papel Claro" : "Cambiar a Escenario Oscuro"}
              aria-label={isDarkMode ? "Cambiar a Papel Claro" : "Cambiar a Escenario Oscuro"}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Fullscreen Stage Mode */}
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              title={isFullscreen ? "Salir de pantalla completa" : "Modo Escenario (Pantalla Completa)"}
              aria-label={isFullscreen ? "Salir de pantalla completa" : "Modo Escenario"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Karaoke Teleprompter Canvas */}
      <div className="flex-1 overflow-y-auto stage-scroll px-4 sm:px-10 py-10">
        <div className="max-w-4xl mx-auto space-y-10 pb-36">
          {song.sections.map((section) => (
            <section key={section.id} className="space-y-4">
              <h2 className="font-display text-xs font-semibold tracking-wider text-slate-400 dark:text-zinc-500 uppercase">
                {section.name}
              </h2>

              <div className="space-y-5">
                {section.lines.map((line) => {
                  const globalIdx = lineGlobalMap.get(line.id) ?? 0;
                  const isActive = globalIdx === activeLineIndex;
                  const isPast = globalIdx < activeLineIndex;

                  const segments = buildAlignedSegments(
                    line.lyrics,
                    line.chords,
                    transposeSemitones,
                    notation
                  );

                  // Calculate total character length for smooth karaoke sweep across active line
                  const totalChars = Math.max(1, line.lyrics.length);
                  const illuminatedCharLimit = isActive
                    ? Math.round(wordProgress * totalChars)
                    : 0;

                  let runningCharOffset = 0;

                  return (
                    <div
                      key={line.id}
                      ref={(el) => {
                        lineRefs.current[globalIdx] = el;
                      }}
                      onClick={() => onSelectLine(globalIdx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectLine(globalIdx);
                        }
                      }}
                      className={`group rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer select-none ${
                        isActive
                          ? "bg-amber-500/10 dark:bg-zinc-900 ring-1 ring-amber-500/40 dark:ring-amber-400/35"
                          : isPast
                          ? "opacity-40 hover:opacity-75"
                          : "opacity-80 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-zinc-900/40"
                      }`}
                    >
                      {line.isInstrumental ? (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-4">
                            {line.chords.map((c, cIdx) => (
                              <span
                                key={`${line.id}-inst-${cIdx}`}
                                className="font-mono font-bold text-amber-700 dark:text-amber-400"
                                style={{ fontSize: `${Math.max(16, fontSizePx * 0.72)}px` }}
                              >
                                {transposeChord(
                                  c.chord,
                                  transposeSemitones,
                                  notation
                                )}
                              </span>
                            ))}
                          </div>
                          {line.lyrics && (
                            <p
                              className="italic text-slate-500 dark:text-zinc-400"
                              style={{ fontSize: `${Math.max(15, fontSizePx * 0.65)}px` }}
                            >
                              {line.lyrics}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-end leading-tight">
                          {segments.map((seg, segIdx) => {
                            const segStart = runningCharOffset;
                            runningCharOffset += seg.text.length;

                            // Highlight portion of segment already sung in karaoke sweep
                            const charsSungInSeg = isActive
                              ? Math.max(
                                  0,
                                  Math.min(
                                    seg.text.length,
                                    illuminatedCharLimit - segStart
                                  )
                                )
                              : 0;

                            const sungPart = seg.text.slice(0, charsSungInSeg);
                            const remainingPart = seg.text.slice(charsSungInSeg);

                            return (
                              <span
                                key={`${line.id}-seg-${segIdx}`}
                                className="inline-flex flex-col items-start whitespace-pre-wrap"
                              >
                                {/* Chord Row */}
                                <span
                                  className={`font-mono font-bold min-h-[1.25em] pr-2 ${
                                    isActive
                                      ? "text-amber-700 dark:text-amber-400"
                                      : "text-amber-600/85 dark:text-amber-400/80"
                                  }`}
                                  style={{
                                    fontSize: `${Math.max(14, Math.round(fontSizePx * 0.62))}px`,
                                  }}
                                >
                                  {seg.chord ? seg.chord : "\u00A0"}
                                </span>

                                {/* Lyric Row with Karaoke Sweep */}
                                <span
                                  className="font-medium tracking-tight"
                                  style={{
                                    fontSize: `${fontSizePx}px`,
                                    lineHeight: 1.32,
                                  }}
                                >
                                  {isActive && sungPart && (
                                    <span className="text-emerald-700 dark:text-emerald-400">
                                      {sungPart}
                                    </span>
                                  )}
                                  <span
                                    className={
                                      isActive
                                        ? "text-slate-950 dark:text-white"
                                        : "text-slate-800 dark:text-zinc-200"
                                    }
                                  >
                                    {isActive ? remainingPart : seg.text}
                                  </span>
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Practical Stage Navigation Bar */}
      <footer className="border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 sm:px-6 py-2.5">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectLine(Math.max(0, activeLineIndex - 1))}
              disabled={activeLineIndex <= 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 disabled:opacity-40 cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              Anterior
            </button>
            <button
              type="button"
              onClick={() =>
                onSelectLine(
                  Math.min(flatLines.length - 1, activeLineIndex + 1)
                )
              }
              disabled={activeLineIndex >= flatLines.length - 1}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 disabled:opacity-40 cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Siguiente
            </button>
            <button
              type="button"
              onClick={() => onSelectLine(0)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Inicio
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
            <span className="font-mono">
              Línea {Math.min(flatLines.length, activeLineIndex + 1)} /{" "}
              {flatLines.length}
            </span>
            <span className="hidden sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="hidden sm:inline">
              {isListening
                ? "Canta para avanzar automáticamente · Flechas ↑/↓ ajustan línea"
                : "Espacio: activar micrófono · Flechas ↑/↓ o clic: mover línea"}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
