import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY no está configurada en las variables de entorno."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const songResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Título de la canción.",
    },
    artist: {
      type: Type.STRING,
      description: "Artista o compositor (si aparece en el documento, si no 'Desconocido').",
    },
    originalKey: {
      type: Type.STRING,
      description: "Tonalidad principal en cifrado americano (ej. 'G', 'Am', 'C', 'F#m').",
    },
    bpm: {
      type: Type.INTEGER,
      description: "Tempo estimado en pulsaciones por minuto (entre 60 y 180).",
    },
    language: {
      type: Type.STRING,
      description: "Idioma principal de la letra: 'es' para español, 'en' para inglés.",
    },
    sections: {
      type: Type.ARRAY,
      description: "Secciones ordenadas de la canción.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Nombre de la sección (ej. 'Intro', 'Verso 1', 'Coro', 'Puente', 'Solo', 'Final').",
          },
          lines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                lyrics: {
                  type: Type.STRING,
                  description: "Texto de la línea de letra. Para líneas puramente instrumentales sin letra, usa cadena vacía '' o una nota breve como '(Solo de guitarra)'.",
                },
                isInstrumental: {
                  type: Type.BOOLEAN,
                  description: "true si la línea es solo instrumental (intro, solo, interludio o tablatura sin canto).",
                },
                isTablature: {
                  type: Type.BOOLEAN,
                  description: "true si la línea contiene un bloque de tablatura ASCII de guitarra/bajo (e|---, B|---, G|---, etc.).",
                },
                tabLines: {
                  type: Type.ARRAY,
                  description: "Líneas de tablatura ASCII agrupadas (ej. las 6 cuerdas e, B, G, D, A, E) cuando isTablature es true.",
                  items: {
                    type: Type.STRING,
                  },
                },
                chords: {
                  type: Type.ARRAY,
                  description: "Acordes que van encima de esta línea, convertidos a cifrado americano estándar (C, D, Em, G7, F#m, Bb, etc.).",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      chord: {
                        type: Type.STRING,
                        description: "Nombre del acorde en cifrado americano (ej. 'Am7', 'G/B', 'D7').",
                      },
                      column: {
                        type: Type.INTEGER,
                        description: "Índice de carácter (base 0) en la cadena lyrics donde se ubica el inicio del acorde.",
                      },
                    },
                    required: ["chord", "column"],
                  },
                },
              },
              required: ["lyrics", "isInstrumental", "chords"],
            },
          },
        },
        required: ["name", "lines"],
      },
    },
  },
  required: ["title", "artist", "originalKey", "bpm", "language", "sections"],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/parse-pdf", async (req, res) => {
    try {
      const { base64Data, mimeType, fileName } = req.body as {
        base64Data?: string;
        mimeType?: string;
        fileName?: string;
      };

      if (!base64Data || !mimeType) {
        res.status(400).json({ error: "Falta el archivo PDF para analizar." });
        return;
      }

      const ai = getGeminiClient();

      const prompt = `Eres un transcriptor musical experto en partituras de guitarra y cancioneros de LaCuerda.net.
Analiza este PDF (${fileName || "cancion.pdf"}) y extrae la canción completa de forma ordenada.

Reglas estrictas:
1. Si el PDF tiene dos columnas o múltiples páginas, léelo en el orden musical correcto (columna izquierda de arriba a abajo, luego columna derecha, página por página).
2. Conserva TODA la letra completa sin resumir ni omitir estrofas o coros repetidos.
3. Convierte cualquier acorde en cifrado latino (Do, Re, Mi, Fa, Sol, La, Si, Do#m, Lam7, Sol7) a cifrado americano estándar (C, D, E, F, G, A, B, C#m, Am7, G7).
4. Calcula con precisión el índice 'column' (base 0) de cada acorde respecto a la línea de 'lyrics' que está justo debajo, para que al renderizarlo el acorde caiga exactamente sobre la sílaba correcta.
5. Marca 'isInstrumental': true en líneas de Intro, Solo, Interludio o compases de puro acorde sin canto.
6. No inventes versos que no existan en el documento.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: songResponseSchema,
        },
      });

      const rawJson = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawJson);
      res.json({ song: parsed });
    } catch (err: unknown) {
      console.error("Error parsing PDF with Gemini:", err);
      const message =
        err instanceof Error ? err.message : "Error inesperado al procesar el PDF.";
      const status =
        message.includes("API_KEY") || message.includes("PERMISSION_DENIED")
          ? 403
          : message.includes("RESOURCE_EXHAUSTED")
          ? 429
          : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/parse-text", async (req, res) => {
    try {
      const { rawText } = req.body as { rawText?: string };
      if (!rawText || !rawText.trim()) {
        res.status(400).json({ error: "El texto de la canción está vacío." });
        return;
      }

      const ai = getGeminiClient();

      const prompt = `Convierte el siguiente texto de canción (estilo LaCuerda.net o cancionero) en estructura JSON limpia.
Convierte acordes latinos (Do, Re, Mim, Sol7) a cifrado americano (C, D, Em, G7) y calcula la columna exacta (base 0) de cada acorde sobre la letra.

Texto:
${rawText}`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: songResponseSchema,
        },
      });

      const rawJson = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawJson);
      res.json({ song: parsed });
    } catch (err: unknown) {
      console.error("Error parsing text with Gemini:", err);
      const message =
        err instanceof Error ? err.message : "Error al analizar el texto.";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/align-chords-lyrics", async (req, res) => {
    try {
      const { chordsText, lyricsText, title, artist, originalKey } = req.body as {
        chordsText?: string;
        lyricsText?: string;
        title?: string;
        artist?: string;
        originalKey?: string;
      };

      if (!lyricsText?.trim() && !chordsText?.trim()) {
        res.status(400).json({
          error: "Ingresa al menos la letra o los acordes para generar la hoja.",
        });
        return;
      }

      const ai = getGeminiClient();

      const prompt = `Eres un arreglista musical experto. El músico tiene por separado sus notas/acordes y/o la letra copiada de otra aplicación.
Combínalos y organízalos en una hoja de canción lista para teleprompter karaoke.

Datos del músico:
- Título: ${title || "Sin título"}
- Artista: ${artist || "Desconocido"}
- Tonalidad base indicada: ${originalKey || "Detectar automáticamente"}

Notas / Acordes / Tablatura del músico:
${chordsText?.trim() || "(No proporcionados: solo estructura la letra en secciones limpias)"}

Letra copiada:
${lyricsText?.trim() || "(No proporcionada: genera bloques instrumentales claros con los acordes para que el músico pueda agregar la letra luego)"}

Instrucciones:
1. Convierte todos los acordes a cifrado americano estándar (C, D, Em, G7, F#m, etc.).
2. Si se proporcionaron tanto acordes/progresión como letra, distribuye y alinea cada acorde en el índice 'column' correcto encima de las palabras correspondientes según la progresión y estructura (Intro, Verso, Coro, Puente).
3. Si solo hay acordes sin letra, crea líneas con 'isInstrumental': true mostrando la progresión de acordes por sección para que el músico pueda ir tocando y luego escribir la letra.
4. Si solo hay letra sin acordes, organiza la letra en secciones limpias (Verso, Coro, etc.) con 'chords': [].
5. No inventes versos de canciones protegidas si no están en la letra proporcionada.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: songResponseSchema,
        },
      });

      const rawJson = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawJson);
      res.json({ song: parsed });
    } catch (err: unknown) {
      console.error("Error aligning chords and lyrics:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Error al combinar acordes y letra.";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/transcribe-clip", async (req, res) => {
    try {
      const { base64Audio, mimeType, language } = req.body as {
        base64Audio?: string;
        mimeType?: string;
        language?: string;
      };

      if (!base64Audio || !mimeType) {
        res.status(400).json({ error: "No se recibió audio válido." });
        return;
      }

      const ai = getGeminiClient();
      const langLabel = language === "en" ? "inglés" : "español";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: `Transcribe únicamente las palabras cantadas o habladas por la voz humana en ${langLabel}. Ignora acordes de guitarra, piano o percusión. Si solo hay música instrumental sin voz, responde exactamente una cadena vacía.`,
            },
          ],
        },
      });

      res.json({ transcript: (response.text ?? "").trim() });
    } catch (err: unknown) {
      console.error("Error transcribing live audio clip:", err);
      const message =
        err instanceof Error ? err.message : "Error al transcribir el audio.";
      res.status(500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true",
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AtrilVivo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
