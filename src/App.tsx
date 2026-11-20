import { useCallback, useEffect, useMemo, useState } from "react";
import { EditSongModal } from "./components/EditSongModal";
import { ImportModal } from "./components/ImportModal";
import { MicCalibrationView } from "./components/MicCalibrationView";
import { SetlistSidebar } from "./components/SetlistSidebar";
import { TeleprompterStage } from "./components/TeleprompterStage";
import { TopBar } from "./components/TopBar";
import { VoiceConsole } from "./components/VoiceConsole";
import { SAMPLE_SONGS } from "./data/sampleSongs";
import { useVoiceTracker } from "./hooks/useVoiceTracker";
import {
  AppView,
  InstrumentProfile,
  NotationSystem,
  Song,
  StageDisplayMode,
  TrackingMode,
} from "./types/song";
import { flattenSongLines } from "./utils/chords";

const STORAGE_SONGS_KEY = "atrilvivo_songs_v1";
const STORAGE_TRANSPOSE_KEY = "atrilvivo_transpose_v1";
const STORAGE_PREFS_KEY = "atrilvivo_prefs_v1";

interface SavedPrefs {
  notation: NotationSystem;
  displayMode: StageDisplayMode;
  showScaleGuide: boolean;
  fontSizePx: number;
  isDarkMode: boolean;
  instrumentProfile: InstrumentProfile;
  noiseGate: number;
  mode: TrackingMode;
}

const DEFAULT_PREFS: SavedPrefs = {
  notation: "american",
  displayMode: "chords_tabs",
  showScaleGuide: true,
  fontSizePx: 28,
  isDarkMode: true,
  instrumentProfile: "acoustic_guitar",
  noiseGate: 22,
  mode: "voice_local",
};

function loadInitialSongs(): Song[] {
  try {
    const raw = localStorage.getItem(STORAGE_SONGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Song[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return SAMPLE_SONGS;
}

function loadInitialPrefs(): SavedPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_PREFS_KEY);
    if (raw) {
      return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<SavedPrefs>) };
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_PREFS;
}

function loadInitialTranspose(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_TRANSPOSE_KEY);
    if (raw) {
      return JSON.parse(raw) as Record<string, number>;
    }
  } catch {
    // ignore
  }
  return {};
}

export default function App() {
  const [songs, setSongs] = useState<Song[]>(loadInitialSongs);
  const [activeSongId, setActiveSongId] = useState<string>(
    () => loadInitialSongs()[0]?.id || SAMPLE_SONGS[0].id
  );
  const [transposeBySong, setTransposeBySong] =
    useState<Record<string, number>>(loadInitialTranspose);

  const [prefs, setPrefs] = useState<SavedPrefs>(loadInitialPrefs);
  const [activeView, setActiveView] = useState<AppView>("stage");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [importModalTab, setImportModalTab] = useState<
    "pdf" | "paste" | "combine" | null
  >(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [wordProgress, setWordProgress] = useState(0);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [prefs.isDarkMode]);

  // Persist songs, transpose map, and prefs
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SONGS_KEY, JSON.stringify(songs));
    } catch {
      // ignore quota errors
    }
  }, [songs]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_TRANSPOSE_KEY,
        JSON.stringify(transposeBySong)
      );
    } catch {
      // ignore
    }
  }, [transposeBySong]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  const activeSong = useMemo(() => {
    return songs.find((s) => s.id === activeSongId) || songs[0] || SAMPLE_SONGS[0];
  }, [songs, activeSongId]);

  const flatLines = useMemo(() => flattenSongLines(activeSong), [activeSong]);

  const handleAdvanceToLine = useCallback(
    (lineIdx: number, progress: number) => {
      const clamped = Math.max(0, Math.min(flatLines.length - 1, lineIdx));
      setActiveLineIndex(clamped);
      setWordProgress(progress);
    },
    [flatLines.length]
  );

  // If SpeechRecognition isn't supported in the browser, fall back smoothly to local DSP vocal tracking
  const effectiveMode: TrackingMode = useMemo(() => {
    if (
      prefs.mode === "voice_local" &&
      typeof window !== "undefined" &&
      !("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      return "vocal_cadence";
    }
    return prefs.mode;
  }, [prefs.mode]);

  const tracker = useVoiceTracker({
    flatLines,
    activeLineIndex,
    onAdvanceToLine: handleAdvanceToLine,
    language: activeSong.language,
    bpm: activeSong.bpm,
    mode: effectiveMode,
    instrumentProfile: prefs.instrumentProfile,
    noiseGate: prefs.noiseGate,
  });

  // Reset active line when changing song
  const handleSelectSong = useCallback(
    (songId: string) => {
      setActiveSongId(songId);
      setActiveLineIndex(0);
      setWordProgress(0);
      setActiveView("stage");
      if (tracker.isListening) {
        tracker.stop();
      }
    },
    [tracker]
  );

  const handleImportSong = useCallback((newSong: Song) => {
    setSongs((prev) => [newSong, ...prev]);
    setActiveSongId(newSong.id);
    setActiveLineIndex(0);
    setWordProgress(0);
    setActiveView("stage");
  }, []);

  const handleDeleteSong = useCallback(
    (songId: string) => {
      setSongs((prev) => {
        const next = prev.filter((s) => s.id !== songId);
        if (next.length === 0) return SAMPLE_SONGS;
        if (songId === activeSongId) {
          setActiveSongId(next[0].id);
          setActiveLineIndex(0);
          setWordProgress(0);
        }
        return next;
      });
    },
    [activeSongId]
  );

  const handleSaveEditedSong = useCallback((updated: Song) => {
    setSongs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen((prev) => !prev));
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Keyboard & Bluetooth foot-pedal shortcuts on Stage
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (importModalTab || isEditModalOpen || activeView !== "stage") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        setWordProgress(0);
        setActiveLineIndex((prev) => Math.min(flatLines.length - 1, prev + 1));
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        setWordProgress(0);
        setActiveLineIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === " " || e.key.toLowerCase() === "m") {
        e.preventDefault();
        if (tracker.isListening) tracker.stop();
        else tracker.start();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeView, flatLines.length, importModalTab, isEditModalOpen, tracker]);

  const sampleLyricLine = useMemo(() => {
    const firstSung = flatLines.find((f) => !f.line.isInstrumental && f.line.lyrics.trim());
    return firstSung?.line.lyrics || "De la Sierra Morena, cielito lindo";
  }, [flatLines]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100">
      {!isFullscreen && (
        <TopBar
          activeView={activeView}
          onSelectView={setActiveView}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onOpenImportModal={(tab) => setImportModalTab(tab)}
        />
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {!isFullscreen && (
          <SetlistSidebar
            songs={songs}
            activeSongId={activeSong.id}
            transposeBySong={transposeBySong}
            notation={prefs.notation}
            isOpen={isSidebarOpen}
            onCloseMobile={() => setIsSidebarOpen(false)}
            onSelectSong={handleSelectSong}
            onDeleteSong={handleDeleteSong}
            onOpenImportModal={(tab) => setImportModalTab(tab)}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {activeView === "stage" ? (
            <>
              <VoiceConsole
                tracker={tracker}
                mode={effectiveMode}
                onChangeMode={(mode) => {
                  if (tracker.isListening) tracker.stop();
                  setPrefs((p) => ({ ...p, mode }));
                }}
                instrumentProfile={prefs.instrumentProfile}
                onChangeInstrument={(instrumentProfile) =>
                  setPrefs((p) => ({ ...p, instrumentProfile }))
                }
                noiseGate={prefs.noiseGate}
                onChangeNoiseGate={(noiseGate) =>
                  setPrefs((p) => ({ ...p, noiseGate }))
                }
                onOpenCalibration={() => setActiveView("calibrate")}
              />
              <TeleprompterStage
                song={activeSong}
                flatLines={flatLines}
                activeLineIndex={activeLineIndex}
                wordProgress={wordProgress}
                transposeSemitones={transposeBySong[activeSong.id] ?? 0}
                onChangeTranspose={(val) =>
                  setTransposeBySong((prev) => ({
                    ...prev,
                    [activeSong.id]: val,
                  }))
                }
                notation={prefs.notation}
                onChangeNotation={(notation) =>
                  setPrefs((p) => ({ ...p, notation }))
                }
                displayMode={prefs.displayMode}
                onChangeDisplayMode={(displayMode) =>
                  setPrefs((p) => ({ ...p, displayMode }))
                }
                showScaleGuide={prefs.showScaleGuide}
                onToggleScaleGuide={() =>
                  setPrefs((p) => ({
                    ...p,
                    showScaleGuide: !p.showScaleGuide,
                  }))
                }
                fontSizePx={prefs.fontSizePx}
                onChangeFontSize={(fontSizePx) =>
                  setPrefs((p) => ({ ...p, fontSizePx }))
                }
                isDarkMode={prefs.isDarkMode}
                onToggleTheme={() =>
                  setPrefs((p) => ({ ...p, isDarkMode: !p.isDarkMode }))
                }
                isFullscreen={isFullscreen}
                onToggleFullscreen={handleToggleFullscreen}
                onSelectLine={(idx) => {
                  setActiveLineIndex(idx);
                  setWordProgress(0);
                }}
                onEditSong={() => setIsEditModalOpen(true)}
                isListening={tracker.isListening}
              />
            </>
          ) : (
            <MicCalibrationView
              tracker={tracker}
              instrumentProfile={prefs.instrumentProfile}
              onChangeInstrument={(instrumentProfile) =>
                setPrefs((p) => ({ ...p, instrumentProfile }))
              }
              noiseGate={prefs.noiseGate}
              onChangeNoiseGate={(noiseGate) =>
                setPrefs((p) => ({ ...p, noiseGate }))
              }
              mode={effectiveMode}
              onChangeMode={(mode) => {
                if (tracker.isListening) tracker.stop();
                setPrefs((p) => ({ ...p, mode }));
              }}
              sampleLine={sampleLyricLine}
              onBackToStage={() => setActiveView("stage")}
            />
          )}
        </main>
      </div>

      {importModalTab && (
        <ImportModal
          isOpen={true}
          initialTab={importModalTab}
          onClose={() => setImportModalTab(null)}
          onImportSong={handleImportSong}
        />
      )}

      {isEditModalOpen && (
        <EditSongModal
          song={activeSong}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveEditedSong}
        />
      )}
    </div>
  );
}
