import { useMemo, useState } from "react";
import { FileText, Music, Plus, Search, Trash2, X } from "lucide-react";
import { NotationSystem, Song } from "../types/song";
import { formatKeyName } from "../utils/chords";

interface SetlistSidebarProps {
  songs: Song[];
  activeSongId: string;
  transposeBySong: Record<string, number>;
  notation: NotationSystem;
  isOpen: boolean;
  onCloseMobile: () => void;
  onSelectSong: (songId: string) => void;
  onDeleteSong: (songId: string) => void;
  onOpenImportModal: (tab: "pdf" | "paste" | "combine") => void;
}

export function SetlistSidebar({
  songs,
  activeSongId,
  transposeBySong,
  notation,
  isOpen,
  onCloseMobile,
  onSelectSong,
  onDeleteSong,
  onOpenImportModal,
}: SetlistSidebarProps) {
  const [query, setQuery] = useState("");

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q)
    );
  }, [songs, query]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        aria-label="Repertorio de canciones"
        className={`${
          isOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
        } fixed lg:static inset-y-0 left-0 z-40 w-[280px] shrink-0 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col transition-transform duration-200`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-zinc-100">
            Repertorio
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenImportModal("combine")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Crear o combinar notas y letra"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva
            </button>
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer"
              aria-label="Cerrar repertorio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3 border-b border-slate-200 dark:border-zinc-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar canción o artista..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto stage-scroll divide-y divide-slate-100 dark:divide-zinc-900">
          {filteredSongs.length === 0 ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                No hay canciones que coincidan con tu búsqueda.
              </p>
              <button
                type="button"
                onClick={() => onOpenImportModal("pdf")}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-zinc-800 text-white dark:text-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-700 cursor-pointer"
              >
                Importar PDF o letra
              </button>
            </div>
          ) : (
            filteredSongs.map((song) => {
              const isActive = song.id === activeSongId;
              const semitones = transposeBySong[song.id] ?? 0;
              const displayKey = formatKeyName(
                song.originalKey,
                semitones,
                notation
              );

              return (
                <div
                  key={song.id}
                  className={`group flex items-center justify-between gap-2 px-4 py-3 transition-colors ${
                    isActive
                      ? "bg-amber-500/10 dark:bg-amber-500/10"
                      : "hover:bg-slate-50 dark:hover:bg-zinc-900/70"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSong(song.id);
                      onCloseMobile();
                    }}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {song.source === "pdf" ? (
                        <FileText className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Music className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-zinc-500" />
                      )}
                      <span
                        className={`text-sm font-medium truncate ${
                          isActive
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-slate-900 dark:text-zinc-100"
                        }`}
                      >
                        {song.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 truncate">
                      <span className="truncate">{song.artist}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-700 dark:text-zinc-300 shrink-0">
                        {displayKey}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono shrink-0">{song.bpm} BPM</span>
                    </div>
                  </button>

                  {song.source !== "sample" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSong(song.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-opacity cursor-pointer"
                      aria-label={`Eliminar ${song.title}`}
                      title="Eliminar canción"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-zinc-800 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenImportModal("pdf")}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap cursor-pointer"
          >
            Subir PDF
          </button>
          <button
            type="button"
            onClick={() => onOpenImportModal("combine")}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap cursor-pointer"
          >
            Notas + Letra
          </button>
        </div>
      </aside>
    </>
  );
}
