import { useState } from "react";
import { ArrowLeft, Mic, MicOff, Send } from "lucide-react";
import { InstrumentProfile, TrackingMode } from "../types/song";
import {
  INSTRUMENT_FILTER_HZ,
  VoiceTrackerState,
} from "../hooks/useVoiceTracker";

interface MicCalibrationViewProps {
  tracker: VoiceTrackerState;
  instrumentProfile: InstrumentProfile;
  onChangeInstrument: (p: InstrumentProfile) => void;
  noiseGate: number;
  onChangeNoiseGate: (val: number) => void;
  mode: TrackingMode;
  onChangeMode: (m: TrackingMode) => void;
  sampleLine: string;
  onBackToStage: () => void;
}

export function MicCalibrationView({
  tracker,
  instrumentProfile,
  onChangeInstrument,
  noiseGate,
  onChangeNoiseGate,
  mode,
  onChangeMode,
  sampleLine,
  onBackToStage,
}: MicCalibrationViewProps) {
  const [simulatedInput, setSimulatedInput] = useState("");

  const profileLabels: { id: InstrumentProfile; name: string; desc: string }[] =
    [
      {
        id: "acoustic_guitar",
        name: "Guitarra Acústica",
        desc: "Filtra graves de caja debajo de 210 Hz y prioriza formantes vocales.",
      },
      {
        id: "electric_guitar",
        name: "Guitarra Eléctrica",
        desc: "Corte más agresivo en 250 Hz para reducir cuerpo de amplificador.",
      },
      {
        id: "piano",
        name: "Piano / Teclado",
        desc: "Corte en 150 Hz para equilibrar mano izquierda con voz.",
      },
      {
        id: "vocals_only",
        name: "Solo Voz / A Capella",
        desc: "Filtro suave de 90 Hz para máxima sensibilidad vocal.",
      },
    ];

  return (
    <div className="flex-1 overflow-y-auto stage-scroll px-4 sm:px-8 py-8 bg-slate-50 dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-zinc-50">
              Calibración de Micrófono e Instrumento
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              Ajusta el filtro para que el rasgueo de tu guitarra o piano no
              dispare cambios de línea por error mientras cantas.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToStage}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Escenario
          </button>
        </div>

        {/* Step 1: Instrument DSP Profile */}
        <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-100">
              1. Elige tu instrumento de acompañamiento
            </h2>
            <span className="font-mono text-xs text-amber-700 dark:text-amber-400">
              Pasa-altos: {INSTRUMENT_FILTER_HZ[instrumentProfile]} Hz
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profileLabels.map((prof) => {
              const selected = prof.id === instrumentProfile;
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => onChangeInstrument(prof.id)}
                  className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    selected
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    {prof.name}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    {prof.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2: Live Noise Gate Calibration */}
        <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-100">
                2. Prueba tu rasgueo y ajusta el umbral de voz
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Toca solo el instrumento durante 3 segundos y coloca el umbral
                justo por encima de la barra gris/ámbar. Al cantar, la barra
                debe cruzarlo en verde.
              </p>
            </div>
            <button
              type="button"
              onClick={tracker.isListening ? tracker.stop : tracker.start}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tracker.isListening
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-amber-500 text-zinc-950 hover:bg-amber-400"
              }`}
            >
              {tracker.isListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  Detener prueba
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Probar micrófono
                </>
              )}
            </button>
          </div>

          {tracker.errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {tracker.errorMessage}
            </p>
          )}

          {/* Dual Meter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
              <span>
                Señal total (gris):{" "}
                <strong className="font-mono">{tracker.rawLevel}%</strong> ·
                Banda vocal (color):{" "}
                <strong className="font-mono">{tracker.vocalLevel}%</strong>
              </span>
              <span
                className={`font-semibold ${
                  tracker.isVoiceActive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-500 dark:text-zinc-400"
                }`}
              >
                {tracker.isListening
                  ? tracker.isVoiceActive
                    ? "Voz activa"
                    : "Esperando voz"
                  : "Micrófono apagado"}
              </span>
            </div>

            <div className="relative h-5 w-full rounded-lg bg-slate-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-slate-400/50 dark:bg-zinc-600/70 transition-[width] duration-75"
                style={{ width: `${tracker.rawLevel}%` }}
              />
              <div
                className={`absolute inset-y-0 left-0 transition-[width] duration-75 ${
                  tracker.isVoiceActive ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${tracker.vocalLevel}%` }}
              />
              <div
                className="absolute inset-y-0 w-1 bg-slate-900 dark:bg-white z-10"
                style={{ left: `${noiseGate}%` }}
              />
            </div>

            <div className="flex items-center gap-4">
              <label
                htmlFor="calibration-gate-slider"
                className="text-xs font-medium text-slate-700 dark:text-zinc-300 whitespace-nowrap"
              >
                Umbral anti-instrumento:
              </label>
              <input
                id="calibration-gate-slider"
                type="range"
                min={0}
                max={75}
                value={noiseGate}
                onChange={(e) => onChangeNoiseGate(Number(e.target.value))}
                className="flex-1 accent-amber-500 cursor-pointer"
              />
              <span className="font-mono text-xs font-semibold text-slate-900 dark:text-zinc-100 w-10 text-right">
                {noiseGate}%
              </span>
            </div>
          </div>
        </section>

        {/* Step 3: Tracking Engine & Live Phrase Test */}
        <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-100">
            3. Motor de reconocimiento y prueba rápida
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => onChangeMode("voice_local")}
              disabled={!tracker.isSpeechSupported}
              className={`p-3 rounded-lg border text-left cursor-pointer disabled:opacity-40 ${
                mode === "voice_local"
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-slate-200 dark:border-zinc-800"
              }`}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Voz en Vivo (Local)
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Respuesta instantánea palabra por palabra sin latencia.
              </p>
            </button>
            <button
              type="button"
              onClick={() => onChangeMode("voice_ai")}
              className={`p-3 rounded-lg border text-left cursor-pointer ${
                mode === "voice_ai"
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-slate-200 dark:border-zinc-800"
              }`}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Ambiente Ruidoso (IA)
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Transcribe voz cantada sobre instrumentos fuertes cada 3s.
              </p>
            </button>
            <button
              type="button"
              onClick={() => onChangeMode("auto_tempo")}
              className={`p-3 rounded-lg border text-left cursor-pointer ${
                mode === "auto_tempo"
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-slate-200 dark:border-zinc-800"
              }`}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Auto-Ritmo (BPM)
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Avance automático por compás si prefieres silenciar el micro.
              </p>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-2">
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Prueba el algoritmo de coincidencia fonética con la canción actual
              (ej. escribe un fragmento de: <em>“{sampleLine}”</em>):
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (simulatedInput.trim()) {
                  tracker.testPhrase(simulatedInput);
                  setSimulatedInput("");
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={simulatedInput}
                onChange={(e) => setSimulatedInput(e.target.value)}
                placeholder="Simular frase cantada..."
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-slate-800 dark:hover:bg-white cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Probar
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
