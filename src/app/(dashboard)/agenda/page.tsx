"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Clock,
  X,
  Trash2,
  CalendarCheck,
  AlertTriangle,
  Landmark,
  Bell,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";

interface AgendaItem {
  id: number;
  gebruikerId: number | null;
  gebruikerNaam: string | null;
  titel: string;
  omschrijving: string | null;
  type: string;
  startDatum: string;
  eindDatum: string | null;
  heleDag: number | null;
  herinneringMinuten: number | null;
}

const typeConfig: Record<string, { icon: typeof Calendar; color: string; bg: string; label: string }> = {
  afspraak: { icon: CalendarCheck, color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30", label: "Afspraak" },
  deadline: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", label: "Deadline" },
  belasting: { icon: Landmark, color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30", label: "Belasting" },
  herinnering: { icon: Bell, color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30", label: "Herinnering" },
};

const DAGEN = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const MAANDEN = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

function getMaandDagen(jaar: number, maand: number) {
  const eersteDag = new Date(jaar, maand, 1);
  // Get day of week (0=Sun), convert to Mon=0
  let startDag = eersteDag.getDay() - 1;
  if (startDag < 0) startDag = 6;

  const aantalDagen = new Date(jaar, maand + 1, 0).getDate();
  const vorigeMaandDagen = new Date(jaar, maand, 0).getDate();

  const cellen: { dag: number; maand: number; jaar: number; isHuidigeMaand: boolean }[] = [];

  // Vorige maand
  for (let i = startDag - 1; i >= 0; i--) {
    const d = vorigeMaandDagen - i;
    const m = maand === 0 ? 11 : maand - 1;
    const j = maand === 0 ? jaar - 1 : jaar;
    cellen.push({ dag: d, maand: m, jaar: j, isHuidigeMaand: false });
  }

  // Huidige maand
  for (let d = 1; d <= aantalDagen; d++) {
    cellen.push({ dag: d, maand, jaar, isHuidigeMaand: true });
  }

  // Volgende maand — vul tot 42 cellen (6 rijen)
  const rest = 42 - cellen.length;
  for (let d = 1; d <= rest; d++) {
    const m = maand === 11 ? 0 : maand + 1;
    const j = maand === 11 ? jaar + 1 : jaar;
    cellen.push({ dag: d, maand: m, jaar: j, isHuidigeMaand: false });
  }

  return cellen;
}

function datumStr(jaar: number, maand: number, dag: number) {
  return `${jaar}-${String(maand + 1).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

export default function AgendaPage() {
  const { addToast } = useToast();
  const vandaag = new Date();
  const [jaar, setJaar] = useState(vandaag.getFullYear());
  const [maand, setMaand] = useState(vandaag.getMonth());
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);

  // Nieuw item form
  const [titel, setTitel] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [type, setType] = useState<string>("afspraak");
  const [startDatum, setStartDatum] = useState("");
  const [startTijd, setStartTijd] = useState("09:00");
  const [eindTijd, setEindTijd] = useState("10:00");
  const [heleDag, setHeleDag] = useState(false);
  const [formLaden, setFormLaden] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch range: vorige maand start tot volgende maand eind
      const van = datumStr(maand === 0 ? jaar - 1 : jaar, maand === 0 ? 11 : maand - 1, 1);
      const totJaar = maand === 11 ? jaar + 1 : jaar;
      const totMaand = maand === 11 ? 0 : maand + 1;
      const totDagen = new Date(totJaar, totMaand + 1, 0).getDate();
      const tot = datumStr(totJaar, totMaand, totDagen);

      const res = await fetch(`/api/agenda?van=${van}&tot=${tot}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(json.items);
    } catch {
      addToast("Kon agenda niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [jaar, maand, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const cellen = useMemo(() => getMaandDagen(jaar, maand), [jaar, maand]);

  const itemsPerDag = useMemo(() => {
    const map: Record<string, AgendaItem[]> = {};
    for (const item of items) {
      const dag = item.startDatum.slice(0, 10);
      if (!map[dag]) map[dag] = [];
      map[dag].push(item);
    }
    return map;
  }, [items]);

  function navigeer(richting: number) {
    let nm = maand + richting;
    let nj = jaar;
    if (nm < 0) { nm = 11; nj--; }
    if (nm > 11) { nm = 0; nj++; }
    setMaand(nm);
    setJaar(nj);
  }

  function openNieuwModal(datum?: string) {
    setSelectedItem(null);
    setTitel("");
    setOmschrijving("");
    setType("afspraak");
    setStartDatum(datum || datumStr(jaar, maand, vandaag.getDate()));
    setStartTijd("09:00");
    setEindTijd("10:00");
    setHeleDag(false);
    setModalOpen(true);
  }

  function openItemDetail(item: AgendaItem) {
    setSelectedItem(item);
    setTitel(item.titel);
    setOmschrijving(item.omschrijving || "");
    setType(item.type);
    setStartDatum(item.startDatum.slice(0, 10));
    setStartTijd(item.startDatum.length > 10 ? item.startDatum.slice(11, 16) : "09:00");
    setEindTijd(item.eindDatum ? item.eindDatum.slice(11, 16) : "10:00");
    setHeleDag(item.heleDag === 1);
    setModalOpen(true);
  }

  async function handleOpslaan() {
    if (!titel.trim()) {
      addToast("Titel is verplicht", "fout");
      return;
    }
    setFormLaden(true);
    try {
      const startFull = heleDag ? startDatum : `${startDatum}T${startTijd}:00`;
      const eindFull = heleDag ? null : `${startDatum}T${eindTijd}:00`;

      if (selectedItem) {
        // Update
        const res = await fetch(`/api/agenda/${selectedItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titel: titel.trim(),
            omschrijving: omschrijving.trim() || null,
            type,
            startDatum: startFull,
            eindDatum: eindFull,
            heleDag,
          }),
        });
        if (!res.ok) throw new Error();
        addToast("Item bijgewerkt", "succes");
      } else {
        // Create
        const res = await fetch("/api/agenda", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titel: titel.trim(),
            omschrijving: omschrijving.trim() || null,
            type,
            startDatum: startFull,
            eindDatum: eindFull,
            heleDag,
          }),
        });
        if (!res.ok) throw new Error();
        addToast("Item aangemaakt", "succes");
      }
      setModalOpen(false);
      fetchData();
    } catch {
      addToast("Kon item niet opslaan", "fout");
    } finally {
      setFormLaden(false);
    }
  }

  async function handleVerwijder() {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/agenda/${selectedItem.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Item verwijderd");
      setModalOpen(false);
      fetchData();
    } catch {
      addToast("Kon item niet verwijderen", "fout");
    }
  }

  const vandaagStr = datumStr(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());

  // Upcoming items for sidebar
  const aankomend = items
    .filter((i) => i.startDatum.slice(0, 10) >= vandaagStr)
    .sort((a, b) => a.startDatum.localeCompare(b.startDatum))
    .slice(0, 8);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <Skeleton className="h-[600px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">Agenda</h1>
          <p className="text-base text-autronis-text-secondary mt-1">
            {items.length} items deze periode
          </p>
        </div>
        <button
          onClick={() => openNieuwModal()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
        >
          <Plus className="w-4 h-4" />
          Nieuw item
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Kalender */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
          {/* Navigatie */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigeer(-1)}
              className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-autronis-text-primary">
              {MAANDEN[maand]} {jaar}
            </h2>
            <button
              onClick={() => navigeer(1)}
              className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Dag headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAGEN.map((dag) => (
              <div key={dag} className="text-center text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider py-2">
                {dag}
              </div>
            ))}
          </div>

          {/* Kalender grid */}
          <div className="grid grid-cols-7 gap-1">
            {cellen.map((cel, i) => {
              const ds = datumStr(cel.jaar, cel.maand, cel.dag);
              const dagItems = itemsPerDag[ds] || [];
              const isVandaag = ds === vandaagStr;

              return (
                <div
                  key={i}
                  onClick={() => openNieuwModal(ds)}
                  className={cn(
                    "min-h-[90px] p-1.5 rounded-xl border cursor-pointer transition-colors",
                    cel.isHuidigeMaand
                      ? "bg-autronis-bg/30 border-autronis-border/30 hover:border-autronis-accent/50"
                      : "bg-transparent border-transparent opacity-40",
                    isVandaag && "ring-2 ring-autronis-accent/50"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full",
                      isVandaag
                        ? "bg-autronis-accent text-autronis-bg"
                        : cel.isHuidigeMaand
                        ? "text-autronis-text-primary"
                        : "text-autronis-text-secondary"
                    )}
                  >
                    {cel.dag}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {dagItems.slice(0, 3).map((item) => {
                      const tc = typeConfig[item.type] || typeConfig.afspraak;
                      return (
                        <button
                          key={item.id}
                          onClick={(e) => { e.stopPropagation(); openItemDetail(item); }}
                          className={cn(
                            "w-full text-left text-[11px] font-medium px-1.5 py-0.5 rounded border truncate",
                            tc.bg, tc.color
                          )}
                        >
                          {item.titel}
                        </button>
                      );
                    })}
                    {dagItems.length > 3 && (
                      <span className="text-[10px] text-autronis-text-secondary pl-1">
                        +{dagItems.length - 3} meer
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: aankomende items */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-autronis-text-primary mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-autronis-accent" />
            Aankomend
          </h3>
          {aankomend.length === 0 ? (
            <p className="text-sm text-autronis-text-secondary">Geen aankomende items.</p>
          ) : (
            <div className="space-y-3">
              {aankomend.map((item) => {
                const tc = typeConfig[item.type] || typeConfig.afspraak;
                const TypeIcon = tc.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => openItemDetail(item)}
                    className="w-full text-left p-3 rounded-xl bg-autronis-bg/30 hover:bg-autronis-bg/50 border border-autronis-border/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("p-1.5 rounded-lg mt-0.5", tc.bg.split(" ")[0])}>
                        <TypeIcon className={cn("w-3.5 h-3.5", tc.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-autronis-text-primary truncate">
                          {item.titel}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-autronis-text-secondary">
                            {formatDatum(item.startDatum.slice(0, 10))}
                          </span>
                          {item.heleDag !== 1 && item.startDatum.length > 10 && (
                            <span className="text-xs text-autronis-text-secondary flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.startDatum.slice(11, 16)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-modal border border-autronis-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-autronis-text-primary">
                {selectedItem ? "Item bewerken" : "Nieuw agenda-item"}
              </h3>
              <div className="flex items-center gap-2">
                {selectedItem && (
                  <button
                    onClick={handleVerwijder}
                    className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-autronis-text-secondary">Titel *</label>
                <input
                  type="text"
                  value={titel}
                  onChange={(e) => setTitel(e.target.value)}
                  placeholder="Bijv. Meeting met klant"
                  className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-autronis-text-secondary">Type</label>
                <div className="flex items-center gap-2">
                  {Object.entries(typeConfig).map(([key, tc]) => {
                    const TypeIcon = tc.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setType(key)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                          type === key
                            ? cn(tc.bg, tc.color)
                            : "border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                        )}
                      >
                        <TypeIcon className="w-3.5 h-3.5" />
                        {tc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Datum</label>
                  <input
                    type="date"
                    value={startDatum}
                    onChange={(e) => setStartDatum(e.target.value)}
                    className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                  />
                </div>
                <div className="space-y-1.5 flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer py-3">
                    <input
                      type="checkbox"
                      checked={heleDag}
                      onChange={(e) => setHeleDag(e.target.checked)}
                      className="w-4 h-4 rounded border-autronis-border text-autronis-accent focus:ring-autronis-accent/50"
                    />
                    <span className="text-sm text-autronis-text-secondary">Hele dag</span>
                  </label>
                </div>
              </div>

              {!heleDag && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-autronis-text-secondary">Begintijd</label>
                    <input
                      type="time"
                      value={startTijd}
                      onChange={(e) => setStartTijd(e.target.value)}
                      className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-autronis-text-secondary">Eindtijd</label>
                    <input
                      type="time"
                      value={eindTijd}
                      onChange={(e) => setEindTijd(e.target.value)}
                      className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-autronis-text-secondary">Omschrijving</label>
                <textarea
                  value={omschrijving}
                  onChange={(e) => setOmschrijving(e.target.value)}
                  placeholder="Optioneel..."
                  rows={2}
                  className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleOpslaan}
                disabled={formLaden}
                className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
              >
                {formLaden ? "Opslaan..." : selectedItem ? "Bijwerken" : "Toevoegen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
