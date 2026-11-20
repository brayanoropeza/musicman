import { Mic, MicOff, SlidersHorizontal } from "lucide-react";
import { InstrumentProfile, TrackingMode } from "../types/song";
import { VoiceTrackerState } from "../hooks/useVoiceTracker";

interface VoiceConsoleProps {
  tracker: VoiceTrackerState;
  mode: TrackingMode;
  onChangeMode: (mode: TrackingMode) => void;
  instrumentProfile: InstrumentProfile;
  onChangeInstrument: (profile: InstrumentProfile) => void;
  noiseGate: number;
  onChangeNoiseGate: (value: number) => void;
  onOpenCalibration: () => void;
}

export function VoiceConsole({
  tracker,
  mode,
  onChangeMode,
  instrumentProfile,
  onChangeInstrument,
  noiseGate,
  onChangeNoiseGate,
  onOpenCalibration,
}: VoiceConsoleProps) {
  const {
    isListening,
    isSpeechSupported,
    permissionState,
    activeEngineNote,
    rawLevel,
    vocalLevel,
    detectedNote,
    detectedHz,
    isVoiceActive,
    lastTranscript,
    errorMessage,
    isProcessingAiClip,
    start,
    stop,
  } = tracker;

  return (
    <section
      aria-label="Control de micrófono y seguimiento"
      className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 px-4 sm:px-6 py-3"
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Primary Mic Start Button + Unified Mode Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={isListening ? stop : start}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
              isListening
                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                : "bg-amber-500 text-zinc-950 hover:bg-amber-400"
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                Detener Micrófono
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                {mode === "auto_tempo"
                  ? "Empezar Auto-Ritmo"
                  : "Empezar (Activar Micrófono)"}
              </>
            )}
          </button>

          <div
            role="group"
            aria-label="Modo de seguimiento"
            className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-zinc-800"
          >
            <button
              type="button"
              onClick={() => onChangeMode("hybrid")}
              title="Combina detección de palabras, nota musical cantada y ritmo BPM con freno anti-adelanto"
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === "hybrid"
                  ? "bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              Híbrido (Letra + Nota + Ritmo)
            </button>
            <button
              type="button"
              onClick={() => onChangeMode("words_only")}
              disabled={!isSpeechSupported}
              title={
                isSpeechSupported
                  ? "Avanza estrictamente al coincidir las palabras cantadas (nunca por ritmo solo)"
                  : "No disponible en este navegador; usa Híbrido"
              }
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                mode === "words_only"
                  ? "bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              Solo Palabras
            </button>
            <button
              type="button"
              onClick={() => onChangeMode("voice_ai")}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === "voice_ai"
                  ? "bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              IA Ruidoso
            </button>
            <button
              type="button"
              onClick={() => onChangeMode("auto_tempo")}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === "auto_tempo"
                  ? "bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              Auto-Ritmo
            </button>
          </div>
        </div>

        {/* Instrument Filter + Live Pitch Note + Vocal Energy Meter */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label
              htmlFor="instrument-profile-select"
              className="text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap"
            >
              Instrumento:
            </label>
            <select
              id="instrument-profile-select"
              value={instrumentProfile}
              onChange={(e) =>
                onChangeInstrument(e.target.value as InstrumentProfile)
              }
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
            >
              <option value="acoustic_guitar">Guitarra Acústica (210 Hz)</option>
              <option value="electric_guitar">Guitarra Eléctrica (250 Hz)</option>
              <option value="piano">Piano / Teclado (150 Hz)</option>
              <option value="vocals_only">Solo Voz (90 Hz)</option>
            </select>
          </div>

          {mode !== "auto_tempo" && (
            <div className="flex items-center gap-3">
              <div className="w-40 sm:w-48 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                  <span>
                    {isListening
                      ? isVoiceActive
                        ? detectedNote
                          ? `Nota ${detectedNote}`
                          : "Voz detectada"
                        : "Solo instrumento"
                      : permissionState === "denied"
                      ? "Micrófono bloqueado"
                      : "Listo para empezar"}
                  </span>
                  <span className="font-mono">
                    {detectedHz ? `${detectedHz}Hz` : `${vocalLevel}%`}
                  </span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-slate-400/50 dark:bg-zinc-600/60 transition-[width] duration-75"
                    style={{ width: `${rawLevel}%` }}
                  />
                  <div
                    className={`absolute inset-y-0 left-0 transition-[width] duration-75 ${
                      isVoiceActive ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                    style={{ width: `${vocalLevel}%` }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 bg-slate-900 dark:bg-white z-10"
                    style={{ left: `${noiseGate}%` }}
                    title={`Umbral anti-instrumento: ${noiseGate}%`}
                  />
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5">
                <label
                  htmlFor="noise-gate-mini"
                  className="text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap"
                >
                  Umbral
                </label>
                <input
                  id="noise-gate-mini"
                  type="range"
                  min={0}
                  max={70}
                  value={noiseGate}
                  onChange={(e) => onChangeNoiseGate(Number(e.target.value))}
                  className="w-16 accent-amber-500 cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={onOpenCalibration}
                className="p-2 rounded-md border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                title="Calibrar micrófono e instrumento"
                aria-label="Calibrar micrófono e instrumento"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live status / transcript / error row */}
      {(lastTranscript || errorMessage || activeEngineNote || isProcessingAiClip) && (
        <div className="max-w-6xl mx-auto mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          {errorMessage ? (
            <p className="text-red-600 dark:text-red-400 font-medium">
              {errorMessage}
            </p>
          ) : (
            <p className="text-slate-500 dark:text-zinc-400 truncate max-w-3xl">
              {isProcessingAiClip
                ? "Analizando fragmento vocal con IA..."
                : lastTranscript
                ? `Escuchando: "${lastTranscript}"`
                : activeEngineNote}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
