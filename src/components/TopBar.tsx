import { AppView } from "../types/song";

interface TopBarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  onToggleSidebar: () => void;
  onOpenImportModal: (initialTab: "pdf" | "paste" | "combine") => void;
}

export function TopBar({
  activeView,
  onSelectView,
  onToggleSidebar,
  onOpenImportModal,
}: TopBarProps) {
  return (
    <header className="h-16 shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 sm:px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single-element brand wordmark */}
      <a
        href="#escenario"
        onClick={(e) => {
          e.preventDefault();
          onSelectView("stage");
        }}
        className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 whitespace-nowrap shrink-0"
      >
        AtrilVivo
      </a>

      {/* Zone 2: Clean single-line navigation links */}
      <nav
        aria-label="Navegación principal"
        className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-zinc-400"
      >
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hover:text-slate-900 dark:hover:text-zinc-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Repertorio
        </button>
        <button
          type="button"
          onClick={() => onSelectView("stage")}
          className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer underline-offset-4 ${
            activeView === "stage"
              ? "text-slate-900 dark:text-zinc-50 underline"
              : "hover:text-slate-900 dark:hover:text-zinc-100 hover:underline"
          }`}
        >
          Escenario
        </button>
        <button
          type="button"
          onClick={() => onSelectView("calibrate")}
          className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer underline-offset-4 ${
            activeView === "calibrate"
              ? "text-slate-900 dark:text-zinc-50 underline"
              : "hover:text-slate-900 dark:hover:text-zinc-100 hover:underline"
          }`}
        >
          Calibración
        </button>
        <button
          type="button"
          onClick={() => onOpenImportModal("paste")}
          className="hover:text-slate-900 dark:hover:text-zinc-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Pegar Letra
        </button>
      </nav>

      {/* Zone 3: Single primary action CTA */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => onOpenImportModal("pdf")}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Subir PDF
        </button>
      </div>
    </header>
  );
}
