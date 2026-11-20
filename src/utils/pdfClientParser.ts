import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Song } from "../types/song";
import { parseLaCuerdaText } from "./chords";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

/**
 * Extracts text from a PDF file directly in the browser using pdfjs-dist,
 * preserving X/Y column alignment so chords above lyrics and ASCII tablatures
 * parse accurately even when hosted statically (e.g. GitHub Pages) without a backend.
 */
export async function parsePdfLocally(file: File): Promise<Song> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageBlocks: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items: PositionedItem[] = [];
    for (const rawItem of textContent.items) {
      if (!("str" in rawItem)) continue;
      const str = rawItem.str;
      if (!str || !str.trim()) continue;
      const transform = rawItem.transform as number[];
      items.push({
        str,
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
        width: rawItem.width ?? str.length * 5,
      });
    }

    // Group items into horizontal lines (Y descending in PDF coordinate space)
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const lines: PositionedItem[][] = [];
    for (const item of items) {
      const lastLine = lines[lines.length - 1];
      if (!lastLine || Math.abs(lastLine[0].y - item.y) > 4.5) {
        lines.push([item]);
      } else {
        lastLine.push(item);
      }
    }

    // Estimate average character width from items to preserve chord column offsets
    let totalChars = 0;
    let totalWidth = 0;
    for (const item of items) {
      if (item.str.trim().length > 2 && item.width > 0) {
        totalChars += item.str.length;
        totalWidth += item.width;
      }
    }
    const charWidth = totalChars > 0 ? Math.max(4.2, totalWidth / totalChars) : 5.5;
    const minX = items.reduce((m, it) => Math.min(m, it.x), Infinity);
    const baseX = Number.isFinite(minX) ? minX : 0;

    const reconstructedLines = lines.map((lineItems) => {
      lineItems.sort((a, b) => a.x - b.x);
      let lineText = "";
      for (const item of lineItems) {
        const targetCol = Math.max(
          lineText.length + (lineText.length > 0 ? 1 : 0),
          Math.round((item.x - baseX) / charWidth)
        );
        const spaces = Math.max(0, targetCol - lineText.length);
        lineText += " ".repeat(spaces) + item.str;
      }
      return lineText.trimEnd();
    });

    pageBlocks.push(reconstructedLines.join("\n"));
  }

  const combinedText = pageBlocks.join("\n\n").trim();
  if (!combinedText) {
    throw new Error(
      "Este PDF parece ser una imagen escaneada sin texto seleccionable. Para PDFs escaneados se requiere el servidor con IA."
    );
  }

  const baseTitle = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const parsed = parseLaCuerdaText(combinedText, {
    title: baseTitle || "Canción desde PDF",
  });

  return {
    ...parsed,
    source: "pdf",
  };
}
