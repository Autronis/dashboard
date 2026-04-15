"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FileText, Receipt, Upload, Download, Check, Clock,
  AlertTriangle, TrendingDown, TrendingUp, Calculator, Link2, Link2Off, Sparkles,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { KoppelModal } from "./koppel-modal";

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
  verwerktInAangifte: string | null;
}

interface Totalen {
  inkomend: number;
  uitgaand: number;
  btw: number;
}

interface BankTotalen {
  werkelijkeKostenIncl: number;
  werkelijkeBtw: number;
  bankTxAantal: number;
  zonderBonBedrag: number;
  zonderBonAantal: number;
}

interface ApiResponse {
  documenten: Document[];
  onbekoppeld: number;
  totalen: Totalen;
  bankTotalen: BankTotalen;
}

// ─── Constants ──────────────────────────────────────────────────
const MONTH_NAMES: Record<string, string> = {
  "01": "Januari", "02": "Februari", "03": "Maart", "04": "April",
  "05": "Mei", "06": "Juni", "07": "Juli", "08": "Augustus",
  "09": "September", "10": "Oktober", "11": "November", "12": "December",
};

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];

type FilterType = "alle" | "inkomend" | "uitgaand" | "bonnetjes";
type KoppelingFilter = "alle" | "gematcht" | "onbekoppeld";

const typeFilters: { label: string; value: FilterType }[] = [
  { label: "Alle", value: "alle" },
  { label: "Van leveranciers", value: "inkomend" },
  { label: "Eigen facturen", value: "uitgaand" },
  { label: "Bonnetjes", value: "bonnetjes" },
];

const quarters = [
  { label: "Heel jaar", value: 0 },
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

function formatDatumKort(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function formatPeriodeLabel(jaar: number, kwartaal: number): string {
  if (kwartaal === 0) return `${jaar}`;
  return `Q${kwartaal} ${jaar}`;
}

function groupByMonth(docs: Document[]): Array<{ month: string; items: Document[]; totaal: number }> {
  const groups: Record<string, Document[]> = {};
  for (const doc of docs) {
    const month = doc.datum.slice(0, 7); // "YYYY-MM" — sortable + unique across years
    if (!groups[month]) groups[month] = [];
    groups[month].push(doc);
  }
  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map((month) => ({
      month,
      items: groups[month],
      totaal: groups[month].reduce((s, d) => s + d.bedrag, 0),
    }));
}

// ─── Page ───────────────────────────────────────────────────────
export default function AdministratiePage() {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jaar, setJaar] = useState(currentYear);
  const [kwartaal, setKwartaal] = useState(0);
  const [type, setType] = useState<FilterType>("alle");
  const [koppeling, setKoppeling] = useState<KoppelingFilter>("alle");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rematching, setRematching] = useState(false);
  const [koppelFactuurId, setKoppelFactuurId] = useState<number | null>(null);

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

  // ─── Rematch ────────────────────────────────────────────────
  const handleRematch = useCallback(async () => {
    setRematching(true);
    try {
      const res = await fetch("/api/administratie/rematch", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Rematch mislukt");
      const { gematcht, gecheckt, nogOnbekoppeld } = json as {
        gematcht: number;
        gecheckt: number;
        nogOnbekoppeld: number;
      };
      addToast(
        gematcht > 0
          ? `${gematcht} van ${gecheckt} facturen gematcht (${nogOnbekoppeld} nog open)`
          : `Geen nieuwe matches gevonden (${gecheckt} gecheckt)`,
        gematcht > 0 ? "succes" : "fout"
      );
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Rematch mislukt", "fout");
    } finally {
      setRematching(false);
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
  const onbekoppeldAantal = data?.onbekoppeld ?? 0;
  const totalen = data?.totalen ?? { inkomend: 0, uitgaand: 0, btw: 0 };
  const bankTotalen = data?.bankTotalen ?? {
    werkelijkeKostenIncl: 0,
    werkelijkeBtw: 0,
    bankTxAantal: 0,
    zonderBonBedrag: 0,
    zonderBonAantal: 0,
  };
  const dekkingPct =
    bankTotalen.werkelijkeKostenIncl > 0
      ? Math.round(((bankTotalen.werkelijkeKostenIncl - bankTotalen.zonderBonBedrag) / bankTotalen.werkelijkeKostenIncl) * 100)
      : 100;

  const filteredDocs = useMemo(() => {
    if (!data) return [];
    if (koppeling === "gematcht") {
      return data.documenten.filter((d) => d.status === "gematcht" || d.status === "betaald" || d.type === "bonnetje");
    }
    if (koppeling === "onbekoppeld") {
      return data.documenten.filter((d) => d.status === "onbekoppeld");
    }
    return data.documenten;
  }, [data, koppeling]);

  const grouped = useMemo(() => groupByMonth(filteredDocs), [filteredDocs]);

  // ─── Render ─────────────────────────────────────────────────
  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">Administratie</h1>
            <p className="text-base text-autronis-text-secondary mt-1">
              Documenten-archief voor je facturen en bonnetjes. Klik op een inkomende factuur om te koppelen. Voor je BTW-aangifte zie <a href="/belasting" className="text-autronis-accent hover:underline">/belasting</a>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-card border border-autronis-border text-autronis-text-secondary text-sm font-medium hover:text-autronis-text-primary hover:border-autronis-accent/30 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Onbekoppeld banner */}
        {onbekoppeldAantal > 0 && (
          <div
            className={cn(
              "w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors",
              koppeling === "onbekoppeld"
                ? "bg-amber-500/15 border-amber-500/40"
                : "bg-amber-500/10 border-amber-500/20"
            )}
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <button
              onClick={() => setKoppeling(koppeling === "onbekoppeld" ? "alle" : "onbekoppeld")}
              className="flex-1 text-left group"
            >
              <p className="text-amber-300 text-sm font-medium group-hover:text-amber-200 transition-colors">
                {onbekoppeldAantal} {onbekoppeldAantal === 1 ? "factuur wacht" : "facturen wachten"} op koppeling aan een bank-transactie
              </p>
              <p className="text-amber-300/60 text-xs mt-0.5">
                {koppeling === "onbekoppeld" ? "Klik om filter uit te zetten" : "Klik om alleen onbekoppelde te tonen"}
              </p>
            </button>
            <button
              onClick={handleRematch}
              disabled={rematching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-colors disabled:opacity-50 shrink-0"
              title="Probeer alle onbekoppelde facturen opnieuw te matchen aan bank-transacties"
            >
              <Sparkles className={cn("w-3.5 h-3.5", rematching && "animate-spin")} />
              {rematching ? "Matchen..." : "Match opnieuw"}
            </button>
          </div>
        )}

        {/* Dekking-overzicht — toont werkelijke uitgaven uit bank vs hoeveel
            daar al een bewijs-PDF van is. Klikbaar: scrollt naar "zonder bon"
            filter op /financien zodat je direct kan uploaden. */}
        {bankTotalen.bankTxAantal > 0 && (
          <div className="bg-gradient-to-br from-autronis-accent/8 via-autronis-card to-autronis-card border border-autronis-accent/20 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-autronis-text-primary">
                  Kostendekking {formatPeriodeLabel(jaar, kwartaal)}
                </h2>
                <p className="text-xs text-autronis-text-secondary mt-0.5">
                  Voor hoeveel van je <strong>uitgaven</strong> heb je een bewijs-PDF? Nodig om voorbelasting terug te vragen.
                  Verzonden facturen hebben hun eigen PDF en tellen niet mee.
                </p>
              </div>
              <div className="text-right">
                <p className={cn(
                  "text-3xl font-bold tabular-nums",
                  dekkingPct >= 90 ? "text-emerald-400" :
                  dekkingPct >= 50 ? "text-yellow-400" : "text-orange-400"
                )}>
                  {dekkingPct}%
                </p>
                <p className="text-[11px] text-autronis-text-secondary">bewijs compleet</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-autronis-bg rounded-full overflow-hidden mb-4">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  dekkingPct >= 90 ? "bg-emerald-500" :
                  dekkingPct >= 50 ? "bg-yellow-500" : "bg-orange-500"
                )}
                style={{ width: `${dekkingPct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-autronis-text-secondary mb-0.5">Werkelijke kosten</p>
                <p className="font-bold text-autronis-text-primary tabular-nums">{formatCurrency(bankTotalen.werkelijkeKostenIncl)}</p>
                <p className="text-[10px] text-autronis-text-secondary">{bankTotalen.bankTxAantal} transacties</p>
              </div>
              <div>
                <p className="text-autronis-text-secondary mb-0.5">Met bewijs-PDF</p>
                <p className="font-bold text-emerald-400 tabular-nums">
                  {formatCurrency(bankTotalen.werkelijkeKostenIncl - bankTotalen.zonderBonBedrag)}
                </p>
                <p className="text-[10px] text-autronis-text-secondary">
                  {bankTotalen.bankTxAantal - bankTotalen.zonderBonAantal} gekoppeld
                  {onbekoppeldAantal > 0 && (
                    <> · <button
                      onClick={() => setKoppeling("onbekoppeld")}
                      className="text-autronis-accent hover:underline"
                    >{onbekoppeldAantal} losse PDF&apos;s in archief</button></>
                  )}
                </p>
              </div>
              <div>
                <p className="text-autronis-text-secondary mb-0.5">Zonder bon</p>
                <a
                  href="/financien?filter=zonder-bon"
                  className="font-bold text-orange-400 tabular-nums hover:underline"
                >
                  {formatCurrency(bankTotalen.zonderBonBedrag)}
                </a>
                <p className="text-[10px] text-autronis-text-secondary">{bankTotalen.zonderBonAantal} items · upload vanuit /financien</p>
              </div>
              <div>
                <p className="text-autronis-text-secondary mb-0.5">BTW bij aangifte</p>
                <p className="font-bold text-autronis-accent tabular-nums">{formatCurrency(bankTotalen.werkelijkeBtw)}</p>
                <p className="text-[10px] text-autronis-text-secondary">uit bank, klopt met /belasting</p>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards — wat er in het documenten-archief zit */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
            <div className="flex items-center gap-2 text-autronis-text-secondary text-xs uppercase tracking-wide mb-2">
              <TrendingDown className="w-3.5 h-3.5" />
              Ontvangen facturen
            </div>
            <p className="text-2xl font-bold tabular-nums text-rose-400">
              {formatCurrency(totalen.inkomend)}
            </p>
            <p className="text-[11px] text-autronis-text-secondary mt-1">
              Bonnen/facturen van leveranciers (= kosten)
            </p>
          </div>
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
            <div className="flex items-center gap-2 text-autronis-text-secondary text-xs uppercase tracking-wide mb-2">
              <TrendingUp className="w-3.5 h-3.5" />
              Verzonden facturen
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-400">
              {formatCurrency(totalen.uitgaand)}
            </p>
            <p className="text-[11px] text-autronis-text-secondary mt-1">
              Eigen facturen aan klanten (= omzet)
            </p>
          </div>
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
            <div className="flex items-center gap-2 text-autronis-text-secondary text-xs uppercase tracking-wide mb-2">
              <Calculator className="w-3.5 h-3.5" />
              BTW op deze documenten
            </div>
            <p className="text-2xl font-bold tabular-nums text-autronis-text-primary">
              {formatCurrency(totalen.btw)}
            </p>
            <p className="text-[11px] text-autronis-text-secondary mt-1">
              Alleen PDFs in archief — voor echte aangifte zie /belasting
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year pills */}
          <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setJaar(y)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                  jaar === y
                    ? "bg-autronis-accent text-autronis-bg"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Quarter pills */}
          <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
            {quarters.map((q) => (
              <button
                key={q.value}
                onClick={() => setKwartaal(q.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                  kwartaal === q.value
                    ? "bg-autronis-bg text-autronis-text-primary"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Type pills */}
          <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
            {typeFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setType(f.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                  type === f.value
                    ? "bg-autronis-bg text-autronis-text-primary"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Koppeling quick filter */}
          <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1 ml-auto">
            {(["alle", "gematcht", "onbekoppeld"] as KoppelingFilter[]).map((k) => (
              <button
                key={k}
                onClick={() => setKoppeling(k)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize",
                  koppeling === k
                    ? "bg-autronis-bg text-autronis-text-primary"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                {k === "gematcht" && <Link2 className="w-3 h-3" />}
                {k === "onbekoppeld" && <Link2Off className="w-3 h-3" />}
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Documents grouped by month */}
        {loading ? (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center text-autronis-text-secondary text-sm">
            Laden...
          </div>
        ) : grouped.length === 0 ? (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center text-autronis-text-secondary text-sm">
            Geen documenten gevonden met de huidige filters
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ month, items, totaal }) => (
              <div
                key={month}
                className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden"
              >
                {/* Month header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-autronis-border/60 bg-autronis-bg/30">
                  <h3 className="text-[11px] uppercase tracking-wider font-semibold text-autronis-text-secondary">
                    {MONTH_NAMES[month.slice(5, 7)] ?? month} {month.slice(0, 4)}
                  </h3>
                  <span className="text-[11px] text-autronis-text-secondary tabular-nums">
                    {formatCurrency(totaal)} · {items.length}
                  </span>
                </div>

                {/* Document rows */}
                <div className="divide-y divide-autronis-border/30">
                  {items.map((doc) => {
                    const isOnbekoppeld = doc.status === "onbekoppeld";
                    const openHandler = () => {
                      if (doc.type === "inkomend") {
                        // Inkomende facturen openen de koppel modal — daar kan
                        // je PDF bekijken én koppelen / ontkoppelen.
                        setKoppelFactuurId(doc.id);
                      } else if (doc.type === "uitgaand") {
                        // Eigen facturen: als er een PDF is open die, anders
                        // navigeer naar de factuur detail page in het dashboard.
                        if (doc.storageUrl) {
                          openDocument(doc.storageUrl);
                        } else {
                          window.open(`/facturen/${doc.id}`, "_self");
                        }
                      } else {
                        // Bonnetjes openen direct de PDF.
                        openDocument(doc.storageUrl);
                      }
                    };
                    return (
                      <button
                        key={`${doc.type}-${doc.id}`}
                        onClick={openHandler}
                        className="w-full flex items-center gap-4 pl-4 pr-5 py-3.5 hover:bg-autronis-bg/40 transition-colors text-left relative"
                      >
                        {/* Colored left accent bar — per type */}
                        <span
                          className={cn(
                            "absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm",
                            doc.type === "uitgaand"
                              ? "bg-emerald-500"
                              : doc.type === "bonnetje"
                                ? "bg-sky-500"
                                : "bg-rose-500"
                          )}
                        />

                        {/* Icon */}
                        <div className="flex-shrink-0 text-autronis-text-secondary">
                          {doc.type === "bonnetje" ? (
                            <Receipt className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>

                        {/* Leverancier + factuurnummer */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-autronis-text-primary truncate">
                              {doc.leverancier}
                            </p>
                            {doc.verwerktInAangifte && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/25 font-medium whitespace-nowrap"
                                title={`Al aangegeven in ${doc.verwerktInAangifte} — telt niet mee in totalen`}
                              >
                                ✓ {doc.verwerktInAangifte}
                              </span>
                            )}
                          </div>
                          {doc.factuurnummer && (
                            <p className="text-xs text-autronis-text-secondary truncate">
                              {doc.factuurnummer}
                            </p>
                          )}
                        </div>

                        {/* Amount */}
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums shrink-0",
                            doc.type === "uitgaand" ? "text-emerald-400" : "text-rose-300"
                          )}
                        >
                          {doc.type === "uitgaand" ? "+" : "−"}
                          {formatCurrency(doc.bedrag)}
                        </span>

                        {/* Date */}
                        <span className="text-xs text-autronis-text-secondary w-14 text-right shrink-0 tabular-nums">
                          {formatDatumKort(doc.datum)}
                        </span>

                        {/* Status */}
                        <div className="flex-shrink-0" title={doc.status}>
                          {isOnbekoppeld ? (
                            <Clock className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <KoppelModal
        factuurId={koppelFactuurId}
        onClose={() => setKoppelFactuurId(null)}
        onLinked={fetchData}
      />
    </PageTransition>
  );
}
