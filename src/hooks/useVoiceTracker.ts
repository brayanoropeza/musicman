import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatSongLine,
  InstrumentProfile,
  TrackingMode,
} from "../types/song";
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
  mode: TrackingMode;
  instrumentProfile: InstrumentProfile;
  noiseGate: number; // 0..100
}

export interface VoiceTrackerState {
  isListening: boolean;
  isSpeechSupported: boolean;
  permissionState: "prompt" | "granted" | "denied" | "unknown";
  activeEngineNote: string | null;
  rawLevel: number; // 0..100 total mic signal (instrument + voice)
  vocalLevel: number; // 0..100 filtered vocal band energy
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
  mode,
  instrumentProfile,
  noiseGate,
}: UseVoiceTrackerOptions): VoiceTrackerState {
  const [isListening, setIsListening] = useState(false);
  const [permissionState, setPermissionState] = useState<
    "prompt" | "granted" | "denied" | "unknown"
  >("unknown");
  const [activeEngineNote, setActiveEngineNote] = useState<string | null>(null);
  const [rawLevel, setRawLevel] = useState(0);
  const [vocalLevel, setVocalLevel] = useState(0);
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
  const lastVoiceTimestampRef = useRef(0);
  const recentTranscriptBufferRef = useRef("");
  const cadenceProgressRef = useRef(0);
  const cadenceActiveRef = useRef(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const highpassRef = useRef<BiquadFilterNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const aiIntervalRef = useRef<number | null>(null);
  const tempoIntervalRef = useRef<number | null>(null);
  const cadenceIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    activeLineRef.current = activeLineIndex;
    cadenceProgressRef.current = 0;
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

  // Query browser microphone permission status when supported
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
      .catch(() => {
        // Firefox / some browsers don't support querying 'microphone' permission
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Dynamically update high-pass cutoff when switching instrument profile live
  useEffect(() => {
    if (highpassRef.current && audioCtxRef.current) {
      highpassRef.current.frequency.setValueAtTime(
        INSTRUMENT_FILTER_HZ[instrumentProfile],
        audioCtxRef.current.currentTime
      );
    }
  }, [instrumentProfile]);

  const handleTranscriptText = useCallback(
    (incomingText: string, skipGateCheck = false) => {
      const cleaned = incomingText.trim();
      if (!cleaned) return;

      if (!skipGateCheck && modeRef.current === "voice_local") {
        const msSinceVoice = Date.now() - lastVoiceTimestampRef.current;
        if (msSinceVoice > 2600 && noiseGateRef.current > 15) {
          return;
        }
      }

      setLastTranscript(cleaned);
      recentTranscriptBufferRef.current = `${recentTranscriptBufferRef.current} ${cleaned}`
        .trim()
        .split(/\s+/)
        .slice(-14)
        .join(" ");

      const match = matchTranscriptToLine(
        recentTranscriptBufferRef.current,
        flatLinesRef.current,
        activeLineRef.current
      );

      if (match) {
        onAdvanceToLine(match.matchedLineIndex, match.wordProgress);
      }
    },
    [onAdvanceToLine]
  );

  const stop = useCallback(() => {
    isListeningRef.current = false;
    cadenceActiveRef.current = false;
    setIsListening(false);
    setActiveEngineNote(null);
    setRawLevel(0);
    setVocalLevel(0);
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

    if (cadenceIntervalRef.current !== null) {
      window.clearInterval(cadenceIntervalRef.current);
      cadenceIntervalRef.current = null;
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
   * Local DSP Vocal-Cadence Follower:
   * Advances karaoke highlight and scrolls lines ONLY while singing energy exceeds the
   * instrument noise-gate threshold, pausing cleanly during intros, solos, or breaths.
   */
  const startVocalCadenceLoop = useCallback(() => {
    if (cadenceIntervalRef.current !== null) {
      window.clearInterval(cadenceIntervalRef.current);
    }
    cadenceActiveRef.current = true;
    cadenceProgressRef.current = 0;

    cadenceIntervalRef.current = window.setInterval(() => {
      if (!isListeningRef.current || !cadenceActiveRef.current) return;

      const lines = flatLinesRef.current;
      const idx = activeLineRef.current;
      if (idx < 0 || idx >= lines.length) return;

      const current = lines[idx];
      const msSinceVoice = Date.now() - lastVoiceTimestampRef.current;
      const singingNow = msSinceVoice < 420;

      if (!singingNow) return;

      // If parked on an instrumental/tab line and the musician starts singing, jump to next sung line!
      if (current.line.isInstrumental || current.line.isTablature) {
        const nextSung = lines.findIndex(
          (l, i) => i > idx && !l.line.isInstrumental && !l.line.isTablature
        );
        if (nextSung !== -1) {
          cadenceProgressRef.current = 0.08;
          onAdvanceToLine(nextSung, 0.08);
        }
        return;
      }

      // Advance proportional to lyric length and song BPM while voice is active
      const charCount = Math.max(18, current.line.lyrics.trim().length);
      const estimatedLineDurationMs = Math.max(
        2200,
        (charCount / 11) * (60000 / Math.max(60, bpmRef.current)) * 2.1
      );
      const step = 120 / estimatedLineDurationMs;
      const nextProgress = cadenceProgressRef.current + step;

      if (nextProgress >= 1) {
        let nextIdx = idx + 1;
        while (
          nextIdx < lines.length &&
          (lines[nextIdx].line.isInstrumental || lines[nextIdx].line.isTablature)
        ) {
          nextIdx++;
        }
        if (nextIdx < lines.length) {
          cadenceProgressRef.current = 0;
          onAdvanceToLine(nextIdx, 0);
        } else {
          cadenceProgressRef.current = 1;
          onAdvanceToLine(idx, 1);
        }
      } else {
        cadenceProgressRef.current = nextProgress;
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
    vocalBand.frequency.value = 1150;
    vocalBand.Q.value = 0.65;

    const vocalAnalyser = ctx.createAnalyser();
    vocalAnalyser.fftSize = 256;

    source.connect(highpass);
    highpass.connect(vocalBand);
    vocalBand.connect(vocalAnalyser);

    const rawData = new Uint8Array(rawAnalyser.frequencyBinCount);
    const vocalData = new Uint8Array(vocalAnalyser.frequencyBinCount);

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

      const voiceActiveNow = vocalAvg >= noiseGateRef.current;
      setIsVoiceActive(voiceActiveNow);
      if (voiceActiveNow) {
        lastVoiceTimestampRef.current = Date.now();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return stream;
  }, [instrumentProfile]);

  const startLocalSpeech = useCallback(() => {
    if (!SpeechRecCtor) {
      setActiveEngineNote(
        "Este navegador no incluye reconocimiento de palabras; usando detección vocal DSP por micrófono."
      );
      startVocalCadenceLoop();
      return;
    }

    setActiveEngineNote("Reconocimiento de palabras en vivo activo.");

    const launch = () => {
      if (!isListeningRef.current || modeRef.current !== "voice_local") return;
      const rec = new SpeechRecCtor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 2;
      rec.lang = language === "en" ? "en-US" : "es-MX";

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        let combined = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result && result[0]) {
            combined += " " + result[0].transcript;
          }
        }
        if (combined.trim()) {
          handleTranscriptText(combined.trim());
        }
      };

      rec.onerror = (ev: SpeechRecognitionErrorEventLike) => {
        if (ev.error === "not-allowed") {
          setPermissionState("denied");
          setErrorMessage(
            "Permiso de micrófono denegado. Haz clic en el icono de candado/micrófono en la barra de dirección para permitirlo."
          );
          stop();
        } else if (
          ev.error === "network" ||
          ev.error === "service-not-allowed" ||
          ev.error === "language-not-supported"
        ) {
          // Browsers like Opera/Brave/Firefox disable Google SpeechRecognition stub;
          // fall back seamlessly to real-mic DSP vocal cadence tracking!
          try {
            rec.onend = null;
            rec.abort();
          } catch {
            // ignore
          }
          recognitionRef.current = null;
          setActiveEngineNote(
            "Navegador sin servicio de dictado externo: activado seguimiento vocal DSP por micrófono."
          );
          startVocalCadenceLoop();
        }
      };

      rec.onend = () => {
        if (
          isListeningRef.current &&
          modeRef.current === "voice_local" &&
          !cadenceActiveRef.current
        ) {
          setTimeout(() => {
            if (
              isListeningRef.current &&
              modeRef.current === "voice_local" &&
              !cadenceActiveRef.current
            ) {
              launch();
            }
          }, 200);
        }
      };

      recognitionRef.current = rec;
      try {
        rec.start();
      } catch {
        // Ignore already-started errors
      }
    };

    launch();
  }, [SpeechRecCtor, handleTranscriptText, language, startVocalCadenceLoop, stop]);

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
                handleTranscriptText(data.transcript, true);
              }
            } else if (res.status === 404 || res.status === 405) {
              setActiveEngineNote(
                "Servidor IA no disponible en hosting estático: usando seguimiento vocal DSP por micrófono."
              );
              startVocalCadenceLoop();
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
    [handleTranscriptText, language, startVocalCadenceLoop]
  );

  const startAutoTempo = useCallback(() => {
    setActiveEngineNote("Avance automático por tempo (sin micrófono).");
    const msPerLine = Math.max(2200, Math.round((60000 / Math.max(50, bpm)) * 6));
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
    recentTranscriptBufferRef.current = "";
    isListeningRef.current = true;
    setIsListening(true);

    if (mode === "auto_tempo") {
      startAutoTempo();
      return;
    }

    try {
      // Triggers native browser microphone permission prompt immediately on click
      const stream = await startAudioMonitor();
      if (!isListeningRef.current) {
        stop();
        return;
      }

      if (mode === "voice_local") {
        startLocalSpeech();
      } else if (mode === "vocal_cadence") {
        setActiveEngineNote(
          "Seguimiento vocal DSP activo: canta por encima del umbral para avanzar."
        );
        startVocalCadenceLoop();
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
          "Permiso de micrófono denegado. Permite el micrófono en el candado de la URL del navegador e inténtalo de nuevo."
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
    startLocalSpeech,
    startVocalCadenceLoop,
    stop,
  ]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const testPhrase = useCallback(
    (phrase: string) => {
      handleTranscriptText(phrase, true);
    },
    [handleTranscriptText]
  );

  return {
    isListening,
    isSpeechSupported,
    permissionState,
    activeEngineNote,
    rawLevel,
    vocalLevel,
    isVoiceActive,
    lastTranscript,
    errorMessage,
    isProcessingAiClip,
    start,
    stop,
    testPhrase,
  };
}
