import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatSongLine,
  InstrumentProfile,
  NotationSystem,
  TrackingMode,
} from "../types/song";
import { detectVocalPitch } from "../utils/pitchDetector";
import { matchTranscriptToLine } from "../utils/vocalMatcher";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export const INSTRUMENT_FILTER_HZ: Record<InstrumentProfile, number> = {
  acoustic_guitar: 210,
  electric_guitar: 250,
  piano: 150,
  vocals_only: 90,
};

export interface UseVoiceTrackerOptions {
  flatLines: FlatSongLine[];
  activeLineIndex: number;
  onAdvanceToLine: (lineIndex: number, wordProgress: number) => void;
  language: "es" | "en";
  bpm: number;
  notation: NotationSystem;
  mode: TrackingMode;
  instrumentProfile: InstrumentProfile;
  noiseGate: number; // 0..100
}

export interface VoiceTrackerState {
  isListening: boolean;
  isSpeechSupported: boolean;
  isWordEngineActive: boolean;
  permissionState: "prompt" | "granted" | "denied" | "unknown";
  activeEngineNote: string | null;
  rawLevel: number; // 0..100 total mic signal (instrument + voice)
  vocalLevel: number; // 0..100 filtered vocal band energy
  detectedNote: string | null; // Live sung musical note e.g. "Sol4" or "G4"
  detectedHz: number | null;
  pitchClarity: number; // 0..100 harmonic vocal clarity
  isVoiceActive: boolean;
  lastTranscript: string;
  errorMessage: string | null;
  isProcessingAiClip: boolean;
  start: () => Promise<void>;
  stop: () => void;
  testPhrase: (phrase: string) => void;
}

export function useVoiceTracker({
  flatLines,
  activeLineIndex,
  onAdvanceToLine,
  language,
  bpm,
  notation,
  mode,
  instrumentProfile,
  noiseGate,
}: UseVoiceTrackerOptions): VoiceTrackerState {
  const [isListening, setIsListening] = useState(false);
  const [isWordEngineActive, setIsWordEngineActive] = useState(false);
  const [permissionState, setPermissionState] = useState<
    "prompt" | "granted" | "denied" | "unknown"
  >("unknown");
  const [activeEngineNote, setActiveEngineNote] = useState<string | null>(null);
  const [rawLevel, setRawLevel] = useState(0);
  const [vocalLevel, setVocalLevel] = useState(0);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [detectedHz, setDetectedHz] = useState<number | null>(null);
  const [pitchClarity, setPitchClarity] = useState(0);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessingAiClip, setIsProcessingAiClip] = useState(false);

  const win = typeof window !== "undefined" ? (window as WindowWithSpeech) : null;
  const SpeechRecCtor =
    win?.SpeechRecognition || win?.webkitSpeechRecognition || null;
  const isSpeechSupported = Boolean(SpeechRecCtor);

  const isListeningRef = useRef(false);
  const activeLineRef = useRef(activeLineIndex);
  const flatLinesRef = useRef(flatLines);
  const noiseGateRef = useRef(noiseGate);
  const modeRef = useRef(mode);
  const bpmRef = useRef(bpm);
  const notationRef = useRef(notation);

  const lastVoiceTimestampRef = useRef(0);
  const lastWordMatchTimestampRef = useRef(0);
  const lineEnteredTimestampRef = useRef(Date.now());
  const finalTailRef = useRef<string[]>([]);
  const lineProgressRef = useRef(0);
  const wordEngineWorkingRef = useRef(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const highpassRef = useRef<BiquadFilterNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const aiIntervalRef = useRef<number | null>(null);
  const tempoIntervalRef = useRef<number | null>(null);
  const hybridTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeLineRef.current !== activeLineIndex) {
      activeLineRef.current = activeLineIndex;
      lineProgressRef.current = 0;
      lineEnteredTimestampRef.current = Date.now();
    }
  }, [activeLineIndex]);

  useEffect(() => {
    flatLinesRef.current = flatLines;
  }, [flatLines]);

  useEffect(() => {
    noiseGateRef.current = noiseGate;
  }, [noiseGate]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    notationRef.current = notation;
  }, [notation]);

  // Query real browser mic permission status
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.permissions ||
      !navigator.permissions.query
    ) {
      return;
    }
    let mounted = true;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (!mounted) return;
        setPermissionState(status.state);
        status.onchange = () => {
          if (mounted) setPermissionState(status.state);
        };
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (highpassRef.current && audioCtxRef.current) {
      highpassRef.current.frequency.setValueAtTime(
        INSTRUMENT_FILTER_HZ[instrumentProfile],
        audioCtxRef.current.currentTime
      );
    }
  }, [instrumentProfile]);

  const applyPhraseMatch = useCallback(
    (phrase: string, bypassGate = false) => {
      const cleaned = phrase.trim();
      if (!cleaned) return;

      if (!bypassGate) {
        const msSinceVoice = Date.now() - lastVoiceTimestampRef.current;
        if (msSinceVoice > 2400 && noiseGateRef.current > 15) {
          return;
        }
      }

      setLastTranscript(cleaned);

      const match = matchTranscriptToLine(
        cleaned,
        flatLinesRef.current,
        activeLineRef.current
      );

      if (!match) return;

      // Speed brake: prevent bouncing two lines ahead inside < 650ms unless skipping instrumental
      const msOnCurrentLine = Date.now() - lineEnteredTimestampRef.current;
      const lineDiff = match.matchedLineIndex - activeLineRef.current;
      if (lineDiff > 1 && msOnCurrentLine < 650) {
        return;
      }

      lastWordMatchTimestampRef.current = Date.now();
      lineProgressRef.current = match.wordProgress;
      onAdvanceToLine(match.matchedLineIndex, match.wordProgress);
    },
    [onAdvanceToLine]
  );

  const stop = useCallback(() => {
    isListeningRef.current = false;
    wordEngineWorkingRef.current = false;
    setIsListening(false);
    setIsWordEngineActive(false);
    setActiveEngineNote(null);
    setRawLevel(0);
    setVocalLevel(0);
    setDetectedNote(null);
    setDetectedHz(null);
    setPitchClarity(0);
    setIsVoiceActive(false);

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (aiIntervalRef.current !== null) {
      window.clearInterval(aiIntervalRef.current);
      aiIntervalRef.current = null;
    }

    if (tempoIntervalRef.current !== null) {
      window.clearInterval(tempoIntervalRef.current);
      tempoIntervalRef.current = null;
    }

    if (hybridTickRef.current !== null) {
      window.clearInterval(hybridTickRef.current);
      hybridTickRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // ignore abort errors
      }
      recognitionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      highpassRef.current = null;
    }
  }, []);

  /**
   * Hybrid Note + Rhythm Sync Loop:
   * - Uses real sung voice activity (bandpass energy + harmonic pitch clarity)
   * - If the user is parked on an Intro/Tablature line and starts singing, hops to the first sung line
   * - Advances line progress ONLY while actively singing, respecting BPM pace
   * - Holds gently near the end of the line when word-engine is active so it NEVER runs ahead of the singer
   */
  const startHybridCadenceLoop = useCallback(() => {
    if (hybridTickRef.current !== null) {
      window.clearInterval(hybridTickRef.current);
    }

    hybridTickRef.current = window.setInterval(() => {
      if (!isListeningRef.current || modeRef.current !== "hybrid") return;

      const lines = flatLinesRef.current;
      const idx = activeLineRef.current;
      if (idx < 0 || idx >= lines.length) return;

      const current = lines[idx];
      const now = Date.now();
      const msSinceVoice = now - lastVoiceTimestampRef.current;
      const singingNow = msSinceVoice < 380;

      // If parked on Intro/Tablature and real singing starts, jump to first upcoming sung line
      if (singingNow && (current.line.isInstrumental || current.line.isTablature)) {
        const nextSung = lines.findIndex(
          (l, i) => i > idx && !l.line.isInstrumental && !l.line.isTablature
        );
        if (nextSung !== -1) {
          lineProgressRef.current = 0.06;
          onAdvanceToLine(nextSung, 0.06);
        }
        return;
      }

      if (current.line.isInstrumental || current.line.isTablature) return;

      // If word matcher matched very recently (< 800ms), let words drive the exact position!
      const msSinceWordMatch = now - lastWordMatchTimestampRef.current;
      if (wordEngineWorkingRef.current && msSinceWordMatch < 850) {
        return;
      }

      if (!singingNow) {
        // Brief breath pause after finishing >= 88% of a line -> step cleanly to +1 line
        if (
          lineProgressRef.current >= 0.88 &&
          msSinceVoice >= 380 &&
          msSinceVoice <= 950 &&
          now - lineEnteredTimestampRef.current > 1800
        ) {
          let nextIdx = idx + 1;
          while (
            nextIdx < lines.length &&
            (lines[nextIdx].line.isInstrumental || lines[nextIdx].line.isTablature)
          ) {
            nextIdx++;
          }
          if (nextIdx < lines.length) {
            lineProgressRef.current = 0;
            onAdvanceToLine(nextIdx, 0);
          }
        }
        return;
      }

      // Smoothly advance wordProgress while singing, calibrated by syllables & BPM
      const charCount = Math.max(20, current.line.lyrics.trim().length);
      const estimatedLineMs = Math.max(
        2600,
        (charCount / 9.5) * (60000 / Math.max(55, bpmRef.current)) * 2.25
      );
      const step = 120 / estimatedLineMs;
      const nextProgress = Math.min(1, lineProgressRef.current + step);

      // When word engine is working, cap rhythmic drift at 0.90 so words trigger the next line cleanly
      if (wordEngineWorkingRef.current) {
        const capped = Math.min(0.9, nextProgress);
        lineProgressRef.current = capped;
        onAdvanceToLine(idx, capped);
        return;
      }

      // Without word engine (Opera/Firefox), advance +1 line once the line's full sung duration completes
      if (nextProgress >= 1 && now - lineEnteredTimestampRef.current > 2000) {
        let nextIdx = idx + 1;
        while (
          nextIdx < lines.length &&
          (lines[nextIdx].line.isInstrumental || lines[nextIdx].line.isTablature)
        ) {
          nextIdx++;
        }
        if (nextIdx < lines.length) {
          lineProgressRef.current = 0;
          onAdvanceToLine(nextIdx, 0);
        } else {
          lineProgressRef.current = 1;
          onAdvanceToLine(idx, 1);
        }
      } else {
        lineProgressRef.current = nextProgress;
        onAdvanceToLine(idx, nextProgress);
      }
    }, 120);
  }, [onAdvanceToLine]);

  const startAudioMonitor = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "Tu navegador bloqueó el acceso al micrófono (se requiere HTTPS o localhost)."
      );
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    });
    setPermissionState("granted");
    streamRef.current = stream;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);

    const rawAnalyser = ctx.createAnalyser();
    rawAnalyser.fftSize = 256;
    source.connect(rawAnalyser);

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = INSTRUMENT_FILTER_HZ[instrumentProfile];
    highpassRef.current = highpass;

    const vocalBand = ctx.createBiquadFilter();
    vocalBand.type = "bandpass";
    vocalBand.frequency.value = 1100;
    vocalBand.Q.value = 0.65;

    const vocalAnalyser = ctx.createAnalyser();
    vocalAnalyser.fftSize = 256;

    // Larger buffer after high-pass for accurate monophonic pitch detection
    const pitchAnalyser = ctx.createAnalyser();
    pitchAnalyser.fftSize = 2048;

    source.connect(highpass);
    highpass.connect(pitchAnalyser);
    highpass.connect(vocalBand);
    vocalBand.connect(vocalAnalyser);

    const rawData = new Uint8Array(rawAnalyser.frequencyBinCount);
    const vocalData = new Uint8Array(vocalAnalyser.frequencyBinCount);
    const pitchBuffer = new Float32Array(pitchAnalyser.fftSize);

    let frameCounter = 0;

    const tick = () => {
      if (!isListeningRef.current) return;

      rawAnalyser.getByteFrequencyData(rawData);
      vocalAnalyser.getByteFrequencyData(vocalData);

      let rawSum = 0;
      for (let i = 0; i < rawData.length; i++) rawSum += rawData[i];
      const rawAvg = Math.min(100, Math.round((rawSum / rawData.length / 160) * 100));

      let vocalSum = 0;
      for (let i = 0; i < vocalData.length; i++) vocalSum += vocalData[i];
      const vocalAvg = Math.min(
        100,
        Math.round((vocalSum / vocalData.length / 135) * 100)
      );

      setRawLevel(rawAvg);
      setVocalLevel(vocalAvg);

      // Run autocorrelation pitch detection every 2nd frame (~30fps)
      frameCounter++;
      let hasClearVocalPitch = false;
      if (frameCounter % 2 === 0) {
        pitchAnalyser.getFloatTimeDomainData(pitchBuffer);
        const pitch = detectVocalPitch(
          pitchBuffer,
          ctx.sampleRate,
          notationRef.current
        );
        const clarityPct = Math.round(pitch.clarity * 100);
        setPitchClarity(clarityPct);
        if (pitch.noteName && pitch.clarity >= 0.58) {
          setDetectedNote(pitch.noteName);
          setDetectedHz(pitch.frequency);
          hasClearVocalPitch = true;
        } else {
          setDetectedNote(null);
          setDetectedHz(null);
        }
      }

      // Require vocal energy above gate AND either clear vocal pitch or strong vocal burst
      const energyPassed = vocalAvg >= noiseGateRef.current;
      const voiceActiveNow =
        energyPassed && (hasClearVocalPitch || vocalAvg >= noiseGateRef.current + 12);

      setIsVoiceActive(voiceActiveNow);
      if (voiceActiveNow) {
        lastVoiceTimestampRef.current = Date.now();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return stream;
  }, [instrumentProfile]);

  const startWordRecognition = useCallback(() => {
    if (!SpeechRecCtor) {
      wordEngineWorkingRef.current = false;
      setIsWordEngineActive(false);
      if (modeRef.current === "words_only") {
        setErrorMessage(
          "Tu navegador no soporta 'Solo Palabras'. Cambia a 'Híbrido (Letra + Nota + Ritmo)'."
        );
      } else {
        setActiveEngineNote(
          "Seguimiento activo por Nota Musical + Energía Vocal + Ritmo BPM (tu navegador no incluye dictado de palabras)."
        );
      }
      return;
    }

    const launch = () => {
      if (
        !isListeningRef.current ||
        (modeRef.current !== "hybrid" && modeRef.current !== "words_only")
      ) {
        return;
      }

      const rec = new SpeechRecCtor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 2;
      rec.lang = language === "en" ? "en-US" : "es-MX";

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        wordEngineWorkingRef.current = true;
        setIsWordEngineActive(true);

        // Extract finalized words only up to resultIndex, plus the latest interim chunk
        let latestInterim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res?.[0]?.transcript?.trim();
          if (!text) continue;
          if (res.isFinal) {
            const words = text.split(/\s+/);
            finalTailRef.current = [...finalTailRef.current, ...words].slice(-4);
          } else {
            latestInterim = text;
          }
        }

        // Compare ONLY the freshest phrase (last 2 finalized words + current interim)
        const freshPhrase = [
          ...finalTailRef.current.slice(-2),
          latestInterim,
        ]
          .join(" ")
          .trim();

        if (freshPhrase) {
          applyPhraseMatch(freshPhrase);
        }
      };

      rec.onerror = (ev: SpeechRecognitionErrorEventLike) => {
        if (ev.error === "not-allowed") {
          setPermissionState("denied");
          setErrorMessage(
            "Permiso de micrófono denegado. Permite el micrófono en el candado de la URL e inténtalo de nuevo."
          );
          stop();
        } else if (
          ev.error === "network" ||
          ev.error === "service-not-allowed" ||
          ev.error === "language-not-supported"
        ) {
          try {
            rec.onend = null;
            rec.abort();
          } catch {
            // ignore
          }
          recognitionRef.current = null;
          wordEngineWorkingRef.current = false;
          setIsWordEngineActive(false);

          if (modeRef.current === "words_only") {
            setErrorMessage(
              "Este navegador bloqueó el servicio de palabras. Cambia a 'Híbrido (Letra + Nota + Ritmo)'."
            );
            stop();
          } else {
            setActiveEngineNote(
              "Modo Híbrido activo con Nota Musical + Voz DSP + Ritmo (sin servicio externo de palabras en este navegador)."
            );
          }
        }
      };

      rec.onend = () => {
        if (
          isListeningRef.current &&
          (modeRef.current === "hybrid" || modeRef.current === "words_only")
        ) {
          setTimeout(() => {
            if (
              isListeningRef.current &&
              (modeRef.current === "hybrid" || modeRef.current === "words_only")
            ) {
              launch();
            }
          }, 220);
        }
      };

      recognitionRef.current = rec;
      try {
        rec.start();
        wordEngineWorkingRef.current = true;
        setIsWordEngineActive(true);
        setActiveEngineNote(
          modeRef.current === "hybrid"
            ? "Modo Híbrido activo: Palabras + Nota Musical + Ritmo BPM."
            : "Modo Solo Palabras activo: avanza al coincidir tu letra."
        );
      } catch {
        // Ignore already-started
      }
    };

    launch();
  }, [SpeechRecCtor, applyPhraseMatch, language, stop]);

  const startAiAudioClipSync = useCallback(
    (stream: MediaStream) => {
      const preferredMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recordWindow = () => {
        if (!isListeningRef.current || modeRef.current !== "voice_ai") return;

        const chunks: BlobPart[] = [];
        let voiceDetectedDuringChunk = false;

        const checkVoiceInterval = window.setInterval(() => {
          if (Date.now() - lastVoiceTimestampRef.current < 800) {
            voiceDetectedDuringChunk = true;
          }
        }, 250);

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream, { mimeType: preferredMime });
        } catch {
          recorder = new MediaRecorder(stream);
        }

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          window.clearInterval(checkVoiceInterval);
          if (!isListeningRef.current) return;
          if (!voiceDetectedDuringChunk && noiseGateRef.current > 10) {
            return;
          }
          const blob = new Blob(chunks, {
            type: recorder.mimeType || "audio/webm",
          });
          if (blob.size < 1500) return;

          try {
            setIsProcessingAiClip(true);
            const buffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = "";
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64Audio = btoa(binary);

            const res = await fetch("/api/transcribe-clip", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                base64Audio,
                mimeType: (recorder.mimeType || "audio/webm").split(";")[0],
                language,
              }),
            });

            const contentType = res.headers.get("content-type") || "";
            if (res.ok && contentType.includes("application/json")) {
              const data = (await res.json()) as { transcript?: string };
              if (data.transcript) {
                applyPhraseMatch(data.transcript, true);
              }
            } else if (res.status === 404 || res.status === 405) {
              setErrorMessage(
                "El modo 'IA Ruidoso' requiere servidor Node. Usa 'Híbrido (Letra + Nota + Ritmo)' en hosting estático."
              );
              stop();
            }
          } catch (err) {
            console.error("AI audio clip sync failed:", err);
          } finally {
            setIsProcessingAiClip(false);
          }
        };

        recorder.start();
        window.setTimeout(() => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }, 3100);
      };

      recordWindow();
      aiIntervalRef.current = window.setInterval(recordWindow, 3300);
    },
    [applyPhraseMatch, language, stop]
  );

  const startAutoTempo = useCallback(() => {
    setActiveEngineNote("Avance automático por tempo BPM (sin micrófono).");
    const msPerLine = Math.max(2400, Math.round((60000 / Math.max(50, bpm)) * 6));
    tempoIntervalRef.current = window.setInterval(() => {
      if (!isListeningRef.current || modeRef.current !== "auto_tempo") return;
      const next = Math.min(
        flatLinesRef.current.length - 1,
        activeLineRef.current + 1
      );
      onAdvanceToLine(next, 0);
    }, msPerLine);
  }, [bpm, onAdvanceToLine]);

  const start = useCallback(async () => {
    stop();
    setErrorMessage(null);
    setActiveEngineNote(null);
    finalTailRef.current = [];
    lineProgressRef.current = 0;
    lineEnteredTimestampRef.current = Date.now();
    isListeningRef.current = true;
    setIsListening(true);

    if (mode === "auto_tempo") {
      startAutoTempo();
      return;
    }

    try {
      const stream = await startAudioMonitor();
      if (!isListeningRef.current) {
        stop();
        return;
      }

      if (mode === "hybrid") {
        startWordRecognition();
        startHybridCadenceLoop();
      } else if (mode === "words_only") {
        startWordRecognition();
      } else if (mode === "voice_ai") {
        startAiAudioClipSync(stream);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudo acceder al micrófono.";
      if (
        msg.includes("Permission") ||
        msg.includes("NotAllowed") ||
        msg.includes("denied")
      ) {
        setPermissionState("denied");
        setErrorMessage(
          "Permiso de micrófono denegado. Permite el micrófono en el candado de la URL e inténtalo de nuevo."
        );
      } else {
        setErrorMessage(`Error de micrófono: ${msg}`);
      }
      stop();
    }
  }, [
    mode,
    startAiAudioClipSync,
    startAudioMonitor,
    startAutoTempo,
    startHybridCadenceLoop,
    startWordRecognition,
    stop,
  ]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const testPhrase = useCallback(
    (phrase: string) => {
      applyPhraseMatch(phrase, true);
    },
    [applyPhraseMatch]
  );

  return {
    isListening,
    isSpeechSupported,
    isWordEngineActive,
    permissionState,
    activeEngineNote,
    rawLevel,
    vocalLevel,
    detectedNote,
    detectedHz,
    pitchClarity,
    isVoiceActive,
    lastTranscript,
    errorMessage,
    isProcessingAiClip,
    start,
    stop,
    testPhrase,
  };
}
