import React, { useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Play, Plus, Trash2 } from "lucide-react";
import type { DetectionResult, ImageAsset, MacroStep } from "../types";
import { percentToPixel } from "../utils/image";

interface MacroQueuePanelProps {
  image: ImageAsset | null;
  steps: MacroStep[];
  setSteps: React.Dispatch<React.SetStateAction<MacroStep[]>>;
  targetWidth: number;
  targetHeight: number;
  onRecordHistory: (targetQuery: string, result: DetectionResult) => void;
}

export const MacroQueuePanel: React.FC<MacroQueuePanelProps> = ({
  image,
  steps,
  setSteps,
  targetWidth,
  targetHeight,
  onRecordHistory,
}) => {
  const [newTarget, setNewTarget] = useState("");
  const [newDelay, setNewDelay] = useState(500);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const effectiveWidth = targetWidth > 0 ? targetWidth : image?.width ?? 1920;
  const effectiveHeight = targetHeight > 0 ? targetHeight : image?.height ?? 1080;

  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTarget.trim();
    if (!trimmed) return;
    setSteps((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        target: trimmed,
        delayMs: Math.max(0, Number(newDelay) || 0),
        status: "idle",
      },
    ]);
    setNewTarget("");
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= steps.length) return;
    setSteps((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const runQueue = async () => {
    if (!image || steps.length === 0 || isRunningAll) return;
    setIsRunningAll(true);

    for (const step of steps) {
      setSteps((prev) =>
        prev.map((s) => (s.id === step.id ? { ...s, status: "running", error: undefined } : s))
      );

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: image.dataUrl,
            mimeType: image.mimeType,
            target: step.target,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Gagal memproses langkah makro.");
        }

        const detection = payload as DetectionResult;
        setSteps((prev) =>
          prev.map((s) =>
            s.id === step.id ? { ...s, status: "done", result: detection } : s
          )
        );
        onRecordHistory(step.target, detection);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Kesalahan jaringan";
        setSteps((prev) =>
          prev.map((s) =>
            s.id === step.id ? { ...s, status: "error", error: msg } : s
          )
        );
      }
    }

    setIsRunningAll(false);
  };

  const adbScript = steps
    .filter((s) => s.result?.status === "found")
    .map((s, idx) => {
      const { x, y } = percentToPixel(
        s.result!.center_coordinate.x_percent,
        s.result!.center_coordinate.y_percent,
        effectiveWidth,
        effectiveHeight
      );
      const sec = (s.delayMs / 1000).toFixed(2);
      return `# Langkah ${idx + 1}: ${s.target}\nadb shell input tap ${x} ${y}\nsleep ${sec}`;
    })
    .join("\n\n");

  const handleCopyScript = async () => {
    if (!adbScript) return;
    await navigator.clipboard.writeText(adbScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 1800);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Urutan Langkah Makro
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Susun beberapa target deteksi berurutan untuk menghasilkan skrip otomasi lengkap.
          </p>
        </div>

        <button
          type="button"
          onClick={runQueue}
          disabled={!image || steps.length === 0 || isRunningAll}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          {isRunningAll ? "Menjalankan Deteksi..." : "Jalankan Semua Langkah"}
        </button>
      </div>

      <div className="p-5 space-y-5">
        <form onSubmit={handleAddStep} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            placeholder="Tambah target langkah baru, mis. Ikon peti harta karun"
            className="flex-1 px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap">Jeda (ms)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={newDelay}
              onChange={(e) => setNewDelay(Number(e.target.value))}
              className="w-24 px-3 py-2 text-sm font-mono text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={!newTarget.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-900 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200/70 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah
            </button>
          </div>
        </form>

        {steps.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm font-medium text-slate-700">Belum ada langkah makro</p>
            <p className="text-xs text-slate-500 mt-1">
              Tambahkan beberapa elemen target di atas untuk memetakan alur tap otomatis.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-medium w-10">#</th>
                  <th className="py-2.5 px-3 font-medium">Elemen Target</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium text-right">Koordinat (%)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Piksel</th>
                  <th className="py-2.5 px-3 font-medium text-right">Jeda</th>
                  <th className="py-2.5 px-3 font-medium text-right w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums">
                {steps.map((step, index) => {
                  const found = step.result?.status === "found";
                  const px = found
                    ? percentToPixel(
                        step.result!.center_coordinate.x_percent,
                        step.result!.center_coordinate.y_percent,
                        effectiveWidth,
                        effectiveHeight
                      )
                    : null;

                  return (
                    <tr key={step.id} className="hover:bg-slate-50/70 h-11">
                      <td className="px-3 font-mono text-slate-500">{index + 1}</td>
                      <td className="px-3 font-medium text-slate-900 max-w-[240px] truncate">
                        {step.target}
                      </td>
                      <td className="px-3">
                        {step.status === "idle" && <span className="text-slate-400">Menunggu</span>}
                        {step.status === "running" && (
                          <span className="text-amber-600 font-medium">Memindai...</span>
                        )}
                        {step.status === "error" && (
                          <span className="text-red-600 font-medium">{step.error || "Gagal"}</span>
                        )}
                        {step.status === "done" && (
                          <span
                            className={`font-medium ${
                              found ? "text-emerald-700" : "text-red-600"
                            }`}
                          >
                            {found
                              ? `Ditemukan (${(step.result!.confidence * 100).toFixed(0)}%)`
                              : "Tidak ditemukan"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 text-right font-mono text-slate-700">
                        {found
                          ? `${step.result!.center_coordinate.x_percent.toFixed(1)}%, ${step.result!.center_coordinate.y_percent.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="px-3 text-right font-mono text-slate-700">
                        {px ? `${px.x}, ${px.y}` : "—"}
                      </td>
                      <td className="px-3 text-right font-mono text-slate-600">
                        {step.delayMs} ms
                      </td>
                      <td className="px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveStep(index, -1)}
                            disabled={index === 0}
                            aria-label="Naikkan urutan"
                            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStep(index, 1)}
                            disabled={index === steps.length - 1}
                            aria-label="Turunkan urutan"
                            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStep(step.id)}
                            aria-label="Hapus langkah"
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {adbScript && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">
                Skrip Eksekusi ADB ({effectiveWidth} × {effectiveHeight} px)
              </span>
              <button
                type="button"
                onClick={handleCopyScript}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                {copiedScript ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedScript ? "Tersalin" : "Salin Skrip ADB"}
              </button>
            </div>
            <pre className="bg-slate-950 text-slate-100 rounded-lg p-3.5 text-xs font-mono overflow-x-auto leading-relaxed">
              <code>{adbScript}</code>
            </pre>
          </div>
        )}
      </div>
    </section>
  );
};
