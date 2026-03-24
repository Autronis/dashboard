"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
  Settings2,
  Link2,
  Loader2,
  MapPin,
  Users,
  Video,
  CheckSquare,
  ListTodo,
  Zap,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgenda, useExterneEvents, useExterneKalenders, useAddKalender, useDeleteKalender, useDeadlineEvents, useAgendaTaken } from "@/hooks/queries/use-agenda";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgendaItem, ExternEvent, ExterneKalender, DeadlineEvent, AgendaTaak } from "@/hooks/queries/use-agenda";
import { DagView } from "./dag-view";
import { JaarView } from "./jaar-view";
import Link from "next/link";

const typeConfig: Record<string, { icon: typeof Calendar; color: string; bg: string; borderColor: string; label: string }> = {
  afspraak: { icon: CalendarCheck, color: "text-autronis-accent", bg: "bg-autronis-accent/15 border-autronis-accent/30", borderColor: "#17B8A5", label: "Afspraak" },
  deadline: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", borderColor: "#ef4444", label: "Deadline" },
  belasting: { icon: Landmark, color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30", borderColor: "#eab308", label: "Belasting" },
  herinnering: { icon: Bell, color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30", borderColor: "#a855f7", label: "Herinnering" },
};

// Categorize external events by content
function getExternEventColor(event: ExternEvent): { bg: string; text: string; border: string } {
  const titel = event.titel.toLowerCase();
  // Meetings
  if (event.meetingUrl || event.deelnemers.length > 0 || titel.includes("meeting") || titel.includes("call") || titel.includes("gesprek")) {
    return { bg: "rgba(139,92,246,0.15)", text: "#a78bfa", border: "#a78bfa" }; // purple
  }
  // Deadlines
  if (titel.includes("deadline") || titel.includes("oplevering") || titel.includes("due")) {
    return { bg: "rgba(239,68,68,0.15)", text: "#f87171", border: "#f87171" }; // red
  }
  // Hele dag events
  if (event.heleDag) {
    return { bg: "rgba(234,179,8,0.15)", text: "#facc15", border: "#facc15" }; // yellow
  }
  // Default: use calendar color
  return { bg: `${event.kleur}20`, text: event.kleur, border: event.kleur };
}

const DAGEN = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const MAANDEN = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

function getMaandDagen(jaar: number, maand: number) {
  const eersteDag = new Date(jaar, maand, 1);
  let startDag = eersteDag.getDay() - 1;
  if (startDag < 0) startDag = 6;

  const aantalDagen = new Date(jaar, maand + 1, 0).getDate();
  const vorigeMaandDagen = new Date(jaar, maand, 0).getDate();

  const cellen: { dag: number; maand: number; jaar: number; isHuidigeMaand: boolean }[] = [];

  for (let i = startDag - 1; i >= 0; i--) {
    const d = vorigeMaandDagen - i;
    const m = maand === 0 ? 11 : maand - 1;
    const j = maand === 0 ? jaar - 1 : jaar;
    cellen.push({ dag: d, maand: m, jaar: j, isHuidigeMaand: false });
  }

  for (let d = 1; d <= aantalDagen; d++) {
    cellen.push({ dag: d, maand, jaar, isHuidigeMaand: true });
  }

  // Minimaliseer lege rijen: 35 cellen als 5 weken genoeg is, anders 42
  const minCellen = cellen.length <= 35 ? 35 : 42;
  const rest = minCellen - cellen.length;
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
  const queryClient = useQueryClient();
  const vandaag = new Date();
  const [jaar, setJaar] = useState(vandaag.getFullYear());
  const [maand, setMaand] = useState(vandaag.getMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);
  const [kalenderSettingsOpen, setKalenderSettingsOpen] = useState(false);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [titel, setTitel] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [type, setType] = useState<string>("afspraak");
  const [startDatum, setStartDatum] = useState("");
  const [startTijd, setStartTijd] = useState("09:00");
  const [eindTijd, setEindTijd] = useState("10:00");
  const [heleDag, setHeleDag] = useState(false);

  // Google Calendar status check
  const checkGoogleStatus = useCallback(() => {
    fetch("/api/auth/google")
      .then((r) => r.json())
      .then((data) => setGoogleConnected(data.connected ?? false))
      .catch(() => setGoogleConnected(false));
  }, []);

  useEffect(() => {
    checkGoogleStatus();
    // Check URL params for callback result
    const params = new URLSearchParams(window.location.search);
    const googleParam = params.get("google");
    if (googleParam === "connected") {
      addToast("Google Calendar gekoppeld!", "succes");
      setGoogleConnected(true);
      window.history.replaceState({}, "", "/agenda");
    } else if (googleParam === "error") {
      addToast("Google Calendar koppeling mislukt", "fout");
      window.history.replaceState({}, "", "/agenda");
    }
  }, [checkGoogleStatus, addToast]);

  const handleGoogleConnect = async () => {
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/auth/google", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      addToast("Kon Google Calendar niet koppelen", "fout");
    }
    setGoogleLoading(false);
  };

  const handleGoogleDisconnect = async () => {
    await fetch("/api/auth/google", { method: "DELETE" });
    setGoogleConnected(false);
    addToast("Google Calendar ontkoppeld", "succes");
  };

  const { data: items = [], isLoading: loading } = useAgenda(jaar, maand);
  const { data: externeEvents = [] } = useExterneEvents(jaar, maand);
  const { data: deadlineEvents = [] } = useDeadlineEvents(jaar, maand);
  const { data: kalenders = [] } = useExterneKalenders();
  const { data: agendaTaken = [] } = useAgendaTaken();

  // Filters
  const [filterType, setFilterType] = useState<string>("alle");
  const [toonTaken, setToonTaken] = useState(true);
  // Selected day for detail panel
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Taken stats voor vandaag-strip
  const takenStats = useMemo(() => {
    const openTaken = agendaTaken.filter((t) => t.status === "open");
    const bezigTaken = agendaTaken.filter((t) => t.status === "bezig");
    const hoogPrio = agendaTaken.filter((t) => t.prioriteit === "hoog");
    const zonderDeadline = agendaTaken.filter((t) => !t.deadline && t.status !== "afgerond");
    return { open: openTaken.length, bezig: bezigTaken.length, hoogPrio: hoogPrio.length, zonderDeadline: zonderDeadline.length, totaal: agendaTaken.length };
  }, [agendaTaken]);

  // Taken per dag voor kalender (alleen taken met deadline)
  const takenPerDag = useMemo(() => {
    const map: Record<string, AgendaTaak[]> = {};
    for (const taak of agendaTaken) {
      if (!taak.deadline) continue;
      const dag = taak.deadline.slice(0, 10);
      if (!map[dag]) map[dag] = [];
      map[dag].push(taak);
    }
    return map;
  }, [agendaTaken]);

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { alle: 0, afspraak: 0, extern: 0, deadline: 0, belasting: 0, herinnering: 0 };
    for (const item of items) {
      counts.alle++;
      if (item.type in counts) counts[item.type]++;
    }
    for (const _event of externeEvents) {
      counts.alle++;
      counts.extern++;
    }
    for (const _dl of deadlineEvents) {
      counts.alle++;
      counts.deadline++;
    }
    return counts;
  }, [items, externeEvents, deadlineEvents]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { item: AgendaItem | null; body: Record<string, unknown> }) => {
      const url = payload.item ? `/api/agenda/${payload.item.id}` : "/api/agenda";
      const method = payload.item ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      if (!res.ok) throw new Error();
      return payload.item !== null;
    },
    onSuccess: (wasUpdate) => {
      addToast(wasUpdate ? "Item bijgewerkt" : "Item aangemaakt", "succes");
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: () => {
      addToast("Kon item niet opslaan", "fout");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/agenda/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      addToast("Item verwijderd");
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: () => {
      addToast("Kon item niet verwijderen", "fout");
    },
  });

  const cellen = useMemo(() => getMaandDagen(jaar, maand), [jaar, maand]);

  // Merge internal + external + deadline events per day
  const itemsPerDag = useMemo(() => {
    const map: Record<string, Array<AgendaItem | ExternEvent | DeadlineEvent>> = {};
    for (const item of items) {
      if (filterType !== "alle" && item.type !== filterType) continue;
      const dag = item.startDatum.slice(0, 10);
      if (!map[dag]) map[dag] = [];
      map[dag].push(item);
    }
    for (const event of externeEvents) {
      if (filterType !== "alle" && filterType !== "extern") continue;
      const dag = event.startDatum.slice(0, 10);
      if (!map[dag]) map[dag] = [];
      map[dag].push(event);
    }
    for (const dl of deadlineEvents) {
      if (filterType !== "alle" && filterType !== "deadline") continue;
      const dag = dl.datum.slice(0, 10);
      if (!map[dag]) map[dag] = [];
      map[dag].push(dl);
    }
    return map;
  }, [items, externeEvents, deadlineEvents, filterType]);

  function navigeer(richting: number) {
    let nm = maand + richting;
    let nj = jaar;
    if (nm < 0) { nm = 11; nj--; }
    if (nm > 11) { nm = 0; nj++; }
    setMaand(nm);
    setJaar(nj);
    setWeekOffset(0);
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

  function handleOpslaan() {
    if (!titel.trim()) {
      addToast("Titel is verplicht", "fout");
      return;
    }
    const startFull = heleDag ? startDatum : `${startDatum}T${startTijd}:00`;
    const eindFull = heleDag ? null : `${startDatum}T${eindTijd}:00`;

    saveMutation.mutate({
      item: selectedItem,
      body: {
        titel: titel.trim(),
        omschrijving: omschrijving.trim() || null,
        type,
        startDatum: startFull,
        eindDatum: eindFull,
        heleDag,
      },
    });
  }

  function handleVerwijder() {
    if (!selectedItem) return;
    deleteMutation.mutate(selectedItem.id);
  }

  const [weergave, setWeergave] = useState<"dag" | "week" | "maand" | "jaar">("week");
  const [selectedDag, setSelectedDag] = useState<Date>(new Date());
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const vandaagStr = datumStr(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());

  // Vandaag-strip data
  const vandaagItems = useMemo(() => {
    return itemsPerDag[vandaagStr] || [];
  }, [itemsPerDag, vandaagStr]);

  const volgendEvent = useMemo(() => {
    const nu = new Date();
    const toekomstig = vandaagItems
      .filter((item) => {
        const startStr = "startDatum" in item ? item.startDatum : ("datum" in item ? item.datum : null);
        if (!startStr || startStr.length <= 10) return false; // hele dag events skippen
        const start = new Date(startStr);
        return start > nu;
      })
      .sort((a, b) => {
        const aStr = "startDatum" in a ? a.startDatum : ("datum" in a ? a.datum : "");
        const bStr = "startDatum" in b ? b.startDatum : ("datum" in b ? b.datum : "");
        return aStr.localeCompare(bStr);
      });
    return toekomstig[0] || null;
  }, [vandaagItems]);

  const countdownTekst = useMemo(() => {
    if (!volgendEvent) return null;
    const nu = new Date();
    const startStr = "startDatum" in volgendEvent ? volgendEvent.startDatum : ("datum" in volgendEvent ? volgendEvent.datum : "");
    const start = new Date(startStr);
    const diffMin = Math.round((start.getTime() - nu.getTime()) / 60000);
    if (diffMin < 1) return "nu";
    if (diffMin < 60) return `over ${diffMin} min`;
    const uren = Math.floor(diffMin / 60);
    const min = diffMin % 60;
    return min > 0 ? `over ${uren}u ${min}min` : `over ${uren}u`;
  }, [volgendEvent]);

  // Week view helpers
  const weekDagen = useMemo(() => {
    // Use selected date if in current month, otherwise first of month
    const ref = new Date(jaar, maand, vandaag.getMonth() === maand && vandaag.getFullYear() === jaar ? vandaag.getDate() : 1);
    const dag = ref.getDay(); // 0=zo
    const maandag = new Date(ref);
    maandag.setDate(ref.getDate() - ((dag + 6) % 7) + weekOffset * 7);

    const dagen: { datum: Date; datumStr: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(maandag);
      dd.setDate(maandag.getDate() + i);
      dagen.push({
        datum: dd,
        datumStr: datumStr(dd.getFullYear(), dd.getMonth(), dd.getDate()),
      });
    }
    return dagen;
  }, [jaar, maand, vandaag, weekOffset]);

  // Dynamische uren op basis van events in de week (minimaal 07:00-21:00)
  const weekUren = useMemo(() => {
    let min = 7;
    let max = 21;
    const nu = new Date();

    for (const wd of weekDagen) {
      const dagItems = itemsPerDag[wd.datumStr] || [];
      for (const item of dagItems) {
        const startStr = "startDatum" in item ? item.startDatum : "";
        if (startStr.length <= 10) continue;
        const d = new Date(startStr);
        min = Math.min(min, d.getHours());
        const eindStr = "eindDatum" in item ? (item as AgendaItem | ExternEvent).eindDatum : null;
        if (eindStr) {
          max = Math.max(max, new Date(eindStr).getHours() + 1);
        } else {
          max = Math.max(max, d.getHours() + 1);
        }
      }
    }

    // Voeg huidige uur toe als vandaag in de week zit
    if (weekDagen.some((wd) => wd.datumStr === vandaagStr)) {
      min = Math.min(min, nu.getHours());
      max = Math.max(max, nu.getHours() + 1);
    }

    min = Math.max(0, min - 1);
    max = Math.min(24, max);
    return Array.from({ length: max - min }, (_, i) => i + min);
  }, [weekDagen, itemsPerDag, vandaagStr]);

  // Helper to extract meeting URLs from text
  const extractMeetingUrl = useCallback((text: string | null | undefined): string | null => {
    if (!text) return null;
    const patterns = [
      /https?:\/\/meet\.google\.com\/[a-z\-]+/i,
      /https?:\/\/[\w.]*zoom\.us\/j\/\d+[^\s]*/i,
      /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s]+/i,
      /https?:\/\/[\w.]*webex\.com\/[^\s]+/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }, []);

  // Merge internal + external upcoming events
  const aankomend = [
    ...items.filter((i) => i.startDatum.slice(0, 10) >= vandaagStr).map((i) => ({ ...i, isExtern: false as const })),
    ...externeEvents.filter((e) => e.startDatum.slice(0, 10) >= vandaagStr).map((e) => ({ ...e, isExtern: true as const })),
  ]
    .sort((a, b) => a.startDatum.localeCompare(b.startDatum))
    .slice(0, 10);

  if (loading) {
    return (
      <div className="p-4 lg:p-5 space-y-4">
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
    <div className="p-3 sm:p-4 lg:p-5 xl:p-6 space-y-3 sm:space-y-4">
     <div className="max-w-[1400px] mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-autronis-text-primary">Agenda</h1>
          <p className="text-sm text-autronis-text-secondary mt-1">
            Vandaag: {vandaagItems.length} event{vandaagItems.length !== 1 ? "s" : ""}
            {takenStats.totaal > 0 && (
              <span className="text-autronis-accent ml-1">
                · {takenStats.open + takenStats.bezig} open taken
              </span>
            )}
            {kalenders.length > 0 && (
              <span className="text-autronis-text-secondary/60 ml-1">
                · {kalenders.length} kalender{kalenders.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {googleConnected === false && (
            <button
              onClick={handleGoogleConnect}
              disabled={googleLoading}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-autronis-bg border border-autronis-border hover:border-autronis-accent/40 text-autronis-text-secondary rounded-xl text-xs sm:text-sm transition-colors"
            >
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              <span className="hidden sm:inline">Google Calendar koppelen</span>
              <span className="sm:hidden">Google</span>
            </button>
          )}
          {googleConnected === true && (
            <button
              onClick={handleGoogleDisconnect}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl text-xs sm:text-sm transition-colors hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
            >
              <CalendarCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Google gekoppeld</span>
            </button>
          )}
          <button
            onClick={() => setKalenderSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-autronis-bg border border-autronis-border hover:border-autronis-accent/40 text-autronis-text-secondary rounded-xl text-xs sm:text-sm transition-colors"
          >
            <Link2 className="w-4 h-4" />
            <span className="hidden sm:inline">Kalenders</span>
          </button>
          <button
            onClick={() => openNieuwModal()}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Nieuw item</span>
            <span className="xs:hidden">Nieuw</span>
          </button>
        </div>
      </div>

      {/* Vandaag overzicht */}
      <div className="bg-autronis-card border border-autronis-border rounded-xl p-3 sm:p-4 space-y-3">
        {/* Bovenste rij: datum + volgend event */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-autronis-accent animate-pulse" />
            <span className="text-sm font-semibold text-autronis-text-primary">Vandaag</span>
            <span className="text-sm text-autronis-text-secondary">
              {vandaag.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>

          <div className="w-px h-6 bg-autronis-border hidden sm:block" />

          <div className="flex items-center gap-2 text-sm">
            {volgendEvent ? (
              <>
                <Clock className="w-3.5 h-3.5 text-autronis-accent" />
                <span className="text-autronis-text-primary font-medium">
                  {"titel" in volgendEvent ? volgendEvent.titel : ""}
                </span>
                <span className="text-autronis-accent font-medium tabular-nums">{countdownTekst}</span>
              </>
            ) : (
              <span className="text-autronis-text-secondary">
                {vandaagItems.length > 0 ? "Geen komende events meer" : "Vrije dag — geen events"}
              </span>
            )}
          </div>
        </div>

        {/* Statistieken kaartjes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-autronis-bg/40 rounded-lg px-3 py-2 border border-autronis-border/30">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-autronis-accent" />
              <span className="text-xs text-autronis-text-secondary">Events</span>
            </div>
            <p className="text-lg font-bold text-autronis-text-primary mt-0.5 tabular-nums">{vandaagItems.length}</p>
          </div>
          <div className="bg-autronis-bg/40 rounded-lg px-3 py-2 border border-autronis-border/30">
            <div className="flex items-center gap-2">
              <ListTodo className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs text-autronis-text-secondary">Open taken</span>
            </div>
            <p className="text-lg font-bold text-autronis-text-primary mt-0.5 tabular-nums">
              {takenStats.open + takenStats.bezig}
              {takenStats.hoogPrio > 0 && (
                <span className="text-xs text-red-400 font-medium ml-1.5">({takenStats.hoogPrio} hoog)</span>
              )}
            </p>
          </div>
          <div className="bg-autronis-bg/40 rounded-lg px-3 py-2 border border-autronis-border/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-autronis-text-secondary">Niet ingepland</span>
            </div>
            <p className="text-lg font-bold text-autronis-text-primary mt-0.5 tabular-nums">{takenStats.zonderDeadline}</p>
          </div>
          <div className="bg-autronis-bg/40 rounded-lg px-3 py-2 border border-autronis-border/30">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs text-autronis-text-secondary">Bezig</span>
            </div>
            <p className="text-lg font-bold text-autronis-text-primary mt-0.5 tabular-nums">{takenStats.bezig}</p>
          </div>
        </div>

        {/* Mini timeline (als er events zijn) */}
        {vandaagItems.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-autronis-text-secondary/50 tabular-nums">07</span>
            <div className="flex-1 h-2.5 bg-autronis-bg/50 rounded-full relative overflow-hidden">
              {vandaagItems.map((item) => {
                const startStr = "startDatum" in item ? item.startDatum : ("datum" in item ? item.datum : "");
                const eindStr = "eindDatum" in item ? (item as AgendaItem | ExternEvent).eindDatum : null;
                const isHeleDag = "heleDag" in item && ((item as AgendaItem).heleDag === 1 || (item as ExternEvent).heleDag === true);
                if (isHeleDag) {
                  const isExtern = "bron" in item;
                  const kleur = isExtern ? getExternEventColor(item as ExternEvent).border : (typeConfig[(item as AgendaItem).type] || typeConfig.afspraak).borderColor;
                  return (
                    <div key={item.id} className="absolute top-0 h-full rounded-full opacity-60" style={{ left: "0%", width: "100%", backgroundColor: kleur }} />
                  );
                }
                if (startStr.length <= 10) return null;
                const startDate = new Date(startStr);
                const startMin = startDate.getHours() * 60 + startDate.getMinutes();
                const eindMin = eindStr ? (() => { const e = new Date(eindStr); return e.getHours() * 60 + e.getMinutes(); })() : startMin + 60;
                const rangeStart = 420;
                const rangeEnd = 1260;
                const left = Math.max(0, ((startMin - rangeStart) / (rangeEnd - rangeStart)) * 100);
                const width = Math.max(2, ((Math.min(eindMin, rangeEnd) - Math.max(startMin, rangeStart)) / (rangeEnd - rangeStart)) * 100);
                const isExtern = "bron" in item;
                const kleur = isExtern ? getExternEventColor(item as ExternEvent).border : (typeConfig[(item as AgendaItem).type] || typeConfig.afspraak).borderColor;
                return (
                  <div key={item.id} className="absolute top-0 h-full rounded-full opacity-70" style={{ left: `${left}%`, width: `${width}%`, backgroundColor: kleur }} />
                );
              })}
              {/* Nu-indicator op timeline */}
              {(() => {
                const nu = new Date();
                const nuMin = nu.getHours() * 60 + nu.getMinutes();
                const pos = ((nuMin - 420) / (1260 - 420)) * 100;
                if (pos < 0 || pos > 100) return null;
                return <div className="absolute top-0 h-full w-0.5 bg-red-500" style={{ left: `${pos}%` }} />;
              })()}
            </div>
            <span className="text-[10px] text-autronis-text-secondary/50 tabular-nums">21</span>
          </div>
        )}
      </div>

      {/* Snelfilters */}
      <div className="flex gap-2 flex-wrap items-center">
        {[
          { value: "alle", label: "Alle" },
          { value: "afspraak", label: "Afspraken", color: "#17B8A5" },
          { value: "extern", label: "Extern", color: "#a78bfa" },
          { value: "deadline", label: "Deadlines", color: "#ef4444" },
          { value: "belasting", label: "Belasting", color: "#eab308" },
          { value: "herinnering", label: "Herinneringen", color: "#a855f7" },
        ].map((f) => {
          const count = filterCounts[f.value] ?? 0;
          return (
            <button
              key={f.value}
              onClick={() => setFilterType(f.value)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5",
                filterType === f.value
                  ? "border-autronis-accent bg-autronis-accent/10 text-autronis-accent"
                  : "border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/40"
              )}
            >
              {f.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />}
              {f.label}
              {count > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full tabular-nums",
                  filterType === f.value ? "bg-autronis-accent/20" : "bg-autronis-bg/50"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        <div className="w-px h-5 bg-autronis-border mx-1 hidden sm:block" />

        {/* Taken toggle */}
        <button
          onClick={() => setToonTaken((v) => !v)}
          className={cn(
            "px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5",
            toonTaken
              ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
              : "border-autronis-border text-autronis-text-secondary hover:border-orange-500/40"
          )}
        >
          <CheckSquare className="w-3 h-3" />
          Taken
          {takenStats.totaal > 0 && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full tabular-nums",
              toonTaken ? "bg-orange-500/20" : "bg-autronis-bg/50"
            )}>
              {takenStats.open + takenStats.bezig}
            </span>
          )}
        </button>
      </div>
     </div>

      <div className="max-w-[1400px] mx-auto grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-[1fr_300px]">
        {/* Kalender */}
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-3 sm:p-4 lg:p-5">
          {/* Navigatie */}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigeer(-1)}
                className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg sm:text-xl font-bold text-autronis-text-primary px-1 sm:px-2">
                {MAANDEN[maand]} {jaar}
              </h2>
              <button
                onClick={() => navigeer(1)}
                className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            {/* View toggle */}
            <div className="flex items-center bg-autronis-bg/50 rounded-lg p-0.5 border border-autronis-border/50">
              {(["dag", "week", "maand", "jaar"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setWeergave(v);
                    if (v === "dag") setSelectedDag(new Date(jaar, maand, vandaag.getMonth() === maand ? vandaag.getDate() : 1));
                    if (v === "week") setWeekOffset(0);
                  }}
                  className={cn(
                    "px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors capitalize",
                    weergave === v
                      ? "bg-autronis-accent text-autronis-bg"
                      : "text-autronis-text-secondary hover:text-autronis-text-primary"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {weergave === "dag" ? (
            <DagView
              datum={selectedDag}
              onNavigeer={(r) => {
                const d = new Date(selectedDag);
                d.setDate(d.getDate() + r);
                setSelectedDag(d);
                setJaar(d.getFullYear());
                setMaand(d.getMonth());
              }}
              items={(() => {
                const ds = `${selectedDag.getFullYear()}-${String(selectedDag.getMonth() + 1).padStart(2, "0")}-${String(selectedDag.getDate()).padStart(2, "0")}`;
                return itemsPerDag[ds] || [];
              })()}
              onItemClick={(item) => openItemDetail(item)}
              onSlotClick={(d) => openNieuwModal(d)}
            />
          ) : weergave === "jaar" ? (
            <JaarView
              jaar={jaar}
              onNavigeer={(r) => setJaar((j) => j + r)}
              items={[...items, ...externeEvents]}
              onMaandClick={(m) => { setMaand(m); setWeergave("maand"); }}
            />
          ) : weergave === "maand" ? (
            <>
              {/* Dag headers */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
                {DAGEN.map((dag) => (
                  <div key={dag} className="text-center text-[10px] sm:text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider py-1 sm:py-2">
                    {dag}
                  </div>
                ))}
              </div>

              {/* Kalender grid */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                {cellen.map((cel, i) => {
                  const ds = datumStr(cel.jaar, cel.maand, cel.dag);
                  const dagItems = itemsPerDag[ds] || [];
                  const isVandaag = ds === vandaagStr;
                  const isHovered = hoveredDay === ds;

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDay(ds === selectedDay ? null : ds)}
                      onDoubleClick={() => openNieuwModal(ds)}
                      onMouseEnter={() => dagItems.length > 3 ? setHoveredDay(ds) : setHoveredDay(null)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={cn(
                        "relative min-h-[56px] sm:min-h-[80px] lg:min-h-[100px] p-0.5 sm:p-1 lg:p-1.5 rounded-lg sm:rounded-xl border cursor-pointer transition-all",
                        ds === selectedDay
                          ? "bg-autronis-accent/10 border-autronis-accent/50"
                          : cel.isHuidigeMaand
                          ? "bg-autronis-bg/30 border-autronis-border/30 hover:border-autronis-accent/50"
                          : "bg-transparent border-transparent opacity-40",
                        isVandaag && "ring-2 ring-autronis-accent/60 shadow-[0_0_12px_rgba(23,184,165,0.15)]"
                      )}
                    >
                      <span
                        className={cn(
                          "text-[10px] sm:text-sm font-medium inline-flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 rounded-full",
                          isVandaag
                            ? "bg-autronis-accent text-autronis-bg font-bold shadow-lg shadow-autronis-accent/30"
                            : cel.isHuidigeMaand
                            ? "text-autronis-text-primary"
                            : "text-autronis-text-secondary"
                        )}
                      >
                        {cel.dag}
                      </span>
                      <div className="mt-0.5 sm:mt-1 space-y-0.5 sm:space-y-1">
                        {dagItems.slice(0, 3).map((item) => {
                          // Deadline events (from taken/projecten/facturen)
                          if ("linkHref" in item) {
                            const dl = item as DeadlineEvent;
                            const dlColor = dl.type === "factuur" ? "#f97316" : dl.type === "project" ? "#8b5cf6" : "#ef4444";
                            return (
                              <Link
                                key={dl.id}
                                href={dl.linkHref}
                                onClick={(e) => e.stopPropagation()}
                                className="block w-full text-left text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 py-0.5 sm:py-1 rounded truncate leading-tight"
                                style={{ backgroundColor: `${dlColor}15`, color: dlColor, borderLeft: `2px dashed ${dlColor}` }}
                              >
                                <span className="hidden sm:inline">{dl.titel}</span>
                                <span className="sm:hidden">·</span>
                              </Link>
                            );
                          }
                          const isExtern = "bron" in item;
                          if (isExtern) {
                            const ext = item as ExternEvent;
                            const ec = getExternEventColor(ext);
                            const startTime = !ext.heleDag && ext.startDatum.length > 10
                              ? new Date(ext.startDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
                              : null;
                            return (
                              <div
                                key={item.id}
                                className="w-full text-left text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 py-0.5 sm:py-1 rounded truncate border-l-2 border-transparent leading-tight"
                                style={{ backgroundColor: ec.bg, color: ec.text, borderLeftColor: ec.border }}
                              >
                                <span className="hidden sm:inline">
                                  {startTime && <span className="text-[10px] opacity-70 mr-1 tabular-nums">{startTime}</span>}
                                  {ext.titel}
                                </span>
                                <span className="sm:hidden">·</span>
                              </div>
                            );
                          }
                          const tc = typeConfig[(item as AgendaItem).type] || typeConfig.afspraak;
                          const ai = item as AgendaItem;
                          const startTime = ai.heleDag !== 1 && ai.startDatum.length > 10
                            ? new Date(ai.startDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
                            : null;
                          return (
                            <button
                              key={item.id}
                              onClick={(e) => { e.stopPropagation(); openItemDetail(ai); }}
                              className="w-full text-left text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 py-0.5 sm:py-1 rounded border-l-2 border-transparent truncate leading-tight"
                              style={{ backgroundColor: `${tc.borderColor}20`, color: tc.borderColor, borderLeftColor: tc.borderColor }}
                            >
                              <span className="hidden sm:inline">
                                {startTime && <span className="text-[10px] opacity-70 mr-1 tabular-nums">{startTime}</span>}
                                {ai.titel}
                              </span>
                              <span className="sm:hidden">·</span>
                            </button>
                          );
                        })}
                        {dagItems.length > 3 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedDay(ds); }}
                            className="text-[9px] sm:text-[11px] text-autronis-accent font-medium pl-0.5 sm:pl-1 hover:underline"
                          >
                            <span className="hidden sm:inline">+{dagItems.length - 3} meer</span>
                            <span className="sm:hidden">+{dagItems.length - 3}</span>
                          </button>
                        )}
                      </div>

                      {/* Hover tooltip voor dagen met > 3 events */}
                      {isHovered && dagItems.length > 3 && (
                        <div className="absolute z-30 top-full left-1/2 -translate-x-1/2 mt-1 bg-autronis-card border border-autronis-border rounded-xl p-3 shadow-xl min-w-[220px] max-w-[280px] space-y-1.5"
                          onMouseEnter={() => setHoveredDay(ds)}
                          onMouseLeave={() => setHoveredDay(null)}
                        >
                          <p className="text-xs font-semibold text-autronis-text-primary mb-2">
                            {dagItems.length} events
                          </p>
                          {dagItems.map((item) => {
                            if ("linkHref" in item) {
                              const dl = item as DeadlineEvent;
                              const dlColor = dl.type === "factuur" ? "#f97316" : dl.type === "project" ? "#8b5cf6" : "#ef4444";
                              return (
                                <div key={dl.id} className="text-xs px-2 py-1 rounded border-l-2" style={{ borderLeftColor: dlColor, color: dlColor, backgroundColor: `${dlColor}10` }}>
                                  {dl.titel}
                                </div>
                              );
                            }
                            const isExtern = "bron" in item;
                            if (isExtern) {
                              const ext = item as ExternEvent;
                              const ec = getExternEventColor(ext);
                              const t = !ext.heleDag && ext.startDatum.length > 10 ? new Date(ext.startDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : null;
                              return (
                                <div key={ext.id} className="text-xs px-2 py-1 rounded border-l-2" style={{ borderLeftColor: ec.border, color: ec.text, backgroundColor: ec.bg }}>
                                  {t && <span className="text-[10px] opacity-70 mr-1 tabular-nums">{t}</span>}{ext.titel}
                                </div>
                              );
                            }
                            const ai = item as AgendaItem;
                            const tc = typeConfig[ai.type] || typeConfig.afspraak;
                            const t = ai.heleDag !== 1 && ai.startDatum.length > 10 ? new Date(ai.startDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : null;
                            return (
                              <div key={ai.id} className="text-xs px-2 py-1 rounded border-l-2" style={{ borderLeftColor: tc.borderColor, color: tc.borderColor, backgroundColor: `${tc.borderColor}15` }}>
                                {t && <span className="text-[10px] opacity-70 mr-1 tabular-nums">{t}</span>}{ai.titel}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Week view */
            <div>
              {/* Week navigatie */}
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <button onClick={() => setWeekOffset((o) => o - 1)} className="p-1.5 sm:p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <span className="text-xs sm:text-sm font-medium text-autronis-text-secondary">
                  {weekDagen[0].datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} – {weekDagen[6].datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <button onClick={() => setWeekOffset((o) => o + 1)} className="p-1.5 sm:p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Mobile: lijst-layout per dag */}
              <div className="sm:hidden space-y-2">
                {weekDagen.map((wd) => {
                  const isVandaag = wd.datumStr === vandaagStr;
                  const dagItems = itemsPerDag[wd.datumStr] || [];
                  const dagNaam = wd.datum.toLocaleDateString("nl-NL", { weekday: "short" });
                  const dagNum = wd.datum.getDate();
                  const maandNaam = wd.datum.toLocaleDateString("nl-NL", { month: "short" });

                  return (
                    <div
                      key={wd.datumStr}
                      className={cn(
                        "rounded-xl border p-3",
                        isVandaag
                          ? "border-autronis-accent/40 bg-autronis-accent/5"
                          : dagItems.length > 0
                          ? "border-autronis-border bg-autronis-bg/30"
                          : "border-autronis-border/30 bg-transparent"
                      )}
                      onClick={() => { setWeergave("dag"); setSelectedDag(wd.datum); }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                          isVandaag
                            ? "bg-autronis-accent text-autronis-bg"
                            : "text-autronis-text-primary"
                        )}>
                          {dagNum}
                        </span>
                        <span className={cn(
                          "text-xs font-semibold uppercase",
                          isVandaag ? "text-autronis-accent" : "text-autronis-text-secondary"
                        )}>
                          {dagNaam} {maandNaam}
                        </span>
                        {dagItems.length > 0 && (
                          <span className="text-[10px] text-autronis-text-secondary ml-auto">{dagItems.length} item{dagItems.length !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                      {dagItems.length > 0 ? (
                        <div className="space-y-1 ml-10">
                          {dagItems.slice(0, 4).map((item) => {
                            const isExtern = "bron" in item;
                            const isDeadline = "linkHref" in item;
                            const titel = item.titel;
                            const startStr = "startDatum" in item ? item.startDatum : "";
                            const startTime = startStr.length > 10
                              ? new Date(startStr).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
                              : null;

                            let bgColor: string, textColor: string, borderColor: string;
                            if (isDeadline) {
                              const dl = item as DeadlineEvent;
                              const c = dl.type === "factuur" ? "#f97316" : dl.type === "project" ? "#8b5cf6" : "#ef4444";
                              bgColor = `${c}15`; textColor = c; borderColor = c;
                            } else if (isExtern) {
                              const ec = getExternEventColor(item as ExternEvent);
                              bgColor = ec.bg; textColor = ec.text; borderColor = ec.border;
                            } else {
                              const tc = typeConfig[(item as AgendaItem).type] || typeConfig.afspraak;
                              bgColor = `${tc.borderColor}15`; textColor = tc.borderColor; borderColor = tc.borderColor;
                            }

                            return (
                              <div
                                key={item.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg border-l-[3px] text-xs"
                                style={{ backgroundColor: bgColor, borderLeftColor: borderColor, color: textColor }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isExtern && !isDeadline) openItemDetail(item as AgendaItem);
                                }}
                              >
                                {startTime && <span className="tabular-nums opacity-70 shrink-0">{startTime}</span>}
                                <span className="font-medium truncate">{titel}</span>
                              </div>
                            );
                          })}
                          {dagItems.length > 4 && (
                            <p className="text-[10px] text-autronis-accent ml-2">+{dagItems.length - 4} meer</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-autronis-text-secondary/40 ml-10">Geen items</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop: grid week view */}
              <div className="hidden sm:block overflow-x-auto -mx-1 px-1">
              {/* Dag headers */}
              <div className="grid grid-cols-[48px_repeat(7,1fr)] gap-0">
                <div /> {/* Lege cel voor tijdkolom */}
                {weekDagen.map((wd) => {
                  const isVandaag = wd.datumStr === vandaagStr;
                  const dagNaam = wd.datum.toLocaleDateString("nl-NL", { weekday: "short" });
                  const dagNum = wd.datum.getDate();
                  return (
                    <div
                      key={wd.datumStr}
                      className={cn(
                        "text-center py-2 border-b transition-colors",
                        isVandaag
                          ? "bg-autronis-accent/10 border-autronis-accent/30"
                          : "border-autronis-border/30"
                      )}
                    >
                      <span className={cn(
                        "text-[10px] font-semibold uppercase",
                        isVandaag ? "text-autronis-accent" : "text-autronis-text-secondary"
                      )}>{dagNaam}</span>
                      <span
                        className={cn(
                          "block text-sm font-bold mx-auto mt-0.5",
                          isVandaag
                            ? "text-autronis-bg bg-autronis-accent w-7 h-7 rounded-full flex items-center justify-center leading-none"
                            : "text-autronis-text-primary"
                        )}
                      >
                        {dagNum}
                      </span>
                      {/* Taken indicator */}
                      {toonTaken && (takenPerDag[wd.datumStr]?.length ?? 0) > 0 && (
                        <div className="flex items-center justify-center gap-0.5 mt-1">
                          <CheckSquare className="w-2.5 h-2.5 text-orange-400" />
                          <span className="text-[9px] text-orange-400 font-medium tabular-nums">{takenPerDag[wd.datumStr].length}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tijdblokken grid */}
              <div className="grid grid-cols-[48px_repeat(7,1fr)] gap-0 relative">
                {/* Tijdlabels + rijen */}
                {weekUren.map((uur) => (
                  <div key={uur} className="contents">
                    <div className="h-[64px] flex items-start justify-end pr-2 pt-1">
                      <span className="text-[10px] text-autronis-text-secondary/50 tabular-nums">
                        {String(uur).padStart(2, "0")}:00
                      </span>
                    </div>
                    {weekDagen.map((wd) => {
                      const isVandaag = wd.datumStr === vandaagStr;
                      return (
                        <div
                          key={`${uur}-${wd.datumStr}`}
                          onClick={() => openNieuwModal(wd.datumStr)}
                          className={cn(
                            "h-[64px] border-t border-r border-autronis-border/15 relative cursor-pointer hover:bg-autronis-accent/5 transition-colors",
                            isVandaag && "bg-autronis-accent/[0.04]"
                          )}
                        />
                      );
                    })}
                  </div>
                ))}

                {/* Event blocks per dag kolom — positioned within each cell */}
                {weekDagen.map((wd, dagIdx) => {
                  const dagItems = (itemsPerDag[wd.datumStr] || []).filter((item) => {
                    const isExtern = "bron" in item;
                    const isDeadline = "linkHref" in item;
                    if (isDeadline) return false;
                    const isHeleDag = isExtern
                      ? (item as ExternEvent).heleDag
                      : (item as AgendaItem).heleDag === 1;
                    if (isHeleDag) return false;
                    const startStr = "startDatum" in item ? item.startDatum : "";
                    return startStr.length > 10;
                  });

                  return dagItems.map((item, itemIdx) => {
                    const isExtern = "bron" in item;
                    const startStr = "startDatum" in item ? item.startDatum : "";
                    const startDate = new Date(startStr);
                    const startUur = startDate.getHours();
                    const startMin = startDate.getMinutes();

                    const weekStart = weekUren[0] ?? 7;
                    const weekEind = (weekUren[weekUren.length - 1] ?? 20) + 1;
                    if (startUur < weekStart || startUur >= weekEind) return null;

                    const eindStr = "eindDatum" in item ? (item as AgendaItem | ExternEvent).eindDatum : null;
                    let duurMin = 60;
                    if (eindStr) {
                      const eindDate = new Date(eindStr);
                      duurMin = Math.max(20, (eindDate.getTime() - startDate.getTime()) / 60000);
                    }

                    const slotH = 64;
                    const topOffset = (startUur - weekStart) * slotH + (startMin / 60) * slotH;
                    const height = Math.max(18, (duurMin / 60) * slotH);

                    let bgColor: string, borderColor: string, textColor: string;
                    if (isExtern) {
                      const ec = getExternEventColor(item as ExternEvent);
                      bgColor = ec.bg; borderColor = ec.border; textColor = ec.text;
                    } else {
                      const tc = typeConfig[(item as AgendaItem).type] || typeConfig.afspraak;
                      bgColor = `${tc.borderColor}20`; borderColor = tc.borderColor; textColor = tc.borderColor;
                    }

                    const startTimeStr = `${String(startUur).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
                    const titel = isExtern ? (item as ExternEvent).titel : (item as AgendaItem).titel;

                    // Check overlapping events at same time
                    const overlapping = dagItems.filter((other) => {
                      const otherStart = new Date("startDatum" in other ? other.startDatum : "");
                      const otherEnd = "eindDatum" in other && (other as AgendaItem | ExternEvent).eindDatum
                        ? new Date((other as AgendaItem | ExternEvent).eindDatum!)
                        : new Date(otherStart.getTime() + 3600000);
                      return startDate < otherEnd && new Date(startDate.getTime() + duurMin * 60000) > otherStart;
                    });
                    const overlapIdx = overlapping.indexOf(item);
                    const overlapCount = overlapping.length;
                    const widthPct = overlapCount > 1 ? 100 / overlapCount : 100;
                    const leftPct = overlapCount > 1 ? overlapIdx * widthPct : 0;

                    const eindTimeStr = eindStr ? new Date(eindStr).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : null;

                    return (
                      <div
                        key={`week-${item.id}-${wd.datumStr}`}
                        className="absolute rounded-lg px-2 py-1 overflow-hidden cursor-pointer hover:brightness-125 transition-all border-l-[3px] z-10"
                        style={{
                          top: `${topOffset}px`,
                          height: `${height}px`,
                          backgroundColor: bgColor,
                          borderLeftColor: borderColor,
                          color: textColor,
                          left: `calc(48px + (${dagIdx} + ${leftPct / 100}) * (100% - 48px) / 7 + 2px)`,
                          width: `calc(${widthPct / 100} * (100% - 48px) / 7 - 4px)`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isExtern) openItemDetail(item as AgendaItem);
                        }}
                      >
                        <p className="text-[11px] font-semibold truncate leading-tight">{titel}</p>
                        {height > 28 && (
                          <p className="text-[10px] opacity-70 tabular-nums mt-0.5">
                            {startTimeStr}{eindTimeStr ? ` – ${eindTimeStr}` : ""}
                          </p>
                        )}
                      </div>
                    );
                  });
                })}

                {/* Taken-blokken in week view (als suggested blocks) */}
                {toonTaken && weekDagen.map((wd, dagIdx) => {
                  const dagTaken = takenPerDag[wd.datumStr] || [];
                  if (dagTaken.length === 0) return null;

                  return dagTaken.map((taak, taakIdx) => {
                    const wStart = weekUren[0] ?? 7;
                    // Toon taken als suggested blocks: start na laatste event of vanaf 09:00
                    const suggestedUur = 9 + taakIdx;
                    if (suggestedUur < wStart || suggestedUur >= (weekUren[weekUren.length - 1] ?? 20)) return null;

                    const slotH = 64;
                    const topOffset = (suggestedUur - wStart) * slotH;
                    const height = slotH * 0.9;

                    const prioColor = taak.prioriteit === "hoog" ? "#ef4444" : taak.prioriteit === "normaal" ? "#f97316" : "#6b7280";

                    return (
                      <div
                        key={`taak-${taak.id}-${wd.datumStr}`}
                        className="absolute rounded-lg px-2 py-1 overflow-hidden border-l-[3px] border-dashed z-[5] opacity-50 hover:opacity-90 transition-opacity cursor-default"
                        style={{
                          top: `${topOffset}px`,
                          height: `${height}px`,
                          backgroundColor: `${prioColor}10`,
                          borderLeftColor: prioColor,
                          color: prioColor,
                          left: `calc(48px + ${dagIdx} * (100% - 48px) / 7 + 2px)`,
                          width: `calc((100% - 48px) / 7 - 4px)`,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <CheckSquare className="w-3 h-3 flex-shrink-0" />
                          <p className="text-[11px] font-medium truncate leading-tight">{taak.titel}</p>
                        </div>
                        {height > 28 && taak.projectNaam && (
                          <p className="text-[9px] opacity-60 mt-0.5 truncate">{taak.projectNaam}</p>
                        )}
                      </div>
                    );
                  });
                })}

                {/* Hele-dag events strip bovenaan */}
                {(() => {
                  const heleDagEvents = weekDagen.map((wd) => {
                    const dagItems = itemsPerDag[wd.datumStr] || [];
                    return dagItems.filter((item) => {
                      const isExtern = "bron" in item;
                      const isHeleDag = isExtern
                        ? (item as ExternEvent).heleDag
                        : (item as AgendaItem).heleDag === 1;
                      const itemStart = "startDatum" in item ? item.startDatum : ("datum" in item ? item.datum : "");
                      return isHeleDag || itemStart.length <= 10;
                    });
                  });
                  const hasAny = heleDagEvents.some((e) => e.length > 0);
                  if (!hasAny) return null;

                  return (
                    <div
                      className="absolute top-0 left-[48px] right-0 grid grid-cols-7 gap-0 -translate-y-full bg-autronis-card border-b border-autronis-border/30 py-1"
                    >
                      {weekDagen.map((wd, idx) => {
                        const evts = heleDagEvents[idx];
                        return (
                          <div key={wd.datumStr} className="px-1 space-y-0.5">
                            {evts.slice(0, 2).map((item) => {
                              const isExtern = "bron" in item;
                              const titel = isExtern ? (item as ExternEvent).titel : (item as AgendaItem).titel;
                              let bgColor: string;
                              let textColor: string;
                              if (isExtern) {
                                const ec = getExternEventColor(item as ExternEvent);
                                bgColor = ec.bg;
                                textColor = ec.text;
                              } else {
                                const tc = typeConfig[(item as AgendaItem).type] || typeConfig.afspraak;
                                bgColor = `${tc.borderColor}20`;
                                textColor = tc.borderColor;
                              }
                              return (
                                <div
                                  key={item.id}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded truncate"
                                  style={{ backgroundColor: bgColor, color: textColor }}
                                >
                                  {titel}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Nu-indicator lijn (week view) */}
                {(() => {
                  const nu = new Date();
                  const nuUur = nu.getHours();
                  const nuMin = nu.getMinutes();
                  const wStart = weekUren[0] ?? 7;
                  const wEind = (weekUren[weekUren.length - 1] ?? 20) + 1;
                  if (nuUur < wStart || nuUur >= wEind) return null;
                  // Check of vandaag in deze week zit
                  const vandaagIdx = weekDagen.findIndex((wd) => wd.datumStr === vandaagStr);
                  if (vandaagIdx === -1) return null;
                  const slotHNu = 64;
                  const topOffset = (nuUur - wStart) * slotHNu + (nuMin / 60) * slotHNu;
                  return (
                    <div
                      className="absolute left-[48px] right-0 flex items-center z-20 pointer-events-none"
                      style={{ top: `${topOffset}px` }}
                    >
                      <div
                        className="absolute h-[2px] bg-red-500"
                        style={{
                          left: `calc(${vandaagIdx} * 100% / 7)`,
                          width: `calc(100% / 7)`,
                        }}
                      />
                      <div
                        className="absolute w-3 h-3 rounded-full bg-red-500 -translate-x-1/2 shadow-lg shadow-red-500/40 animate-pulse"
                        style={{
                          left: `calc(${vandaagIdx} * 100% / 7)`,
                        }}
                      />
                    </div>
                  );
                })()}
              </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: dag detail of aankomend */}
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4">
          {selectedDay ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-autronis-accent" />
                  {formatDatum(selectedDay)}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openNieuwModal(selectedDay)}
                    className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors"
                    title="Nieuw item"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {(itemsPerDag[selectedDay] || []).length === 0 ? (
                <p className="text-sm text-autronis-text-secondary">Geen events op deze dag.</p>
              ) : (
                <div className="space-y-3">
                  {(itemsPerDag[selectedDay] || []).map((item) => {
                    // Deadline
                    if ("linkHref" in item) {
                      const dl = item as DeadlineEvent;
                      const dlColor = dl.type === "factuur" ? "#f97316" : dl.type === "project" ? "#8b5cf6" : "#ef4444";
                      return (
                        <Link key={dl.id} href={dl.linkHref} className="block p-3 rounded-xl bg-autronis-bg/30 border border-autronis-border/30 border-l-2 hover:bg-autronis-bg/50 transition-colors" style={{ borderLeftColor: dlColor }}>
                          <p className="text-sm font-medium" style={{ color: dlColor }}>{dl.titel}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-autronis-text-secondary">
                            <span className="capitalize">{dl.type}</span>
                            {dl.klantNaam && <span>· {dl.klantNaam}</span>}
                            {dl.bedrag && <span className="ml-auto tabular-nums">€ {dl.bedrag.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</span>}
                          </div>
                        </Link>
                      );
                    }
                    // Extern
                    if ("bron" in item) {
                      const ext = item as ExternEvent;
                      const ec = getExternEventColor(ext);
                      const startTime = !ext.heleDag && ext.startDatum.length > 10
                        ? new Date(ext.startDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
                        : null;
                      const endTime = ext.eindDatum && !ext.heleDag
                        ? new Date(ext.eindDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
                        : null;
                      return (
                        <div key={ext.id} className="p-3 rounded-xl bg-autronis-bg/30 border border-autronis-border/30 border-l-2" style={{ borderLeftColor: ec.border }}>
                          <p className="text-sm font-medium text-autronis-text-primary">{ext.titel}</p>
                          {startTime && (
                            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: ec.text }}>
                              <Clock className="w-3 h-3" />{startTime}{endTime ? ` – ${endTime}` : ""}
                            </p>
                          )}
                          {ext.deelnemers?.length > 0 && (
                            <p className="text-xs text-autronis-text-secondary mt-1 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {ext.deelnemers.map(d => d.naam || d.email.split("@")[0]).join(", ")}
                            </p>
                          )}
                          {ext.meetingUrl && (
                            <a href={ext.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-autronis-accent hover:underline mt-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Video className="w-3 h-3" />Deelnemen
                            </a>
                          )}
                          {ext.locatie && !ext.meetingUrl && (
                            <p className="text-xs text-autronis-text-secondary/70 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{ext.locatie}</p>
                          )}
                        </div>
                      );
                    }
                    // Intern
                    const ai = item as AgendaItem;
                    const tc = typeConfig[ai.type] || typeConfig.afspraak;
                    const startTime = ai.heleDag !== 1 && ai.startDatum.length > 10
                      ? new Date(ai.startDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
                      : null;
                    return (
                      <button key={ai.id} onClick={() => openItemDetail(ai)} className="w-full text-left p-3 rounded-xl bg-autronis-bg/30 hover:bg-autronis-bg/50 border border-autronis-border/30 border-l-2 transition-colors" style={{ borderLeftColor: tc.borderColor }}>
                        <p className="text-sm font-medium text-autronis-text-primary">{ai.titel}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {startTime && <span className="text-xs flex items-center gap-1" style={{ color: tc.borderColor }}><Clock className="w-3 h-3" />{startTime}</span>}
                          <span className={cn("text-[10px] ml-auto", tc.color)}>{tc.label}</span>
                        </div>
                        {ai.omschrijving && <p className="text-xs text-autronis-text-secondary mt-1 line-clamp-2">{ai.omschrijving}</p>}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-autronis-text-primary mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-autronis-accent" />
                Aankomend
              </h3>
              {aankomend.length === 0 ? (
                <p className="text-sm text-autronis-text-secondary">Geen aankomende items.</p>
          ) : (
            <div className="space-y-3">
              {aankomend.map((item) => {
                // Countdown per item
                const itemStartStr = item.startDatum;
                let itemCountdown: string | null = null;
                if (itemStartStr.length > 10) {
                  const nu = new Date();
                  const start = new Date(itemStartStr);
                  const diffMs = start.getTime() - nu.getTime();
                  if (diffMs > 0) {
                    const diffMin = Math.round(diffMs / 60000);
                    if (diffMin < 60) itemCountdown = `over ${diffMin} min`;
                    else {
                      const uren = Math.floor(diffMin / 60);
                      const min = diffMin % 60;
                      if (uren < 24) itemCountdown = min > 0 ? `over ${uren}u ${min}min` : `over ${uren}u`;
                      else {
                        const dagen = Math.floor(uren / 24);
                        itemCountdown = `over ${dagen}d`;
                      }
                    }
                  }
                }

                if (item.isExtern) {
                  const ext = item;
                  const startTime = !ext.heleDag && ext.startDatum.length > 10
                    ? new Date(ext.startDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
                    : null;
                  const endTime = ext.eindDatum && !ext.heleDag
                    ? new Date(ext.eindDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
                    : null;
                  // Extract meeting URL from description/location if not already present
                  const meetUrl = ext.meetingUrl || extractMeetingUrl(ext.omschrijving) || extractMeetingUrl(ext.locatie);
                  return (
                    <div key={ext.id} className="p-3 rounded-xl bg-autronis-bg/30 border-l-2 border border-autronis-border/30" style={{ borderLeftColor: ext.kleur }}>
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-autronis-text-primary">{ext.titel}</p>
                          {itemCountdown && (
                            <span className="text-[10px] text-autronis-accent font-medium tabular-nums whitespace-nowrap flex-shrink-0 bg-autronis-accent/10 px-1.5 py-0.5 rounded-full">
                              {itemCountdown}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-autronis-text-secondary">{formatDatum(ext.startDatum.slice(0, 10))}</span>
                          {startTime && (
                            <span className="text-xs text-autronis-accent flex items-center gap-1">
                              <Clock className="w-3 h-3" />{startTime}{endTime ? ` – ${endTime}` : ""}
                            </span>
                          )}
                        </div>
                        {/* Deelnemers */}
                        {ext.deelnemers && ext.deelnemers.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <Users className="w-3 h-3 text-autronis-text-secondary flex-shrink-0" />
                            {ext.deelnemers.slice(0, 3).map((d, di) => (
                              <span key={di} className="text-[11px] text-autronis-text-secondary">
                                {d.naam || d.email.split("@")[0]}{di < Math.min(ext.deelnemers.length, 3) - 1 ? "," : ""}
                              </span>
                            ))}
                            {ext.deelnemers.length > 3 && (
                              <span className="text-[10px] text-autronis-text-secondary/60">+{ext.deelnemers.length - 3}</span>
                            )}
                          </div>
                        )}
                        {/* Meeting link button */}
                        {meetUrl && (
                          <a
                            href={meetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25 px-3 py-1.5 rounded-lg transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Video className="w-3.5 h-3.5" />
                            Deelnemen
                          </a>
                        )}
                        {/* Locatie (als geen URL) */}
                        {ext.locatie && !meetUrl && (
                          <p className="text-xs text-autronis-text-secondary/70 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{ext.locatie}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                const tc = typeConfig[item.type] || typeConfig.afspraak;
                const startTime = item.heleDag !== 1 && item.startDatum.length > 10
                  ? new Date(item.startDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
                  : null;
                // Extract meeting URL from internal event description
                const internalMeetUrl = extractMeetingUrl(item.omschrijving);
                return (
                  <button
                    key={item.id}
                    onClick={() => openItemDetail(item)}
                    className="w-full text-left p-3 rounded-xl bg-autronis-bg/30 hover:bg-autronis-bg/50 border border-autronis-border/30 border-l-2 transition-colors"
                    style={{ borderLeftColor: tc.borderColor }}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-autronis-text-primary">{item.titel}</p>
                        {itemCountdown && (
                          <span className="text-[10px] text-autronis-accent font-medium tabular-nums whitespace-nowrap flex-shrink-0 bg-autronis-accent/10 px-1.5 py-0.5 rounded-full">
                            {itemCountdown}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-autronis-text-secondary">{formatDatum(item.startDatum.slice(0, 10))}</span>
                        {startTime && (
                          <span className="text-xs flex items-center gap-1" style={{ color: tc.borderColor }}>
                            <Clock className="w-3 h-3" />{startTime}
                          </span>
                        )}
                        <span className={cn("text-[10px] ml-auto", tc.color)}>{tc.label}</span>
                      </div>
                      {internalMeetUrl && (
                        <a
                          href={internalMeetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25 px-3 py-1.5 rounded-lg transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Video className="w-3.5 h-3.5" />
                          Deelnemen
                        </a>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
            </>
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
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {Object.entries(typeConfig).map(([key, tc]) => {
                    const TypeIcon = tc.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setType(key)}
                        className={cn(
                          "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors border",
                          type === key
                            ? cn(tc.bg, tc.color)
                            : "border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                        )}
                      >
                        <TypeIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        {tc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
                disabled={saveMutation.isPending}
                className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
              >
                {saveMutation.isPending ? "Opslaan..." : selectedItem ? "Bijwerken" : "Toevoegen"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Kalender Settings Modal */}
      {kalenderSettingsOpen && (
        <KalenderSettingsModal
          kalenders={kalenders}
          onClose={() => setKalenderSettingsOpen(false)}
        />
      )}
    </div>
    </PageTransition>
  );
}

// ============ KALENDER SETTINGS MODAL ============

function KalenderSettingsModal({ kalenders, onClose }: { kalenders: ExterneKalender[]; onClose: () => void }) {
  const { addToast } = useToast();
  const addKalender = useAddKalender();
  const deleteKalender = useDeleteKalender();

  const [naam, setNaam] = useState("");
  const [url, setUrl] = useState("");
  const [bron, setBron] = useState<string>("icloud");
  const [kleur, setKleur] = useState("#17B8A5");

  const bronOpties = [
    { value: "icloud", label: "iCloud", kleur: "#FF9500" },
    { value: "google", label: "Google Calendar", kleur: "#4285F4" },
    { value: "outlook", label: "Outlook", kleur: "#0078D4" },
    { value: "overig", label: "Overig", kleur: "#17B8A5" },
  ];

  async function handleToevoegen() {
    if (!naam.trim() || !url.trim()) {
      addToast("Naam en URL zijn verplicht", "fout");
      return;
    }
    try {
      await addKalender.mutateAsync({ naam: naam.trim(), url: url.trim(), bron, kleur });
      addToast("Kalender toegevoegd", "succes");
      setNaam("");
      setUrl("");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Toevoegen mislukt", "fout");
    }
  }

  async function handleVerwijderen(id: number) {
    try {
      await deleteKalender.mutateAsync(id);
      addToast("Kalender verwijderd", "succes");
    } catch {
      addToast("Verwijderen mislukt", "fout");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-autronis-border">
          <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2">
            <Link2 className="w-5 h-5 text-autronis-accent" />
            Externe kalenders
          </h2>
          <button onClick={onClose} className="text-autronis-text-secondary hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Bestaande kalenders */}
          {kalenders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-autronis-text-secondary">Gekoppelde kalenders</h3>
              {kalenders.map((k) => (
                <div key={k.id} className="flex items-center gap-3 bg-autronis-bg/50 rounded-xl p-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: k.kleur ?? "#17B8A5" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-autronis-text-primary truncate">{k.naam}</p>
                    <p className="text-xs text-autronis-text-secondary capitalize">{k.bron}</p>
                  </div>
                  {k.laatstGesyncOp && (
                    <span className="text-[10px] text-autronis-text-secondary/50 flex-shrink-0">
                      Sync: {new Date(k.laatstGesyncOp).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <button onClick={() => handleVerwijderen(k.id)} className="text-autronis-text-secondary hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Nieuwe kalender toevoegen */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-autronis-text-secondary">Nieuwe kalender toevoegen</h3>

            <div className="bg-autronis-bg/30 border border-autronis-border/50 rounded-xl p-4 text-xs text-autronis-text-secondary space-y-2">
              <p className="font-medium text-autronis-text-primary">Hoe vind je de ICS URL?</p>
              <p><strong className="text-orange-400">iCloud:</strong> icloud.com → Kalender → Deel → Openbare kalender → Kopieer URL</p>
              <p><strong className="text-blue-400">Google:</strong> Google Calendar → Instellingen → Kalender → Geheim adres in iCal-indeling</p>
              <p><strong className="text-cyan-400">Outlook:</strong> Outlook.com → Instellingen → Kalender → Gedeelde kalenders → ICS link</p>
            </div>

            <select
              value={bron}
              onChange={(e) => {
                setBron(e.target.value);
                setKleur(bronOpties.find((o) => o.value === e.target.value)?.kleur ?? "#17B8A5");
              }}
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
            >
              {bronOpties.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <input
              type="text"
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              placeholder="Naam (bijv. Persoonlijk, Werk)"
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
            />

            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ICS URL (webcal:// of https://)"
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent font-mono text-xs"
            />

            <div className="flex items-center gap-3">
              <input type="color" value={kleur} onChange={(e) => setKleur(e.target.value)} className="w-8 h-8 rounded-lg border border-autronis-border cursor-pointer" />
              <span className="text-xs text-autronis-text-secondary">Kleur</span>
              <button
                onClick={handleToevoegen}
                disabled={addKalender.isPending || !naam.trim() || !url.trim()}
                className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {addKalender.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Toevoegen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
