import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

interface AnalyzeRequestBody {
  imageBase64?: string;
  mimeType?: string;
  target?: string;
  customInstruction?: string;
}

interface DetectionResult {
  status: "found" | "not_found";
  target_name: string;
  confidence: number;
  center_coordinate: {
    x_percent: number;
    y_percent: number;
  };
  action_recommendation: string;
  reasoning: string;
}

const SYSTEM_INSTRUCTION = `Bertindaklah sebagai sistem AI untuk analisis antarmuka aplikasi/game (UI Detection & Macro Automation). Tugasmu adalah menganalisis gambar tangkapan layar (screenshot) yang diberikan, lalu mendeteksi posisi elemen atau tombol tertentu sesuai instruksi pengguna.

Instruksi Operasional:
1. Pindai seluruh gambar dengan sangat teliti untuk mencari objek, teks, ikon, atau tombol target yang diminta.
2. Sistem koordinat layar menggunakan persentase 0.0 sampai 100.0:
   - x_percent: 0.0 adalah tepi paling kiri gambar, 50.0 adalah tengah horizontal, 100.0 adalah tepi paling kanan gambar.
   - y_percent: 0.0 adalah tepi paling atas gambar, 50.0 adalah tengah vertikal, 100.0 adalah tepi paling bawah gambar.
3. Jika objek target ditemukan, tentukan titik koordinat pusat geometris (X, Y) elemen tersebut seakurat mungkin dalam format persentase layar (0.0 - 100.0) agar macro tap/click tepat mengenai area aktif tombol/ikon.
4. Jika objek TIDAK ditemukan di dalam gambar, ubah status menjadi "not_found", set x_percent dan y_percent ke 0.0, set action_recommendation menjadi "none", dan jelaskan alasan singkat pada field reasoning dalam bahasa Indonesia.
5. Gunakan bahasa Indonesia yang ringkas dan jelas pada field reasoning.`;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function extractBase64Payload(raw: string, fallbackMime: string): { data: string; mimeType: string } {
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2],
    };
  }
  return {
    mimeType: fallbackMime,
    data: raw.replace(/\s+/g, ""),
  };
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi pada environment server.");
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const body = req.body as AnalyzeRequestBody;
      const target = (body.target ?? "").trim();
      const rawImage = (body.imageBase64 ?? "").trim();
      const fallbackMime = (body.mimeType ?? "image/png").trim() || "image/png";

      if (!rawImage) {
        res.status(400).json({ error: "Gambar tangkapan layar wajib disediakan." });
        return;
      }

      if (!target) {
        res.status(400).json({ error: "Deskripsi elemen atau tombol target wajib diisi." });
        return;
      }

      const { data, mimeType } = extractBase64Payload(rawImage, fallbackMime);
      const ai = getGenAIClient();

      const promptParts = [
        `Target yang harus dideteksi: "${target}".`,
        "Pindai tangkapan layar terlampir, temukan elemen target tersebut, dan kembalikan titik koordinat pusatnya dalam persentase layar (x_percent dan y_percent dari 0.0 hingga 100.0).",
      ];

      if (body.customInstruction && body.customInstruction.trim()) {
        promptParts.push(`Catatan tambahan pengguna: ${body.customInstruction.trim()}`);
      }

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data,
              },
            },
            {
              text: promptParts.join("\n"),
            },
          ],
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: {
                type: Type.STRING,
                enum: ["found", "not_found"],
                description: "Status apakah target ditemukan atau tidak.",
              },
              target_name: {
                type: Type.STRING,
                description: "Nama objek atau tombol yang dicari.",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Angka perkiraan keyakinan dari 0.0 sampai 1.0.",
              },
              center_coordinate: {
                type: Type.OBJECT,
                properties: {
                  x_percent: {
                    type: Type.NUMBER,
                    description: "Koordinat horizontal pusat elemen (0.0 sampai 100.0).",
                  },
                  y_percent: {
                    type: Type.NUMBER,
                    description: "Koordinat vertikal pusat elemen (0.0 sampai 100.0).",
                  },
                },
                required: ["x_percent", "y_percent"],
              },
              action_recommendation: {
                type: Type.STRING,
                description: "Rekomendasi aksi seperti 'tap / click' atau 'none'.",
              },
              reasoning: {
                type: Type.STRING,
                description: "Penjelasan singkat mengapa objek ini dipilih atau tidak ditemukan.",
              },
            },
            required: [
              "status",
              "target_name",
              "confidence",
              "center_coordinate",
              "action_recommendation",
              "reasoning",
            ],
          },
        },
      });

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        res.status(502).json({ error: "Model mengembalikan respons kosong." });
        return;
      }

      let parsed: Partial<DetectionResult>;
      try {
        parsed = JSON.parse(rawText) as Partial<DetectionResult>;
      } catch {
        res.status(502).json({
          error: "Respons model tidak berupa JSON yang valid.",
          raw: rawText,
        });
        return;
      }

      const status = parsed.status === "found" ? "found" : "not_found";
      const xRaw = Number(parsed.center_coordinate?.x_percent ?? 0);
      const yRaw = Number(parsed.center_coordinate?.y_percent ?? 0);

      const cleanResult: DetectionResult = {
        status,
        target_name: (parsed.target_name ?? target).trim() || target,
        confidence: roundTwo(clamp(Number(parsed.confidence ?? 0), 0, 1)),
        center_coordinate: {
          x_percent: status === "found" ? roundTwo(clamp(xRaw, 0, 100)) : 0,
          y_percent: status === "found" ? roundTwo(clamp(yRaw, 0, 100)) : 0,
        },
        action_recommendation:
          status === "found"
            ? (parsed.action_recommendation ?? "tap / click").trim() || "tap / click"
            : "none",
        reasoning:
          (parsed.reasoning ?? "").trim() ||
          (status === "found"
            ? "Elemen target terdeteksi pada tangkapan layar."
            : "Elemen target tidak ditemukan pada tangkapan layar."),
      };

      res.json(cleanResult);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat menganalisis tangkapan layar.";
      console.error("[/api/analyze] Error:", err);

      if (message.includes("403") || message.includes("PERMISSION_DENIED") || message.includes("API_KEY_INVALID")) {
        res.status(403).json({
          error: "API key Gemini tidak valid atau belum memiliki izin. Periksa panel Settings > Secrets.",
        });
        return;
      }
      if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
        res.status(429).json({
          error: "Batas kuota permintaan API tercapai sementara. Coba lagi beberapa saat lagi.",
        });
        return;
      }

      res.status(500).json({ error: message });
    }
  });

  const isProd = process.env.NODE_ENV === "production";
  const distPath = path.resolve(__dirname, "dist");

  if (isProd && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MacroVision UI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
