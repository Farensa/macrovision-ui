import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

const SYSTEM_PROMPT_TEMPLATE = `Bertindaklah sebagai sistem AI untuk analisis antarmuka aplikasi/game (UI Detection & Macro Automation). Tugasmu adalah menganalisis gambar tangkapan layar (screenshot) yang aku berikan, lalu mendeteksi posisi elemen atau tombol tertentu sesuai instruksiku.

Instruksi Operasional:
1. Pindai gambar dengan teliti untuk mencari objek/teks/tombol target: [SEBUTKAN TARGET DI SINI, contoh: "Tombol 'Mulai' berwarna hijau" atau "Ikon peti harta karun"].
2. Jika objek tersebut ditemukan, tentukan perkiraan titik koordinat pusatnya (X, Y) dalam format persentase layar (dari 0% sampai 100%) atau koordinat piksel perkiraan berdasarkan dimensi gambar.
3. Berikan respons dalam format JSON yang bersih dan terstruktur agar mudah dibaca oleh kode program eksternal nantinya.

Format Output yang Diinginkan (JSON):
{
  "status": "found" atau "not_found",
  "target_name": "nama objek yang dicari",
  "confidence": (angka perkiraan keyakinan dari 0.0 sampai 1.0),
  "center_coordinate": {
    "x_percent": 0.0,
    "y_percent": 0.0
  },
  "action_recommendation": "tap / click",
  "reasoning": "penjelasan singkat mengapa objek ini dipilih"
}`;

const CURL_SNIPPET = `curl -X POST "${typeof window !== "undefined" ? window.location.origin : ""}/api/analyze" \\
  -H "Content-Type: application/json" \\
  -d '{
    "imageBase64": "<BASE64_SCREENSHOT>",
    "mimeType": "image/png",
    "target": "Tombol '\''Mulai'\'' berwarna hijau"
  }'`;

const PYTHON_SNIPPET = `import base64
import requests

with open("screenshot.png", "rb") as f:
    b64_img = base64.b64encode(f.read()).decode("utf-8")

res = requests.post(
    "${typeof window !== "undefined" ? window.location.origin : ""}/api/analyze",
    json={
        "imageBase64": b64_img,
        "mimeType": "image/png",
        "target": "Ikon peti harta karun",
    },
).json()

if res["status"] == "found":
    screen_w, screen_h = 1920, 1080
    tap_x = round((res["center_coordinate"]["x_percent"] / 100) * screen_w)
    tap_y = round((res["center_coordinate"]["y_percent"] / 100) * screen_h)
    print(f"Tap di piksel: ({tap_x}, {tap_y})")`;

export const PromptGuidePanel: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyBlock = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Instruksi Sistem Deteksi UI
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Spesifikasi prompt operasional yang diterapkan pada mesin analisis backend.
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyBlock("prompt", SYSTEM_PROMPT_TEMPLATE)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedId === "prompt" ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedId === "prompt" ? "Tersalin" : "Salin Prompt"}
          </button>
        </div>

        <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap">
          <code>{SYSTEM_PROMPT_TEMPLATE}</code>
        </pre>

        <div className="pt-2 border-t border-slate-200 space-y-2 text-xs text-slate-600">
          <h3 className="font-semibold text-slate-900">Konversi Persentase ke Piksel</h3>
          <p className="leading-relaxed">
            Koordinat <code className="text-slate-900">x_percent</code> dan{" "}
            <code className="text-slate-900">y_percent</code> selalu dinormalisasi pada rentang{" "}
            <span className="font-mono text-slate-900">0.0 – 100.0</span> agar tetap akurat di berbagai resolusi perangkat:
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-slate-800">
            pixel_x = round((x_percent / 100) * lebar_layar)
            <br />
            pixel_y = round((y_percent / 100) * tinggi_layar)
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Integrasi Endpoint Program Eksternal
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Panggil endpoint <span className="font-mono text-slate-800">POST /api/analyze</span> langsung dari skrip Python, Node.js, atau bot makro.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">Contoh cURL</span>
            <button
              type="button"
              onClick={() => copyBlock("curl", CURL_SNIPPET)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              {copiedId === "curl" ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedId === "curl" ? "Tersalin" : "Salin"}
            </button>
          </div>
          <pre className="bg-slate-950 text-slate-100 rounded-lg p-3.5 text-xs font-mono overflow-x-auto leading-relaxed">
            <code>{CURL_SNIPPET}</code>
          </pre>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">Contoh Python (Otomasi Makro)</span>
            <button
              type="button"
              onClick={() => copyBlock("python", PYTHON_SNIPPET)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              {copiedId === "python" ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedId === "python" ? "Tersalin" : "Salin"}
            </button>
          </div>
          <pre className="bg-slate-950 text-slate-100 rounded-lg p-3.5 text-xs font-mono overflow-x-auto leading-relaxed">
            <code>{PYTHON_SNIPPET}</code>
          </pre>
        </div>
      </section>
    </div>
  );
};
