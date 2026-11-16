import React, { useRef, useState } from "react";
import { Crosshair, Grid, ImagePlus, MousePointerClick } from "lucide-react";
import type { DetectionResult, ImageAsset, MacroStep } from "../types";
import { percentToPixel } from "../utils/image";

interface ScreenshotStageProps {
  image: ImageAsset | null;
  detection: DetectionResult | null;
  macroSteps?: MacroStep[];
  showMacroMarkers?: boolean;
  isAnalyzing: boolean;
  targetWidth: number;
  targetHeight: number;
  onUploadFile: (file: File) => void;
}

interface RippleMark {
  id: number;
  xPercent: number;
  yPercent: number;
}

export const ScreenshotStage: React.FC<ScreenshotStageProps> = ({
  image,
  detection,
  macroSteps = [],
  showMacroMarkers = false,
  isAnalyzing,
  targetWidth,
  targetHeight,
  onUploadFile,
}) => {
  const [showGrid, setShowGrid] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const [manualTap, setManualTap] = useState<{ x: number; y: number } | null>(null);
  const [ripples, setRipples] = useState<RippleMark[]>([]);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const computePercentFromPointer = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    return {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const coord = computePercentFromPointer(e);
    if (coord) setHoverCoord(coord);
  };

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const coord = computePercentFromPointer(e);
    if (!coord) return;
    setManualTap(coord);
    const id = Date.now();
    setRipples((prev) => [...prev.slice(-3), { id, xPercent: coord.x, yPercent: coord.y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((item) => item.id !== id));
    }, 600);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onUploadFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      e.target.value = "";
    }
  };

  const effectiveWidth = targetWidth > 0 ? targetWidth : image?.width ?? 1920;
  const effectiveHeight = targetHeight > 0 ? targetHeight : image?.height ?? 1080;

  const detectedPixels =
    detection && detection.status === "found"
      ? percentToPixel(
          detection.center_coordinate.x_percent,
          detection.center_coordinate.y_percent,
          effectiveWidth,
          effectiveHeight
        )
      : null;

  const hoverPixels = hoverCoord
    ? percentToPixel(hoverCoord.x, hoverCoord.y, effectiveWidth, effectiveHeight)
    : null;

  const manualPixels = manualTap
    ? percentToPixel(manualTap.x, manualTap.y, effectiveWidth, effectiveHeight)
    : null;

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 whitespace-nowrap">
            01. Kanvas Inspeksi Layar
          </h2>
          {image && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 tabular-nums truncate">
              <span className="truncate max-w-[180px]">{image.label}</span>
              <span aria-hidden="true">·</span>
              <span>
                {image.width} × {image.height} px
              </span>
              <span aria-hidden="true">·</span>
              <span>{image.mimeType.replace("image/", "").toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowGrid((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showGrid
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            Grid Persentase
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Ganti Gambar
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative bg-slate-950 min-h-[420px] lg:min-h-[520px] flex items-center justify-center p-4 sm:p-6 transition-colors ${
          isDragging ? "ring-2 ring-inset ring-emerald-500 bg-slate-900" : ""
        }`}
      >
        {!image ? (
          <div className="text-center max-w-md py-12 px-6">
            <p className="text-sm font-medium text-slate-200">
              Belum ada tangkapan layar yang dipilih
            </p>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Seret dan lepas berkas PNG/JPG ke area ini, tempel langsung dengan Ctrl+V, atau pilih contoh layar di panel sebelah kanan.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-900 bg-white rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ImagePlus className="w-4 h-4" />
              Pilih Berkas Screenshot
            </button>
          </div>
        ) : (
          <div
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverCoord(null)}
            onClick={handleStageClick}
            className="relative inline-block max-w-full select-none cursor-crosshair shadow-2xl"
          >
            <img
              ref={imgRef}
              src={image.dataUrl}
              alt={image.label}
              referrerPolicy="no-referrer"
              className="block max-h-[560px] w-auto max-w-full rounded-sm object-contain"
              draggable={false}
            />

            {showGrid && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {[25, 50, 75].map((pct) => (
                  <React.Fragment key={pct}>
                    <div
                      style={{ left: `${pct}%` }}
                      className="absolute top-0 bottom-0 w-px bg-white/20"
                    />
                    <div
                      style={{ top: `${pct}%` }}
                      className="absolute left-0 right-0 h-px bg-white/20"
                    />
                    <span
                      style={{ left: `${pct}%` }}
                      className="absolute top-1 -translate-x-1/2 text-[10px] font-mono text-white/70 bg-slate-950/75 px-1 rounded"
                    >
                      {pct}%
                    </span>
                    <span
                      style={{ top: `${pct}%` }}
                      className="absolute left-1 -translate-y-1/2 text-[10px] font-mono text-white/70 bg-slate-950/75 px-1 rounded"
                    >
                      {pct}%
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}

            {ripples.map((r) => (
              <div
                key={r.id}
                style={{ left: `${r.xPercent}%`, top: `${r.yPercent}%` }}
                className="pointer-events-none absolute w-8 h-8 rounded-full border-2 border-sky-400 animate-tap-ripple"
              />
            ))}

            {!showMacroMarkers && detection && detection.status === "found" && (
              <div className="pointer-events-none absolute inset-0">
                <div
                  style={{ left: `${detection.center_coordinate.x_percent}%` }}
                  className="absolute top-0 bottom-0 w-px border-l border-dashed border-emerald-400/90"
                />
                <div
                  style={{ top: `${detection.center_coordinate.y_percent}%` }}
                  className="absolute left-0 right-0 h-px border-t border-dashed border-emerald-400/90"
                />
                <div
                  style={{
                    left: `${detection.center_coordinate.x_percent}%`,
                    top: `${detection.center_coordinate.y_percent}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                >
                  <div className="w-9 h-9 rounded-full border-2 border-emerald-400 bg-emerald-500/20 flex items-center justify-center shadow-lg">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                  </div>
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-950/92 text-white border border-emerald-500/60 px-2.5 py-1 rounded-md text-[11px] font-mono shadow-lg ${
                      detection.center_coordinate.y_percent > 78 ? "bottom-11" : "top-11"
                    }`}
                  >
                    <span className="text-emerald-400 font-semibold">
                      {detection.center_coordinate.x_percent.toFixed(1)}%,{" "}
                      {detection.center_coordinate.y_percent.toFixed(1)}%
                    </span>
                    {detectedPixels && (
                      <span className="text-slate-300 ml-1.5">
                        ({detectedPixels.x}, {detectedPixels.y} px)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showMacroMarkers &&
              macroSteps.map((step, index) => {
                if (step.result?.status !== "found") return null;
                const { x_percent, y_percent } = step.result.center_coordinate;
                return (
                  <div
                    key={step.id}
                    style={{ left: `${x_percent}%`, top: `${y_percent}%` }}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white border-2 border-white shadow-lg flex items-center justify-center text-xs font-mono font-semibold">
                      {index + 1}
                    </div>
                  </div>
                );
              })}

            {isAnalyzing && (
              <div className="pointer-events-none absolute inset-0 bg-slate-950/55 backdrop-blur-[1px] flex items-center justify-center">
                <div className="bg-slate-900 border border-slate-700 text-slate-100 px-4 py-2.5 rounded-lg text-xs font-medium shadow-xl">
                  Memindai elemen antarmuka pada tangkapan layar...
                </div>
              </div>
            )}
          </div>
        )}

        {isDragging && (
          <div className="pointer-events-none absolute inset-3 border-2 border-dashed border-emerald-400 rounded-lg bg-slate-950/80 flex items-center justify-center">
            <p className="text-sm font-medium text-emerald-300">
              Lepaskan berkas gambar di sini untuk dianalisis
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600 tabular-nums">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-slate-500" />
            <span>Kursor:</span>
            <span className="font-mono text-slate-900">
              {hoverCoord && hoverPixels
                ? `${hoverCoord.x.toFixed(1)}%, ${hoverCoord.y.toFixed(1)}% (${hoverPixels.x}×${hoverPixels.y} px)`
                : "Arahkan ke gambar"}
            </span>
          </div>

          {manualTap && manualPixels && (
            <div className="flex items-center gap-1.5">
              <MousePointerClick className="w-3.5 h-3.5 text-sky-600" />
              <span>Uji Tap Manual:</span>
              <span className="font-mono text-slate-900">
                {manualTap.x.toFixed(1)}%, {manualTap.y.toFixed(1)}% ({manualPixels.x}, {manualPixels.y} px)
              </span>
            </div>
          )}
        </div>

        <div className="text-slate-500">
          Skala piksel target: <span className="font-mono text-slate-800">{effectiveWidth} × {effectiveHeight}</span>
        </div>
      </div>
    </section>
  );
};
