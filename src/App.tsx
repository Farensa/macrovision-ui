import React, { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { HistoryPanel } from "./components/HistoryPanel";
import { JsonInspector } from "./components/JsonInspector";
import { MacroQueuePanel } from "./components/MacroQueuePanel";
import { PromptGuidePanel } from "./components/PromptGuidePanel";
import { ScreenshotStage } from "./components/ScreenshotStage";
import { SAMPLE_SCREENS } from "./data/samples";
import type {
  DetectionResult,
  HistoryEntry,
  ImageAsset,
  MacroStep,
  WorkspaceTab,
} from "./types";
import { fileToDataUrl, urlToLoadedImage } from "./utils/image";

const HISTORY_STORAGE_KEY = "macrovision_detection_history_v1";

const GENERAL_PRESETS = [
  "Tombol 'Mulai' berwarna hijau",
  "Ikon peti harta karun",
  "Tombol 'Lanjutkan' atau 'OK'",
  "Ikon tutup (X) di pojok kanan atas",
  "Ikon pengaturan (gear)",
];

function loadInitialHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("single");
  const [activeImage, setActiveImage] = useState<ImageAsset | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string>(SAMPLE_SCREENS[0].id);
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);

  const [targetQuery, setTargetQuery] = useState<string>(SAMPLE_SCREENS[0].presets[0]);
  const [customInstruction, setCustomInstruction] = useState<string>("");
  const [targetWidth, setTargetWidth] = useState<number>(1920);
  const [targetHeight, setTargetHeight] = useState<number>(1080);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [macroSteps, setMacroSteps] = useState<MacroStep[]>([
    {
      id: "step-1",
      target: "Ikon peti harta karun",
      delayMs: 600,
      status: "idle",
    },
    {
      id: "step-2",
      target: "Tombol 'Mulai' berwarna hijau",
      delayMs: 1000,
      status: "idle",
    },
  ]);

  const [history, setHistory] = useState<HistoryEntry[]>(loadInitialHistory);
  const headerFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  const selectSample = useCallback(async (sampleId: string) => {
    const sample = SAMPLE_SCREENS.find((s) => s.id === sampleId);
    if (!sample) return;
    setLoadingSampleId(sampleId);
    setErrorMessage(null);
    try {
      const loaded = await urlToLoadedImage(sample.imageUrl);
      setActiveSampleId(sample.id);
      setActiveImage({
        id: sample.id,
        label: sample.title,
        dataUrl: loaded.dataUrl,
        mimeType: loaded.mimeType,
        width: loaded.width,
        height: loaded.height,
        sourceType: "sample",
      });
      setTargetWidth(loaded.width);
      setTargetHeight(loaded.height);
      setTargetQuery(sample.presets[0] ?? "");
      setDetectionResult(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal memuat gambar contoh."
      );
    } finally {
      setLoadingSampleId(null);
    }
  }, []);

  useEffect(() => {
    void selectSample(SAMPLE_SCREENS[0].id);
  }, [selectSample]);

  const handleUploadFile = useCallback(
    async (file: File, sourceType: "upload" | "clipboard" = "upload") => {
      setErrorMessage(null);
      try {
        const loaded = await fileToDataUrl(file);
        setActiveSampleId("");
        setActiveImage({
          id: `${Date.now()}`,
          label: file.name || "Tangkapan Layar Clipboard",
          dataUrl: loaded.dataUrl,
          mimeType: loaded.mimeType,
          width: loaded.width,
          height: loaded.height,
          sourceType,
        });
        setTargetWidth(loaded.width);
        setTargetHeight(loaded.height);
        setDetectionResult(null);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Gagal membaca berkas gambar."
        );
      }
    },
    []
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            void handleUploadFile(blob, "clipboard");
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleUploadFile]);

  const appendHistory = useCallback(
    (query: string, result: DetectionResult) => {
      if (!activeImage) return;
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        imageLabel: activeImage.label,
        imageWidth: targetWidth > 0 ? targetWidth : activeImage.width,
        imageHeight: targetHeight > 0 ? targetHeight : activeImage.height,
        targetQuery: query,
        result,
      };
      setHistory((prev) => [entry, ...prev].slice(0, 50));
    },
    [activeImage, targetWidth, targetHeight]
  );

  const runDetection = async (e?: React.FormEvent, overrideTarget?: string) => {
    if (e) e.preventDefault();
    const query = (overrideTarget ?? targetQuery).trim();
    if (!activeImage) {
      setErrorMessage("Pilih atau unggah tangkapan layar terlebih dahulu.");
      return;
    }
    if (!query) {
      setErrorMessage("Masukkan nama atau deskripsi elemen target yang ingin dicari.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: activeImage.dataUrl,
          mimeType: activeImage.mimeType,
          target: query,
          customInstruction: customInstruction.trim() || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Permintaan analisis gagal.");
      }

      const result = payload as DetectionResult;
      setDetectionResult(result);
      appendHistory(query, result);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Terjadi kesalahan saat menghubungi server."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const activeSample = SAMPLE_SCREENS.find((s) => s.id === activeSampleId);
  const presetList = activeSample ? activeSample.presets : GENERAL_PRESETS;

  const navItems: { id: WorkspaceTab; label: string }[] = [
    { id: "single", label: "Deteksi Tunggal" },
    { id: "macro", label: "Urutan Makro" },
    { id: "history", label: "Riwayat" },
    { id: "api", label: "Prompt & API" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("single");
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
          >
            MacroVision UI
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? "border-emerald-600 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => headerFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Unggah Screenshot
            </button>
            <input
              ref={headerFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleUploadFile(file, "upload");
                  e.target.value = "";
                }
              }}
              className="hidden"
            />
          </div>
        </div>

        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === item.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-balance">
              Analisis Elemen UI &amp; Koordinat Otomasi Makro
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Pindai tangkapan layar aplikasi atau game untuk menemukan posisi tombol dan ikon target dalam koordinat persentase layar dan piksel presisi.
            </p>
          </div>
          {activeImage && (
            <div className="text-xs text-slate-500 tabular-nums shrink-0">
              <span>{activeImage.label}</span>
              <span aria-hidden="true" className="mx-2">·</span>
              <span className="font-mono text-slate-700">
                {activeImage.width} × {activeImage.height} px
              </span>
              <span aria-hidden="true" className="mx-2">·</span>
              <span>Tempel gambar via Ctrl+V</span>
            </div>
          )}
        </div>

        {(activeTab === "single" || activeTab === "macro") && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 space-y-6">
              <ScreenshotStage
                image={activeImage}
                detection={detectionResult}
                macroSteps={macroSteps}
                showMacroMarkers={activeTab === "macro"}
                isAnalyzing={isAnalyzing}
                targetWidth={targetWidth}
                targetHeight={targetHeight}
                onUploadFile={(file) => void handleUploadFile(file, "upload")}
              />

              {activeTab === "single" ? (
                <JsonInspector
                  result={detectionResult}
                  targetWidth={targetWidth}
                  targetHeight={targetHeight}
                  isAnalyzing={isAnalyzing}
                  errorMessage={errorMessage}
                />
              ) : (
                <MacroQueuePanel
                  image={activeImage}
                  steps={macroSteps}
                  setSteps={setMacroSteps}
                  targetWidth={targetWidth}
                  targetHeight={targetHeight}
                  onRecordHistory={appendHistory}
                />
              )}
            </div>

            <aside className="lg:col-span-4 space-y-6">
              {activeTab === "single" && (
                <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      03. Target Elemen UI
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Jelaskan tombol, ikon, atau teks yang ingin dideteksi oleh sistem.
                    </p>
                  </div>

                  <form onSubmit={(e) => void runDetection(e)} className="space-y-3.5">
                    <div>
                      <label
                        htmlFor="target-input"
                        className="block text-xs font-medium text-slate-700 mb-1.5"
                      >
                        Objek atau Tombol Target
                      </label>
                      <input
                        id="target-input"
                        type="text"
                        value={targetQuery}
                        onChange={(e) => setTargetQuery(e.target.value)}
                        placeholder="Contoh: Tombol 'Mulai' berwarna hijau"
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="notes-input"
                        className="block text-xs font-medium text-slate-700 mb-1.5"
                      >
                        Catatan Tambahan (Opsional)
                      </label>
                      <textarea
                        id="notes-input"
                        rows={2}
                        value={customInstruction}
                        onChange={(e) => setCustomInstruction(e.target.value)}
                        placeholder="Misal: Abaikan ikon kecil di bar atas, prioritaskan tombol utama."
                        className="w-full px-3.5 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isAnalyzing || !activeImage || !targetQuery.trim()}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Memindai Tangkapan Layar...
                        </>
                      ) : (
                        <>
                          <Crosshair className="w-4 h-4" />
                          Deteksi Elemen
                        </>
                      )}
                    </button>
                  </form>

                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <div className="text-xs font-medium text-slate-700">
                      Preset Target Cepat
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {presetList.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setTargetQuery(preset);
                            void runDetection(undefined, preset);
                          }}
                          disabled={isAnalyzing || !activeImage}
                          className={`text-left px-3 py-2 text-xs rounded-lg border transition-colors cursor-pointer truncate ${
                            targetQuery === preset
                              ? "border-emerald-600 bg-emerald-50/70 text-emerald-900 font-medium"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Contoh Tangkapan Layar
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pilih skenario uji bawaan atau unggah tangkapan layar milik Anda.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {SAMPLE_SCREENS.map((sample) => {
                    const isSelected = activeSampleId === sample.id;
                    const isLoading = loadingSampleId === sample.id;
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => void selectSample(sample.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="w-16 h-11 rounded bg-slate-900 overflow-hidden shrink-0 border border-slate-200">
                          <img
                            src={sample.imageUrl}
                            alt={sample.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {sample.title}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {isLoading ? "Memuat gambar..." : sample.category}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Kalibrasi Resolusi Piksel
                  </h2>
                  {activeImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetWidth(activeImage.width);
                        setTargetHeight(activeImage.height);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Asli
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Gunakan dimensi layar perangkat target untuk menghitung koordinat tap piksel yang akurat.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="res-width"
                      className="block text-[11px] text-slate-500 mb-1"
                    >
                      Lebar (px)
                    </label>
                    <input
                      id="res-width"
                      type="number"
                      min={1}
                      value={targetWidth}
                      onChange={(e) => setTargetWidth(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-1.5 text-xs font-mono text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="res-height"
                      className="block text-[11px] text-slate-500 mb-1"
                    >
                      Tinggi (px)
                    </label>
                    <input
                      id="res-height"
                      type="number"
                      min={1}
                      value={targetHeight}
                      onChange={(e) => setTargetHeight(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-1.5 text-xs font-mono text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: "1920×1080", w: 1920, h: 1080 },
                    { label: "1280×720", w: 1280, h: 720 },
                    { label: "1080×2400", w: 1080, h: 2400 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setTargetWidth(preset.w);
                        setTargetHeight(preset.h);
                      }}
                      className="px-2.5 py-1 text-[11px] font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}

        {activeTab === "history" && (
          <HistoryPanel
            entries={history}
            onClearHistory={() => setHistory([])}
            onInspectEntry={(entry) => {
              setTargetQuery(entry.targetQuery);
              setDetectionResult(entry.result);
              setTargetWidth(entry.imageWidth);
              setTargetHeight(entry.imageHeight);
              setActiveTab("single");
            }}
          />
        )}

        {activeTab === "api" && <PromptGuidePanel />}
      </main>
    </div>
  );
}
