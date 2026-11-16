import React, { useState } from "react";
import { Check, Copy, Download, Terminal } from "lucide-react";
import type { DetectionResult } from "../types";
import { percentToPixel } from "../utils/image";

interface JsonInspectorProps {
  result: DetectionResult | null;
  targetWidth: number;
  targetHeight: number;
  isAnalyzing: boolean;
  errorMessage: string | null;
}

export const JsonInspector: React.FC<JsonInspectorProps> = ({
  result,
  targetWidth,
  targetHeight,
  isAnalyzing,
  errorMessage,
}) => {
  const [viewMode, setViewMode] = useState<"standard" | "macro">("standard");
  const [copied, setCopied] = useState(false);

  const pixels =
    result && result.status === "found"
      ? percentToPixel(
          result.center_coordinate.x_percent,
          result.center_coordinate.y_percent,
          targetWidth,
          targetHeight
        )
      : { x: 0, y: 0 };

  const displayedPayload = result
    ? viewMode === "standard"
      ? result
      : {
          ...result,
          screen_resolution: {
            width: targetWidth,
            height: targetHeight,
          },
          pixel_coordinate: pixels,
          automation_commands:
            result.status === "found"
              ? {
                  adb: `adb shell input tap ${pixels.x} ${pixels.y}`,
                  pyautogui: `pyautogui.click(${pixels.x}, ${pixels.y})`,
                  playwright: `await page.mouse.click(${pixels.x}, ${pixels.y});`,
                }
              : null,
        }
    : null;

  const formattedJson = displayedPayload ? JSON.stringify(displayedPayload, null, 2) : "";

  const handleCopy = async () => {
    if (!formattedJson) return;
    await navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!formattedJson) return;
    const blob = new Blob([formattedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ui-detection-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900 whitespace-nowrap">
            02. Output JSON &amp; Koordinat
          </h2>
          {result && (
            <span
              className={`text-xs font-medium ${
                result.status === "found" ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {result.status === "found" ? "Ditemukan" : "Tidak Ditemukan"} · Keyakinan{" "}
              <span className="font-mono">{(result.confidence * 100).toFixed(0)}%</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode("standard")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === "standard"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              JSON Standar
            </button>
            <button
              type="button"
              onClick={() => setViewMode("macro")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === "macro"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Piksel &amp; Makro
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!formattedJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Tersalin" : "Salin JSON"}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!formattedJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh
          </button>
        </div>
      </div>

      <div className="p-5">
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
            <span className="font-semibold">Analisis gagal:</span> {errorMessage}
          </div>
        )}

        {isAnalyzing ? (
          <div className="space-y-2.5 py-4">
            <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : !result ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              Siap menganalisis tangkapan layar
            </p>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              Masukkan deskripsi elemen atau pilih salah satu preset target di sebelah kanan, lalu klik Deteksi Elemen untuk menghasilkan koordinat pusat dan JSON terstruktur.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-slate-200 text-xs tabular-nums">
              <div>
                <div className="text-slate-500">Status Deteksi</div>
                <div
                  className={`mt-1 font-semibold ${
                    result.status === "found" ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {result.status}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Koordinat Persentase</div>
                <div className="mt-1 font-mono font-semibold text-slate-900">
                  {result.center_coordinate.x_percent.toFixed(2)}%,{" "}
                  {result.center_coordinate.y_percent.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-slate-500">Koordinat Piksel</div>
                <div className="mt-1 font-mono font-semibold text-slate-900">
                  {result.status === "found" ? `${pixels.x}, ${pixels.y} px` : "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Aksi Rekomendasi</div>
                <div className="mt-1 font-mono font-semibold text-slate-900">
                  {result.action_recommendation}
                </div>
              </div>
            </div>

            <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 text-xs leading-relaxed overflow-x-auto font-mono">
              <code>{formattedJson}</code>
            </pre>

            {result.status === "found" && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
                <div className="flex items-center gap-2 font-mono text-slate-800">
                  <Terminal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>adb shell input tap {pixels.x} {pixels.y}</span>
                </div>
                <span className="text-slate-500">
                  Resolusi acuan {targetWidth} × {targetHeight} px
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
