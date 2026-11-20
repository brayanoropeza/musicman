import { useRef, useState } from "react";
import { FileUp, Loader2, Sparkles, X } from "lucide-react";
import { Song } from "../types/song";
import { parseLaCuerdaText } from "../utils/chords";

interface ImportModalProps {
  isOpen: boolean;
  initialTab: "pdf" | "paste" | "combine";
  onClose: () => void;
  onImportSong: (song: Song) => void;
}

interface ParsedSongPayload {
  title?: string;
  artist?: string;
  originalKey?: string;
  bpm?: number;
  language?: "es" | "en";
  sections?: Array<{
    name?: string;
    lines?: Array<{
      lyrics?: string;
      isInstrumental?: boolean;
      chords?: Array<{ chord?: string; column?: number }>;
    }>;
  }>;
}

function hydrateServerSong(
  raw: ParsedSongPayload,
  source: "pdf" | "lacuerda"
): Song {
  const mkId = (p: string) =>
    `${p}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    id: mkId("song"),
    title: raw.title?.trim() || "Canción sin título",
    artist: raw.artist?.trim() || "Desconocido",
    originalKey: raw.originalKey?.trim() || "C",
    bpm: typeof raw.bpm === "number" && raw.bpm > 40 ? raw.bpm : 100,
    language: raw.language === "en" ? "en" : "es",
    source,
    createdAt: new Date().toISOString(),
    sections: (raw.sections || []).map((sec) => ({
      id: mkId("sec"),
      name: sec.name?.trim() || "Sección",
      lines: (sec.lines || []).map((l) => ({
        id: mkId("line"),
        lyrics: l.lyrics ?? "",
        isInstrumental: Boolean(l.isInstrumental),
        chords: (l.chords || [])
          .filter((c) => c.chord && c.chord.trim().length > 0)
          .map((c) => ({
            chord: c.chord!.trim(),
            column: Math.max(0, Number(c.column) || 0),
          })),
      })),
    })),
  };
}

export function ImportModal({
  isOpen,
  initialTab,
  onClose,
  onImportSong,
}: ImportModalProps) {
  const [tab, setTab] = useState<"pdf" | "paste" | "combine">(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Paste tab state
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteArtist, setPasteArtist] = useState("");
  const [pasteText, setPasteText] = useState("");

  // Combine Notes + Lyrics tab state
  const [combineTitle, setCombineTitle] = useState("");
  const [combineArtist, setCombineArtist] = useState("");
  const [combineKey, setCombineKey] = useState("");
  const [chordsOnlyText, setChordsOnlyText] = useState("");
  const [lyricsOnlyText, setLyricsOnlyText] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handlePdfFile = async (file: File) => {
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Por favor selecciona un archivo en formato PDF.");
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      const res = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: "application/pdf",
          base64Data,
        }),
      });

      const data = (await res.json()) as {
        song?: ParsedSongPayload;
        error?: string;
      };

      if (!res.ok || !data.song) {
        throw new Error(data.error || "No se pudo leer el PDF.");
      }

      const hydrated = hydrateServerSong(data.song, "pdf");
      onImportSong(hydrated);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Error inesperado al analizar el PDF."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPasteImport = () => {
    if (!pasteText.trim()) {
      setError("Pega primero la letra o tablatura de tu canción.");
      return;
    }
    setError(null);
    const parsed = parseLaCuerdaText(pasteText, {
      title: pasteTitle,
      artist: pasteArtist,
    });
    onImportSong(parsed);
    onClose();
  };

  const handleAiPasteImport = async () => {
    if (!pasteText.trim()) {
      setError("Pega primero la letra o tablatura de tu canción.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: pasteText }),
      });
      const data = (await res.json()) as {
        song?: ParsedSongPayload;
        error?: string;
      };
      if (!res.ok || !data.song) {
        throw new Error(data.error || "No se pudo estructurar el texto.");
      }
      const hydrated = hydrateServerSong(data.song, "lacuerda");
      if (pasteTitle.trim()) hydrated.title = pasteTitle.trim();
      if (pasteArtist.trim()) hydrated.artist = pasteArtist.trim();
      onImportSong(hydrated);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al analizar el texto."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCombineImport = async () => {
    if (!chordsOnlyText.trim() && !lyricsOnlyText.trim()) {
      setError("Escribe o pega al menos tus acordes o la letra de la canción.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/align-chords-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: combineTitle,
          artist: combineArtist,
          originalKey: combineKey,
          chordsText: chordsOnlyText,
          lyricsText: lyricsOnlyText,
        }),
      });
      const data = (await res.json()) as {
        song?: ParsedSongPayload;
        error?: string;
      };
      if (!res.ok || !data.song) {
        throw new Error(
          data.error || "No se pudieron alinear los acordes con la letra."
        );
      }
      const hydrated = hydrateServerSong(data.song, "lacuerda");
      onImportSong(hydrated);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al combinar las notas y la letra."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-4">
          <h2
            id="import-modal-title"
            className="font-display text-lg font-bold text-slate-900 dark:text-zinc-50"
          >
            Importar canción al atril
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-6 pt-4 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setTab("pdf");
              setError(null);
            }}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === "pdf"
                ? "border-amber-500 text-amber-700 dark:text-amber-400"
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            Subir PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("paste");
              setError(null);
            }}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === "paste"
                ? "border-amber-500 text-amber-700 dark:text-amber-400"
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            Pegar Letra / Tablatura
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("combine");
              setError(null);
            }}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === "combine"
                ? "border-amber-500 text-amber-700 dark:text-amber-400"
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            Combinar Notas + Letra
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto stage-scroll">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {tab === "pdf" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Sube un PDF descargado de LaCuerda, Ultimate Guitar o tu
                cancionero personal. Extraemos letra, secciones y la posición
                exacta de cada acorde para poder transportarlos a tu voz.
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handlePdfFile(file);
                }}
                onClick={() => !isLoading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-slate-300 dark:border-zinc-700 hover:border-amber-500/70 bg-slate-50 dark:bg-zinc-900/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePdfFile(file);
                  }}
                />
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                      Leyendo acordes y letra del PDF...
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Alineando columnas y secciones automáticamente.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FileUp className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        Arrastra tu PDF aquí o haz clic para buscarlo
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        Compatible con cifrado americano (C, G, Am) y latino (Do, Sol, Lam)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "paste" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Pega letra y acordes copiados desde cualquier aplicación (LaCuerda,
                Notas, WhatsApp o tablaturas propias).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="Título de la canción"
                  className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={pasteArtist}
                  onChange={(e) => setPasteArtist(e.target.value)}
                  placeholder="Artista (opcional)"
                  className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <textarea
                rows={9}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`Ejemplo:\n[Verso 1]\nDo              Sol7\nDe la Sierra Morena, cielito lindo\n                  Do\nvienen bajando...`}
                className="w-full p-3 font-mono text-xs sm:text-sm rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
              />

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleQuickPasteImport}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer disabled:opacity-50"
                >
                  Importar directo
                </button>
                <button
                  type="button"
                  onClick={handleAiPasteImport}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Estructurar con IA
                </button>
              </div>
            </div>
          )}

          {tab === "combine" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                ¿Tienes los acordes anotados aparte y copiaste solo la letra en
                otra app? Pega cada parte por separado y las alineamos en una
                hoja lista para cantar.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={combineTitle}
                  onChange={(e) => setCombineTitle(e.target.value)}
                  placeholder="Título"
                  className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={combineArtist}
                  onChange={(e) => setCombineArtist(e.target.value)}
                  placeholder="Artista (opcional)"
                  className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={combineKey}
                  onChange={(e) => setCombineKey(e.target.value)}
                  placeholder="Tono base (ej. Sol, Am)"
                  className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                    Tus notas / progresión de acordes
                  </label>
                  <textarea
                    rows={8}
                    value={chordsOnlyText}
                    onChange={(e) => setChordsOnlyText(e.target.value)}
                    placeholder={`Ej:\nIntro: Lam - Rem - Mi7\nVerso: Lam, Rem, Sol, Do\nCoro: Fa - Sol - Do - Lam`}
                    className="w-full p-3 font-mono text-xs rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                    Letra copiada (opcional si solo tienes acordes)
                  </label>
                  <textarea
                    rows={8}
                    value={lyricsOnlyText}
                    onChange={(e) => setLyricsOnlyText(e.target.value)}
                    placeholder={`Pega aquí la letra limpia sin acordes...`}
                    className="w-full p-3 text-xs sm:text-sm rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCombineImport}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Combinar y crear hoja
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
