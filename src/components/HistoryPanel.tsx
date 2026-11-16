import React, { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import type { HistoryEntry } from "../types";
import { percentToPixel } from "../utils/image";

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onClearHistory: () => void;
  onInspectEntry: (entry: HistoryEntry) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  entries,
  onClearHistory,
  onInspectEntry,
}) => {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "found" | "not_found">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesStatus =
        statusFilter === "all" || entry.result.status === statusFilter;
      const matchesQuery =
        !q ||
        entry.targetQuery.toLowerCase().includes(q) ||
        entry.imageLabel.toLowerCase().includes(q) ||
        entry.result.reasoning.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [entries, query, statusFilter]);

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Riwayat Analisis</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Catatan deteksi elemen antarmuka beserta koordinat dan alasan pemilihan model.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari target atau gambar..."
              className="pl-8 pr-3 py-1.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 w-52"
            />
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
            {(
              [
                { id: "all", label: "Semua" },
                { id: "found", label: "Ditemukan" },
                { id: "not_found", label: "Tidak Ditemukan" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {entries.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-slate-200 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Bersihkan
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-14 px-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            {entries.length === 0
              ? "Belum ada riwayat deteksi"
              : "Tidak ada riwayat yang cocok dengan filter"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {entries.length === 0
              ? "Jalankan analisis pada tab Deteksi Tunggal atau Urutan Makro untuk mulai mencatat hasil."
              : "Ubah kata kunci pencarian atau pilih filter status lain."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-2.5 px-4 font-medium">Waktu</th>
                <th className="py-2.5 px-4 font-medium">Sumber Layar</th>
                <th className="py-2.5 px-4 font-medium">Target</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium text-right">Keyakinan</th>
                <th className="py-2.5 px-4 font-medium text-right">Koordinat (%)</th>
                <th className="py-2.5 px-4 font-medium text-right">Piksel</th>
                <th className="py-2.5 px-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 tabular-nums">
              {filtered.map((entry) => {
                const found = entry.result.status === "found";
                const px = found
                  ? percentToPixel(
                      entry.result.center_coordinate.x_percent,
                      entry.result.center_coordinate.y_percent,
                      entry.imageWidth,
                      entry.imageHeight
                    )
                  : null;
                const timeStr = new Date(entry.createdAt).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                return (
                  <tr key={entry.id} className="hover:bg-slate-50/70 h-11">
                    <td className="px-4 font-mono text-slate-500 whitespace-nowrap">
                      {timeStr}
                    </td>
                    <td className="px-4 text-slate-700 max-w-[160px] truncate">
                      {entry.imageLabel}
                    </td>
                    <td className="px-4 font-medium text-slate-900 max-w-[220px] truncate">
                      {entry.targetQuery}
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          found ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {found ? "found" : "not_found"}
                      </span>
                    </td>
                    <td className="px-4 text-right font-mono text-slate-700">
                      {entry.result.confidence.toFixed(2)}
                    </td>
                    <td className="px-4 text-right font-mono text-slate-800 whitespace-nowrap">
                      {found
                        ? `${entry.result.center_coordinate.x_percent.toFixed(1)}%, ${entry.result.center_coordinate.y_percent.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-4 text-right font-mono text-slate-600 whitespace-nowrap">
                      {px ? `${px.x}, ${px.y}` : "—"}
                    </td>
                    <td className="px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectEntry(entry)}
                        className="text-emerald-700 hover:text-emerald-900 font-medium cursor-pointer"
                      >
                        Muat JSON
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
