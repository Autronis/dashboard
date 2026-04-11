"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, Receipt, Upload, Download, Check, Clock,
  AlertTriangle, TrendingDown, TrendingUp, Calculator,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────
interface Document {
  id: number;
  type: "inkomend" | "uitgaand" | "bonnetje";
  leverancier: string;
  bedrag: number;
  btwBedrag: number | null;
  datum: string;
  status: string;
  storageUrl: string | null;
  factuurnummer: string | null;
  transactieId: number | null;
}

interface Totalen {
  inkomend: number;
  uitgaand: number;
  btw: number;
}

interface ApiResponse {
  documenten: Document[];
  onbekoppeld: number;
  totalen: Totalen;
}

// ─── Constants ──────────────────────────────────────────────────
const monthNames: Record<string, string> = {
  "01": "Januari", "02": "Februari", "03": "Maart", "04": "April",
  "05": "Mei", "06": "Juni", "07": "Juli", "08": "Augustus",
  "09": "September", "10": "Oktober", "11": "November", "12": "December",
};

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];

type FilterType = "alle" | "inkomend" | "uitgaand" | "bonnetjes";
const typeFilters: { label: string; value: FilterType }[] = [
  { label: "Alle", value: "alle" },
  { label: "Inkomend", value: "inkomend" },
  { label: "Uitgaand", value: "uitgaand" },
  { label: "Bonnetjes", value: "bonnetjes" },
];

const quarters = [
  { label: "Alles", value: 0 },
  { label: "Q1", value: 1 },
  { label: "Q2", value: 2 },
  { label: "Q3", value: 3 },
  { label: "Q4", value: 4 },
];

// ─── Helpers ────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function groupByMonth(docs: Document[]): Record<string, Document[]> {
  const groups: Record<string, Document[]> = {};
  for (const doc of docs) {
    const month = doc.datum.slice(5, 7);
    if (!groups[month]) groups[month] = [];
    groups[month].push(doc);
  }
  // Sort months descending
  const sorted: Record<string, Document[]> = {};
  for (const key of Object.keys(groups).sort((a, b) => b.localeCompare(a))) {
    sorted[key] = groups[key];
  }
  return sorted;
}

// ─── Page ───────────────────────────────────────────────────────
export default function AdministratiePage() {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jaar, setJaar] = useState(currentYear);
  const [kwartaal, setKwartaal] = useState(0);
  const [type, setType] = useState<FilterType>("alle");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Fetch data ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ jaar: String(jaar) });
      if (kwartaal > 0) params.set("kwartaal", String(kwartaal));
      if (type !== "alle") params.set("type", type);

      const res = await fetch(`/api/administratie?${params}`);
      if (!res.ok) throw new Error("Ophalen mislukt");
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Ophalen mislukt", "fout");
    } finally {
      setLoading(false);
    }
  }, [jaar, kwartaal, type, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Upload ─────────────────────────────────────────────────
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/administratie/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.fout ?? "Upload mislukt");
      }
      addToast("Bestand geupload", "succes");
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Upload mislukt", "fout");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [addToast, fetchData]);

  // ─── Download / Export ──────────────────────────────────────
  const handleExport = useCallback(() => {
    const params = new URLSearchParams({ jaar: String(jaar) });
    if (kwartaal > 0) params.set("kwartaal", String(kwartaal));
    window.open(`/api/administratie/export?${params}`, "_blank");
  }, [jaar, kwartaal]);

  // ─── Open document ──────────────────────────────────────────
  const openDocument = useCallback(async (storageUrl: string | null) => {
    if (!storageUrl) {
      addToast("Geen bestand beschikbaar", "fout");
      return;
    }
    try {
      const res = await fetch(`/api/administratie/signed-url?path=${encodeURIComponent(storageUrl)}`);
      if (!res.ok) throw new Error("Signed URL ophalen mislukt");
      const json: { url: string } = await res.json();
      window.open(json.url, "_blank");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon document niet openen", "fout");
    }
  }, [addToast]);

  // ─── Derived ────────────────────────────────────────────────
  const grouped = data ? groupByMonth(data.documenten) : {};
  const onbekoppeld = data?.onbekoppeld ?? 0;
  const totalen = data?.totalen ?? { inkomend: 0, uitgaand: 0, btw: 0 };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0E1719] text-white p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Administratie</h1>
          <p className="text-white/50 text-sm mt-1">
            Alle facturen, bonnetjes en documenten op een plek
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17B8A5] text-white text-sm font-medium hover:bg-[#4DC9B4] transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#192225] border border-[#2A3538] text-white/60 text-sm font-medium hover:text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {onbekoppeld > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span className="text-amber-300 text-sm">
            {onbekoppeld} {onbekoppeld === 1 ? "factuur wacht" : "facturen wachten"} op koppeling
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Years */}
        <div className="flex gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setJaar(y)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                jaar === y
                  ? "bg-[#17B8A5] text-white"
                  : "bg-[#192225] text-white/60 hover:text-white"
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Type */}
        <div className="flex gap-1.5">
          {typeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setType(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                type === f.value
                  ? "bg-[#17B8A5] text-white"
                  : "bg-[#192225] text-white/60 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Quarter */}
        <div className="flex gap-1.5">
          {quarters.map((q) => (
            <button
              key={q.value}
              onClick={() => setKwartaal(q.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                kwartaal === q.value
                  ? "bg-[#17B8A5] text-white"
                  : "bg-[#192225] text-white/60 hover:text-white"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#192225] border border-[#2A3538] rounded-2xl p-5">
          <div className="flex items-center gap-2 text-white/40 text-xs font-medium mb-2">
            <TrendingDown className="w-3.5 h-3.5" />
            Inkomend (kosten)
          </div>
          <p className="text-xl font-bold font-mono text-red-400">
            {formatCurrency(totalen.inkomend)}
          </p>
        </div>
        <div className="bg-[#192225] border border-[#2A3538] rounded-2xl p-5">
          <div className="flex items-center gap-2 text-white/40 text-xs font-medium mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Uitgaand (omzet)
          </div>
          <p className="text-xl font-bold font-mono text-emerald-400">
            {formatCurrency(totalen.uitgaand)}
          </p>
        </div>
        <div className="bg-[#192225] border border-[#2A3538] rounded-2xl p-5">
          <div className="flex items-center gap-2 text-white/40 text-xs font-medium mb-2">
            <Calculator className="w-3.5 h-3.5" />
            BTW te verrekenen
          </div>
          <p className="text-xl font-bold font-mono text-white">
            {formatCurrency(totalen.btw)}
          </p>
        </div>
      </div>

      {/* Documents grouped by month */}
      {loading ? (
        <div className="text-center text-white/40 py-16 text-sm">Laden...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center text-white/40 py-16 text-sm">
          Geen documenten gevonden
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([month, docs]) => (
            <div
              key={month}
              className="bg-[#192225] border border-[#2A3538] rounded-2xl overflow-hidden"
            >
              {/* Month header */}
              <div className="px-5 py-3 border-b border-[#2A3538]">
                <h3 className="text-sm font-semibold text-white/50">
                  {monthNames[month] ?? month}
                </h3>
              </div>

              {/* Document rows */}
              <div className="divide-y divide-[#2A3538]">
                {docs.map((doc) => (
                  <button
                    key={`${doc.type}-${doc.id}`}
                    onClick={() => openDocument(doc.storageUrl)}
                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03] transition-colors text-left"
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      {doc.type === "bonnetje" ? (
                        <Receipt className="w-4 h-4 text-white/40" />
                      ) : (
                        <FileText className="w-4 h-4 text-white/40" />
                      )}
                    </div>

                    {/* Leverancier + factuurnummer */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {doc.leverancier}
                      </p>
                      {doc.factuurnummer && (
                        <p className="text-xs text-white/40 truncate">
                          {doc.factuurnummer}
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    <span
                      className={`text-sm font-mono font-medium tabular-nums ${
                        doc.type === "uitgaand" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {doc.type === "uitgaand" ? "+" : "-"}
                      {formatCurrency(doc.bedrag)}
                    </span>

                    {/* Date */}
                    <span className="text-xs text-white/40 w-20 text-right flex-shrink-0">
                      {doc.datum}
                    </span>

                    {/* Status */}
                    <div className="flex-shrink-0">
                      {doc.status === "gematcht" || doc.status === "betaald" ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
