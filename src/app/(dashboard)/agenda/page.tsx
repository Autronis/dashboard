"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Check,
  CheckSquare,
  ListTodo,
  Zap,
  Sparkles,
  Phone,
  PenLine,
  FileText,
  Palette,
  Handshake,
  Megaphone,
  CheckCircle2,
} from "lucide-react";
import { SlimmeTakenModal } from "@/components/taken/slimme-taken-modal";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgenda, useExterneEvents, useExterneKalenders, useAddKalender, useDeleteKalender, useDeadlineEvents, useAgendaTaken, usePlanTaak, useUnplanTaak, useUitplannenAlle, useUndoAfgerond } from "@/hooks/queries/use-agenda";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgendaItem, ExternEvent, ExterneKalender, DeadlineEvent, AgendaTaak, RecentAfgerondeTaak } from "@/hooks/queries/use-agenda";
import { DagView } from "./dag-view";
import { JaarView } from "./jaar-view";
import { PlanTaakModal } from "./plan-taak-modal";
import { TaakDetailPanel } from "@/components/taken/taak-detail-panel";
import Link from "next/link";

const typeConfig: Record<string, { icon: typeof Calendar; color: string; bg: string; borderColor: string; label: string }> = {
  afspraak: { icon: CalendarCheck, color: "text-autronis-accent", bg: "bg-autronis-accent/15 border-autronis-accent/30", borderColor: "#17B8A5", label: "Afspraak" },
  deadline: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", borderColor: "#ef4444", label: "Deadline" },
  belasting: { icon: Landmark, color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30", borderColor: "#eab308", label: "Belasting" },
  herinnering: { icon: Bell, color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30", borderColor: "#a855f7", label: "Herinnering" },
};

// Project color palette — consistent per project name
const PROJECT_PALET = [
  { bg: "rgba(99,102,241,0.18)", border: "#6366f1", text: "#a5b4fc" },   // indigo
  { bg: "rgba(16,185,129,0.18)", border: "#10b981", text: "#6ee7b7" },   // emerald
  { bg: "rgba(245,158,11,0.18)", border: "#f59e0b", text: "#fcd34d" },   // amber
  { bg: "rgba(239,68,68,0.18)", border: "#ef4444", text: "#fca5a5" },    // red
  { bg: "rgba(168,85,247,0.18)", border: "#a855f7", text: "#d8b4fe" },   // purple
  { bg: "rgba(6,182,212,0.18)", border: "#06b6d4", text: "#67e8f9" },    // cyan
  { bg: "rgba(249,115,22,0.18)", border: "#f97316", text: "#fdba74" },   // orange
  { bg: "rgba(236,72,153,0.18)", border: "#ec4899", text: "#f9a8d4" },   // pink
];

function hashStr(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getProjectKleur(projectNaam: string | null) {
  if (!projectNaam) return PROJECT_PALET[0];
  return PROJECT_PALET[hashStr(projectNaam) % PROJECT_PALET.length];
}

// Cluster kleur — voor slimme acties cards en cluster badges. Zes vaste
// clusters (zie src/lib/cluster.ts), elk z'n eigen subtle accent zodat
// Sem in 1 oogopslag ziet welk type werk een suggestie is.
const CLUSTER_KLEUR: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  "backend-infra": { bg: "rgba(168,85,247,0.08)", text: "#c4a8ff", border: "rgba(168,85,247,0.35)", badge: "bg-purple-500/20 text-purple-300" },
  "frontend":      { bg: "rgba(34,211,238,0.08)", text: "#7dd3fc", border: "rgba(34,211,238,0.35)", badge: "bg-cyan-500/20 text-cyan-300" },
  "klantcontact":  { bg: "rgba(16,185,129,0.08)", text: "#86efac", border: "rgba(16,185,129,0.35)", badge: "bg-emerald-500/20 text-emerald-300" },
  "content":       { bg: "rgba(245,158,11,0.08)", text: "#fcd34d", border: "rgba(245,158,11,0.35)", badge: "bg-amber-500/20 text-amber-300" },
  "admin":         { bg: "rgba(148,163,184,0.08)", text: "#cbd5e1", border: "rgba(148,163,184,0.35)", badge: "bg-slate-500/25 text-slate-300" },
  "research":      { bg: "rgba(23,184,165,0.08)", text: "#5eead4", border: "rgba(23,184,165,0.35)", badge: "bg-teal-500/20 text-teal-300" },
};
function getClusterKleur(cluster: string | null | undefined) {
  return CLUSTER_KLEUR[cluster ?? ""] ?? { bg: "rgba(148,163,184,0.05)", text: "#94a3b8", border: "rgba(148,163,184,0.25)", badge: "bg-slate-500/20 text-slate-400" };
}

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
  const [taakDetailId, setTaakDetailId] = useState<number | null>(null);
  const [kalenderSettingsOpen, setKalenderSettingsOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTaakIds, setSelectedTaakIds] = useState<Set<number>>(new Set());
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Real-time klok — update elke minuut
  const [nuTijd, setNuTijd] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNuTijd(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

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

  // Start/Afrond cluster sessie buttons in dag-view dispatchen dit event
  // zodat we de agenda-taken opnieuw fetchen na een bulk status update.
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-taken"] });
      queryClient.invalidateQueries({ queryKey: ["taken"] });
    };
    window.addEventListener("autronis:agenda-refetch", handler);
    return () => window.removeEventListener("autronis:agenda-refetch", handler);
  }, [queryClient]);

  // Toast events van dag-view sessie knoppen (Start/Afrond)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ bericht: string; type: "succes" | "fout" }>).detail;
      if (detail?.bericht) addToast(detail.bericht, detail.type ?? "succes");
    };
    window.addEventListener("autronis:toast", handler);
    return () => window.removeEventListener("autronis:toast", handler);
  }, [addToast]);

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
  const { data: agendaTakenData } = useAgendaTaken();
  const agendaTaken = agendaTakenData?.taken ?? [];
  const recentAfgerond = agendaTakenData?.recentAfgerond ?? [];
  const planTaak = usePlanTaak();
  const unplanTaak = useUnplanTaak();
  const undoAfgerond = useUndoAfgerond();
  const uitplannenAlle = useUitplannenAlle();
  // Routines (terugkerende checks)
  interface Routine {
    id: number;
    naam: string;
    beschrijving: string | null;
    categorie: string;
    frequentie: string;
    status: "ok" | "binnenkort" | "overdue";
    dagenGeleden: number | null;
  }
  const [routinesData, setRoutinesData] = useState<Routine[]>([]);
  useEffect(() => {
    fetch("/api/routines").then((r) => r.json()).then((d) => setRoutinesData(d.routines ?? [])).catch(() => {});
  }, []);

  const overdueRoutines = routinesData.filter((r) => r.status === "overdue");
  const binnenkortRoutines = routinesData.filter((r) => r.status === "binnenkort");
  const dueRoutines = [...overdueRoutines, ...binnenkortRoutines];

  async function markeerRoutineVoltooid(id: number) {
    await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setRoutinesData((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: "ok" as const, dagenGeleden: 0, laatstVoltooid: new Date().toISOString() } : r)
    );
    addToast("Routine afgevinkt", "succes");
  }

  async function planRoutineAlsTaak(routine: Routine) {
    try {
      // Maak taak aan
      const res = await fetch("/api/taken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel: routine.naam,
          omschrijving: routine.beschrijving,
          status: "open",
          prioriteit: routine.status === "overdue" ? "hoog" : "normaal",
          eigenaar: "sem",
          fase: "Routines",
        }),
      });
      if (!res.ok) throw new Error("Taak aanmaken mislukt");
      addToast(`"${routine.naam}" als taak ingepland`, "succes");
      queryClient.invalidateQueries({ queryKey: ["agenda-taken"] });
      queryClient.invalidateQueries({ queryKey: ["taken"] });
    } catch {
      addToast("Kon routine niet inplannen", "fout");
    }
  }

  const [planModalTaak, setPlanModalTaak] = useState<AgendaTaak | null>(null);
  const [planPrefillDatum, setPlanPrefillDatum] = useState<string | undefined>();
  const [planPrefillTijd, setPlanPrefillTijd] = useState<string | undefined>();

  // Drag state voor taken
  const [dragTaak, setDragTaak] = useState<AgendaTaak | null>(null);
  // Drag state voor agenda items
  const [dragAgendaItem, setDragAgendaItem] = useState<AgendaItem | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<string>("alle");
  const [toonTaken, setToonTaken] = useState(true);
  // Selected day for detail panel
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Sidebar tabs
  const [sidebarTab, setSidebarTab] = useState<"plannen" | "vandaag" | "aankomend">("plannen");
  const [plannenFilter, setPlannenFilter] = useState<"alle" | "hoog" | "bezig">("alle");
  const [expandedProjecten, setExpandedProjecten] = useState<Set<string>>(new Set());
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [slimmeTakenOpen, setSlimmeTakenOpen] = useState(false);
  const [slimmeTakenPreSelect, setSlimmeTakenPreSelect] = useState<string | undefined>();

  // Templates voor de slimme acties sectie. Worden direct uit
  // /api/taken/slim geladen en als draggable cards getoond zodat Sem
  // een template kan klikken/slepen zonder eerst de modal te openen.
  type SlimmeTemplate = {
    id: string;
    slug: string;
    naam: string;
    beschrijving: string | null;
    cluster: string;
    geschatteDuur: number | null;
    velden: Array<{ key: string; label: string }> | null;
  };
  const [slimmeTemplates, setSlimmeTemplates] = useState<SlimmeTemplate[]>([]);
  useEffect(() => {
    let cancelled = false;
    const fetchTpls = () => {
      fetch("/api/taken/slim")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && Array.isArray(d.templates)) setSlimmeTemplates(d.templates);
        })
        .catch(() => {});
    };
    fetchTpls();
    // Refetch wanneer modal nieuwe templates accepteert/toevoegt
    const onUpdate = () => fetchTpls();
    window.addEventListener("autronis:slimme-templates-updated", onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("autronis:slimme-templates-updated", onUpdate);
    };
  }, []);

  function handlePlanTaak(id: number, start: string, eind: string, duur: number, kalenderId?: number) {
    planTaak.mutate(
      { id, ingeplandStart: start, ingeplandEind: eind, geschatteDuur: duur, kalenderId },
      {
        onSuccess: () => {
          addToast("Taak ingepland", "succes");
          setPlanModalTaak(null);
        },
        onError: () => addToast("Kon taak niet inplannen", "fout"),
      }
    );
  }

  function handleUnplanTaak(id: number) {
    unplanTaak.mutate(id, {
      onSuccess: () => addToast("Taak uit agenda gehaald", "succes"),
      onError: () => addToast("Kon taak niet uitplannen", "fout"),
    });
  }

  function toggleTaakSelect(id: number) {
    setSelectedTaakIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkAction(action: "afronden" | "ontplannen" | "verwijderen") {
    const ids = Array.from(selectedTaakIds);
    if (ids.length === 0) return;
    const body =
      action === "afronden" ? { status: "afgerond" }
      : action === "ontplannen" ? { ingeplandStart: null, ingeplandEind: null }
      : null;

    let ok = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/taken/${id}`, {
          method: body ? "PUT" : "DELETE",
          headers: { "Content-Type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (res.ok) ok++;
      } catch { /* skip */ }
    }

    const labels = { afronden: "afgerond", ontplannen: "uit planning gehaald", verwijderen: "verwijderd" };
    addToast(`${ok} ${ok === 1 ? "taak" : "taken"} ${labels[action]}`, "succes");
    setSelectedTaakIds(new Set());
    setSelectMode(false);
    queryClient.invalidateQueries({ queryKey: ["agenda-taken"] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
    queryClient.invalidateQueries({ queryKey: ["taken"] });
  }

  // Plan een hele fase in één keer. Alle taken krijgen consecutief slots
  // vanaf het gevraagde startmoment, met variabele duur per taak (geen vaste 15 min).
  // SEQUENTIEEL — wacht op elke mutation zodat de backend overlap-detectie verse
  // DB-state ziet en taken niet bovenop elkaar landen.
  async function handlePlanFase(taken: AgendaTaak[], datum: string, startTijd: string) {
    if (taken.length === 0) return;

    // Kijk of er al taken ingepland zijn op deze datum — zo ja, begin daarachter
    // met 5 min buffer. Anders gebruik de opgegeven startTijd als start.
    const bestaandOpDatum = ingeplandeTaken.filter(
      (t) => t.ingeplandStart?.startsWith(datum)
    );
    let effectieveStartTijd = startTijd;
    if (bestaandOpDatum.length > 0) {
      const laatsteEind = Math.max(
        ...bestaandOpDatum.map((t) =>
          new Date(t.ingeplandEind || t.ingeplandStart!).getTime()
        )
      );
      const eind = new Date(laatsteEind + 5 * 60000);
      const min = eind.getMinutes();
      const rounded = Math.ceil(min / 5) * 5;
      if (rounded === 60) {
        eind.setHours(eind.getHours() + 1);
        eind.setMinutes(0);
      } else {
        eind.setMinutes(rounded);
      }
      effectieveStartTijd = `${String(eind.getHours()).padStart(2, "0")}:${String(eind.getMinutes()).padStart(2, "0")}`;
    }

    const [h, m] = effectieveStartTijd.split(":").map(Number);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    // Cursor schuift mee per taak op basis van werkelijke duur (niet vaste i * duur)
    let cursorMs = new Date(`${datum}T${pad(h)}:${pad(m)}:00`).getTime();
    let okCount = 0;
    let errCount = 0;

    for (const t of taken) {
      const duur = t.geschatteDuur || 15;
      const start = new Date(cursorMs);
      const eind = new Date(cursorMs + duur * 60000);
      try {
        await planTaak.mutateAsync({
          id: t.id,
          ingeplandStart: fmt(start),
          ingeplandEind: fmt(eind),
          geschatteDuur: duur,
        });
        okCount++;
      } catch {
        errCount++;
      }
      // Schuif cursor met 1 min buffer zodat de backend overlap-detectie geen
      // collision detecteert en de taken écht consecutief landen
      cursorMs = eind.getTime() + 60000;
    }

    addToast(`Fase ingepland (${okCount}/${taken.length})`, errCount === 0 ? "succes" : "fout");
  }

  async function handleTaakToggle(id: number, huidigeStatus?: string) {
    const nieuweStatus = huidigeStatus === "afgerond" ? "open" : "afgerond";
    try {
      const res = await fetch(`/api/taken/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nieuweStatus }),
      });
      if (!res.ok) throw new Error();
      addToast(nieuweStatus === "afgerond" ? "Taak afgerond" : "Taak heropend", "succes");
      queryClient.invalidateQueries({ queryKey: ["agenda-taken"] });
      queryClient.invalidateQueries({ queryKey: ["deadline-events"] });
      queryClient.invalidateQueries({ queryKey: ["taken"] });
    } catch {
      addToast("Kon taak niet bijwerken", "fout");
    }
  }

  function openPlanModal(taak: AgendaTaak, datum?: string, tijd?: string) {
    setPlanModalTaak(taak);
    setPlanPrefillDatum(datum);
    setPlanPrefillTijd(tijd);
  }

  // Ingeplande taken (hebben ingeplandStart)
  const ingeplandeTaken = useMemo(() => agendaTaken.filter((t) => t.ingeplandStart), [agendaTaken]);
  // Niet ingeplande taken (voor sidebar)
  const nietIngeplandeTaken = useMemo(() => agendaTaken.filter((t) => !t.ingeplandStart), [agendaTaken]);

  // Groepeer niet-ingeplande taken per project → fase. Fase is de primaire werkeenheid.
  // Slimme acties: losse Claude-uitvoerbare taken (projectId=null,
  // fase=Slimme taken). Apart getoond in een eigen sectie onder de
  // project taken in de "Te plannen" sidebar.
  const slimmeActiesAgenda = useMemo(() => {
    return nietIngeplandeTaken
      .filter((t) =>
        !t.projectNaam &&
        t.uitvoerder === "claude" &&
        (t.fase === "Slimme taken" || t.fase === "Slimme taken (recurring)")
      )
      .filter((t) => {
        if (plannenFilter === "hoog") return t.prioriteit === "hoog";
        if (plannenFilter === "bezig") return t.status === "bezig";
        return true;
      })
      .sort((a, b) => {
        const prioOrder: Record<string, number> = { hoog: 0, normaal: 1, laag: 2 };
        const pa = prioOrder[a.prioriteit] ?? 1;
        const pb = prioOrder[b.prioriteit] ?? 1;
        if (pa !== pb) return pa - pb;
        return 0;
      });
  }, [nietIngeplandeTaken, plannenFilter]);

  const slimmeActieAgendaIds = useMemo(
    () => new Set(slimmeActiesAgenda.map((t) => t.id)),
    [slimmeActiesAgenda]
  );

  const takenPerProject = useMemo(() => {
    const filtered = nietIngeplandeTaken
      .filter((t) => !slimmeActieAgendaIds.has(t.id)) // Slimme acties uitfilteren
      .filter((t) => {
        if (plannenFilter === "hoog") return t.prioriteit === "hoog";
        if (plannenFilter === "bezig") return t.status === "bezig";
        return true;
      })
      .sort((a, b) => {
        const prioOrder: Record<string, number> = { hoog: 0, normaal: 1, laag: 2 };
        const pa = prioOrder[a.prioriteit] ?? 1;
        const pb = prioOrder[b.prioriteit] ?? 1;
        if (pa !== pb) return pa - pb;
        if (a.status === "bezig" && b.status !== "bezig") return -1;
        if (b.status === "bezig" && a.status !== "bezig") return 1;
        return 0;
      });

    const groups: Record<string, {
      projectNaam: string;
      taken: AgendaTaak[];
      fases: { faseNaam: string; taken: AgendaTaak[] }[];
    }> = {};
    for (const taak of filtered) {
      const projectKey = taak.projectNaam || "Zonder project";
      if (!groups[projectKey]) groups[projectKey] = { projectNaam: projectKey, taken: [], fases: [] };
      groups[projectKey].taken.push(taak);
    }
    // Per project: split naar fases
    for (const groep of Object.values(groups)) {
      const faseMap: Record<string, AgendaTaak[]> = {};
      for (const t of groep.taken) {
        const faseKey = t.fase || "Geen fase";
        if (!faseMap[faseKey]) faseMap[faseKey] = [];
        faseMap[faseKey].push(t);
      }
      groep.fases = Object.entries(faseMap)
        .map(([faseNaam, taken]) => ({ faseNaam, taken }))
        .sort((a, b) => a.faseNaam.localeCompare(b.faseNaam, "nl", { numeric: true }));
    }
    return Object.values(groups).sort((a, b) => b.taken.length - a.taken.length);
  }, [nietIngeplandeTaken, plannenFilter, slimmeActieAgendaIds]);

  // Ingeplande taken per dag
  const ingeplandPerDag = useMemo(() => {
    const map: Record<string, AgendaTaak[]> = {};
    for (const taak of ingeplandeTaken) {
      if (!taak.ingeplandStart) continue;
      const dag = taak.ingeplandStart.slice(0, 10);
      if (!map[dag]) map[dag] = [];
      map[dag].push(taak);
    }
    return map;
  }, [ingeplandeTaken]);

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
    // Dedup: skip externe events die al als lokaal item of ingeplande taak bestaan
    const stripEmoji = (s: string) => s.replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, "").trim();
    const toLocalKey = (titel: string, datum: string) => {
      // Normaliseer naar lokale datum+uur zodat UTC en lokale tijden matchen
      const d = new Date(datum);
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return `${stripEmoji(titel)}|${local}`;
    };
    const lokaleKeys = new Set(items.map((i) => toLocalKey(i.titel, i.startDatum)));
    const lokaleGoogleIds = new Set(
      items
        .map((i) => (i as AgendaItem & { googleEventId?: string | null }).googleEventId)
        .filter(Boolean)
    );
    // Ingeplande taken ook meenemen voor dedup
    for (const taak of agendaTaken) {
      if (taak.ingeplandStart) {
        lokaleKeys.add(toLocalKey(taak.titel, taak.ingeplandStart));
      }
    }
    // Collect deadline event titles (normalized) to dedup against external events
    const deadlineTitels = new Set(
      deadlineEvents.map((dl) => stripEmoji(dl.titel.replace(/^(Taak|Project|Factuur): /i, "")).toLowerCase())
    );
    for (const event of externeEvents) {
      if (filterType !== "alle" && filterType !== "extern") continue;
      const key = toLocalKey(event.titel, event.startDatum);
      if (lokaleKeys.has(key)) continue;
      const rawId = event.id?.replace(/^google-/, "").split("-")[0];
      if (rawId && lokaleGoogleIds.has(rawId)) continue;
      // Skip externe events die dezelfde titel hebben als een taak/project deadline
      if (deadlineTitels.has(stripEmoji(event.titel).toLowerCase())) continue;
      const dag = event.startDatum.slice(0, 10);
      if (!map[dag]) map[dag] = [];
      map[dag].push(event);
    }
    // Dedup: skip deadline events die al als ingeplande taak op dezelfde dag staan
    const ingeplandeTaakIds = new Set(
      agendaTaken.filter((t) => t.ingeplandStart).map((t) => `taak-${t.id}`)
    );
    for (const dl of deadlineEvents) {
      if (filterType !== "alle" && filterType !== "deadline") continue;
      if (ingeplandeTaakIds.has(dl.id)) continue;
      const dag = dl.datum.slice(0, 10);
      if (!map[dag]) map[dag] = [];
      map[dag].push(dl);
    }
    return map;
  }, [items, externeEvents, deadlineEvents, agendaTaken, filterType]);

  function navigeer(richting: number) {
    setNavRichting(richting > 0 ? 1 : -1);
    setViewKey((k) => k + 1);
    let nm = maand + richting;
    let nj = jaar;
    if (nm < 0) { nm = 11; nj--; }
    if (nm > 11) { nm = 0; nj++; }
    setMaand(nm);
    setJaar(nj);
    setWeekOffset(0);
  }

  function openNieuwModal(datum?: string, tijd?: string) {
    setSelectedItem(null);
    setTitel("");
    setOmschrijving("");
    setType("afspraak");
    const targetDatum = datum || datumStr(jaar, maand, vandaag.getDate());
    setStartDatum(targetDatum);

    // Bepaal de start-tijd: gebruik de geklikte tijd indien gegeven,
    // anders default 09:00. Daarna controleren of dat slot al bezet is —
    // zo ja, schuif het start-uur door totdat we een vrij uur vinden
    // (max +12 stappen). Voorkomt dat een nieuwe afspraak een bestaande
    // overschrijft.
    const items = itemsPerDag[targetDatum] ?? [];
    const ingeplandOpDatum = ingeplandeTaken?.filter((t) =>
      t.ingeplandStart && t.ingeplandStart.slice(0, 10) === targetDatum
    ) ?? [];
    const bezetteUren = new Set<number>();
    for (const it of items) {
      if (!("startDatum" in it)) continue;
      if ("heleDag" in it && (it as { heleDag?: number | boolean }).heleDag) continue;
      const start = it.startDatum;
      if (!start || start.length <= 10) continue;
      const eind = "eindDatum" in it ? (it as { eindDatum?: string | null }).eindDatum : null;
      const sUur = parseInt(start.slice(11, 13), 10);
      const eUur = eind && eind.length > 10 ? parseInt(eind.slice(11, 13), 10) : sUur + 1;
      for (let h = sUur; h < eUur; h++) bezetteUren.add(h);
    }
    for (const t of ingeplandOpDatum) {
      if (!t.ingeplandStart) continue;
      const sUur = parseInt(t.ingeplandStart.slice(11, 13), 10);
      const duur = t.geschatteDuur || 60;
      const eUur = sUur + Math.ceil(duur / 60);
      for (let h = sUur; h < eUur; h++) bezetteUren.add(h);
    }

    let startUur = tijd ? parseInt(tijd.slice(0, 2), 10) : 9;
    for (let probe = 0; probe < 12 && bezetteUren.has(startUur); probe++) {
      startUur++;
      if (startUur >= 23) break;
    }
    const eindUur = Math.min(23, startUur + 1);
    const fmt = (n: number) => `${String(n).padStart(2, "0")}:00`;
    setStartTijd(fmt(startUur));
    setEindTijd(fmt(eindUur));
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
    // Shake animatie voordat we verwijderen
    setDeleteShake(true);
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = setTimeout(() => {
      setDeleteShake(false);
      deleteMutation.mutate(selectedItem.id);
    }, 400);
  }

  const [weergave, setWeergave] = useState<"dag" | "week" | "maand" | "jaar">("dag");
  const [selectedDag, setSelectedDag] = useState<Date>(new Date());
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Slide transitie richting + key
  const [navRichting, setNavRichting] = useState<1 | -1>(1);
  const [viewKey, setViewKey] = useState(0);

  // Delete shake animatie
  const [deleteShake, setDeleteShake] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vandaagStr = datumStr(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());

  // Vandaag-strip data
  const vandaagItems = useMemo(() => {
    return itemsPerDag[vandaagStr] || [];
  }, [itemsPerDag, vandaagStr]);

  const volgendEvent = useMemo(() => {
    const toekomstig = vandaagItems
      .filter((item) => {
        const startStr = "startDatum" in item ? item.startDatum : ("datum" in item ? item.datum : null);
        if (!startStr || startStr.length <= 10) return false;
        const start = new Date(startStr);
        return start > nuTijd;
      })
      .sort((a, b) => {
        const aStr = "startDatum" in a ? a.startDatum : ("datum" in a ? a.datum : "");
        const bStr = "startDatum" in b ? b.startDatum : ("datum" in b ? b.datum : "");
        return aStr.localeCompare(bStr);
      });
    return toekomstig[0] || null;
  }, [vandaagItems, nuTijd]);

  const countdownTekst = useMemo(() => {
    if (!volgendEvent) return null;
    const startStr = "startDatum" in volgendEvent ? volgendEvent.startDatum : ("datum" in volgendEvent ? volgendEvent.datum : "");
    const start = new Date(startStr);
    const diffMin = Math.round((start.getTime() - nuTijd.getTime()) / 60000);
    if (diffMin < 1) return "nu";
    if (diffMin < 60) return `over ${diffMin} min`;
    const uren = Math.floor(diffMin / 60);
    const min = diffMin % 60;
    return min > 0 ? `over ${uren}u ${min}min` : `over ${uren}u`;
  }, [volgendEvent, nuTijd]);

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

  // Merge internal + external upcoming events (dedup externe die al lokaal bestaan)
  const toLocalKeyUp = (titel: string, datum: string) => {
    const d = new Date(datum);
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const strip = (s: string) => s.replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, "").trim();
    return `${strip(titel)}|${local}`;
  };
  const lokaleKeysUpcoming = new Set([
    ...items.map((i) => toLocalKeyUp(i.titel, i.startDatum)),
    ...agendaTaken.filter((t) => t.ingeplandStart).map((t) => toLocalKeyUp(t.titel, t.ingeplandStart!)),
  ]);
  const aankomend = [
    ...items.filter((i) => i.startDatum.slice(0, 10) >= vandaagStr).map((i) => ({ ...i, isExtern: false as const })),
    ...externeEvents.filter((e) => e.startDatum.slice(0, 10) >= vandaagStr && !lokaleKeysUpcoming.has(toLocalKeyUp(e.titel, e.startDatum))).map((e) => ({ ...e, isExtern: true as const })),
  ]
    .sort((a, b) => a.startDatum.localeCompare(b.startDatum))
    .slice(0, 10);

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "40%" : "-40%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 320, damping: 32, restDelta: 0.001 },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? "-40%" : "40%",
      opacity: 0,
      transition: { duration: 0.18, ease: "easeIn" as const },
    }),
  };

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
      <PageHeader
        title="Agenda"
        compact
        actions={
          <>
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
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs sm:text-sm transition-colors hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
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
              onClick={async () => {
                if (uitplannenAlle.isPending) return;
                if (!confirm("Weet je zeker dat je alle ingeplande taken wil uitplannen? Afgeronde taken blijven met rust.")) return;
                try {
                  const res = await uitplannenAlle.mutateAsync();
                  addToast(`${res.uitgepland} taken uitgepland`, "succes");
                } catch (e) {
                  addToast(e instanceof Error ? e.message : "Uitplannen mislukt", "fout");
                }
              }}
              disabled={uitplannenAlle.isPending}
              title="Uitplannen alle taken"
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-autronis-bg border border-autronis-border hover:border-red-500/40 hover:text-red-400 text-autronis-text-secondary rounded-xl text-xs sm:text-sm transition-colors disabled:opacity-50"
            >
              {uitplannenAlle.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span className="hidden sm:inline">Leeg agenda</span>
            </button>
            <button
              onClick={() => openNieuwModal()}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Nieuw item</span>
              <span className="xs:hidden">Nieuw</span>
            </button>
          </>
        }
      />
      <p className="text-sm text-autronis-text-secondary -mt-2">
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
                const nuMin = nuTijd.getHours() * 60 + nuTijd.getMinutes();
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
          const isActief = filterType === f.value;
          return (
            <motion.button
              key={f.value}
              onClick={() => setFilterType(f.value)}
              whileTap={{ scale: 0.88 }}
              animate={isActief ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5",
                isActief
                  ? "border-autronis-accent bg-autronis-accent/10 text-autronis-accent"
                  : "border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/40"
              )}
              style={isActief && f.color ? {
                boxShadow: `0 0 10px ${f.color}30`,
              } : undefined}
            >
              {f.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />}
              {f.label}
              {count > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full tabular-nums",
                  isActief ? "bg-autronis-accent/20" : "bg-autronis-bg/50"
                )}>
                  {count}
                </span>
              )}
            </motion.button>
          );
        })}

        <div className="w-px h-5 bg-autronis-border mx-1 hidden sm:block" />

        {/* Taken toggle */}
        <motion.button
          onClick={() => setToonTaken((v) => !v)}
          whileTap={{ scale: 0.88 }}
          animate={toonTaken ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.25 }}
          className={cn(
            "px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5",
            toonTaken
              ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
              : "border-autronis-border text-autronis-text-secondary hover:border-orange-500/40"
          )}
          style={toonTaken ? { boxShadow: "0 0 10px rgba(249,115,22,0.25)" } : undefined}
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
        </motion.button>

        <div className="w-px h-5 bg-autronis-border mx-1 hidden sm:block" />

        {/* AI dag vullen */}
        <motion.button
          onClick={async () => {
            const ds = `${selectedDag.getFullYear()}-${String(selectedDag.getMonth() + 1).padStart(2, "0")}-${String(selectedDag.getDate()).padStart(2, "0")}`;
            setAiPlanLoading(true);
            try {
              const res = await fetch("/api/agenda/ai-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ datum: ds }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.fout || "Kon dag niet plannen");
              const blokText = data.clusterBlokken > 0 ? ` in ${data.clusterBlokken} cluster sessie(s)` : "";
              addToast(`${data.totaal} taken ingepland${blokText}`, "succes");
              if (data.ongegroepeerdGeskipt > 0) {
                addToast(
                  `${data.ongegroepeerdGeskipt} Claude taken zonder cluster geskipt — draai Auto-cluster op /taken`,
                  "fout"
                );
              }
              if (data.overlapGeskipt > 0) {
                addToast(
                  `${data.overlapGeskipt} taken niet gepland — geen vrij slot (botst met bestaande agenda items)`,
                  "fout"
                );
              }
              queryClient.invalidateQueries({ queryKey: ["agenda-taken"] });
            } catch (err) {
              addToast(err instanceof Error ? err.message : "AI planning mislukt", "fout");
            } finally {
              setAiPlanLoading(false);
            }
          }}
          disabled={aiPlanLoading}
          whileTap={{ scale: 0.88 }}
          className="px-2.5 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
          style={{ boxShadow: "0 0 10px rgba(168,85,247,0.15)" }}
        >
          {aiPlanLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          AI Plan
        </motion.button>

        {/* Slimme taak knop — opent modal, plant direct op geselecteerde dag */}
        <motion.button
          onClick={() => setSlimmeTakenOpen(true)}
          whileTap={{ scale: 0.88 }}
          title="Voeg een slimme Claude-uitvoerbare taak toe aan deze dag"
          className="px-2.5 py-1.5 rounded-lg border border-autronis-accent/30 bg-autronis-accent/10 text-autronis-accent hover:bg-autronis-accent/20 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <Sparkles className="w-3 h-3" />
          Slimme taak
        </motion.button>
      </div>
     </div>

      <div className="max-w-[1600px] mx-auto grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-[1fr_460px]">
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
                    setNavRichting(1);
                    setViewKey((k) => k + 1);
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

          <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={navRichting} initial={false}>
          <motion.div
            key={`${weergave}-${viewKey}`}
            custom={navRichting}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
          {weergave === "dag" ? (
            <DagView
              datum={selectedDag}
              onNavigeer={(r) => {
                setNavRichting(r);
                setViewKey((k) => k + 1);
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
              onSlotClick={(d, t) => openNieuwModal(d, t)}
              ingeplandeTaken={ingeplandeTaken}
              onTaakDetail={(id) => setTaakDetailId(id)}
              onPlanTaak={(taak, datum, tijd) => {
                if (datum && tijd) {
                  // Direct inplannen bij drag & drop (geen modal)
                  const duur = taak.geschatteDuur || 30;
                  const startStr = `${datum}T${tijd}:00`;
                  const eindDate = new Date(new Date(startStr).getTime() + duur * 60000);
                  handlePlanTaak(taak.id, startStr, eindDate.toISOString(), duur);
                } else {
                  openPlanModal(taak, datum, tijd);
                }
              }}
              onUnplanTaak={handleUnplanTaak}
              onTaakToggle={(id, status) => handleTaakToggle(id, status)}
              onDeadlineNaarSlot={(dl, datum, tijd) => {
                if (dl.type === "taak") {
                  const taakId = Number(dl.id.replace("taak-", ""));
                  const taak = agendaTaken.find((t) => t.id === taakId);
                  if (taak) openPlanModal(taak, datum, tijd);
                }
              }}
              onHeleDagNaarSlot={(item, datum, tijd) => {
                const startFull = `${datum}T${tijd}:00`;
                const [uur] = tijd.split(":").map(Number);
                const eindFull = `${datum}T${String(uur + 1).padStart(2, "0")}:00:00`;
                saveMutation.mutate({
                  item,
                  body: {
                    titel: item.titel,
                    omschrijving: item.omschrijving || null,
                    type: item.type,
                    startDatum: startFull,
                    eindDatum: eindFull,
                    heleDag: false,
                  },
                });
              }}
            />
          ) : weergave === "jaar" ? (
            <JaarView
              jaar={jaar}
              onNavigeer={(r) => { setNavRichting(r); setViewKey((k) => k + 1); setJaar((j) => j + r); }}
              items={[...items, ...externeEvents.filter((e) => !lokaleKeysUpcoming.has(toLocalKeyUp(e.titel, e.startDatum)))].sort((a, b) => a.startDatum.localeCompare(b.startDatum))}
              onMaandClick={(m) => { setNavRichting(1); setViewKey((k) => k + 1); setMaand(m); setWeergave("maand"); }}
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
                <button onClick={() => { setNavRichting(-1); setViewKey((k) => k + 1); setWeekOffset((o) => o - 1); }} className="p-1.5 sm:p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <span className="text-xs sm:text-sm font-medium text-autronis-text-secondary">
                  {weekDagen[0].datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} – {weekDagen[6].datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <button onClick={() => { setNavRichting(1); setViewKey((k) => k + 1); setWeekOffset((o) => o + 1); }} className="p-1.5 sm:p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
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
                      {toonTaken && (() => {
                        const deadlineTaken = takenPerDag[wd.datumStr]?.length ?? 0;
                        const ingepland = ingeplandPerDag[wd.datumStr]?.length ?? 0;
                        const totaal = deadlineTaken + ingepland;
                        if (totaal === 0) return null;
                        return (
                          <div className="flex items-center justify-center gap-0.5 mt-1">
                            <CheckSquare className={cn("w-2.5 h-2.5", ingepland > 0 ? "text-emerald-400" : "text-orange-400")} />
                            <span className={cn("text-[9px] font-medium tabular-nums", ingepland > 0 ? "text-emerald-400" : "text-orange-400")}>{totaal}</span>
                          </div>
                        );
                      })()}
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
                          onDragOver={(e) => {
                            if (dragTaak || dragAgendaItem) {
                              e.preventDefault();
                              e.currentTarget.classList.add("bg-emerald-500/10");
                            }
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove("bg-emerald-500/10");
                          }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove("bg-emerald-500/10");
                            if (dragTaak) {
                              openPlanModal(dragTaak, wd.datumStr, `${String(uur).padStart(2, "0")}:00`);
                              setDragTaak(null);
                            }
                            if (dragAgendaItem) {
                              const item = dragAgendaItem;
                              setDragAgendaItem(null);
                              const oldStart = new Date(item.startDatum);
                              const oldEnd = item.eindDatum ? new Date(item.eindDatum) : new Date(oldStart.getTime() + 3600000);
                              const duurMs = oldEnd.getTime() - oldStart.getTime();
                              const newStart = `${wd.datumStr}T${String(uur).padStart(2, "0")}:00:00`;
                              const newEnd = new Date(new Date(newStart).getTime() + duurMs).toISOString().replace("Z", "").slice(0, 19);
                              try {
                                const res = await fetch(`/api/agenda/${item.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ startDatum: newStart, eindDatum: newEnd }),
                                });
                                if (res.ok) {
                                  addToast("Agenda item verplaatst", "succes");
                                  // Optimistic update: update the item in the query cache immediately
                                  queryClient.setQueryData<AgendaItem[]>(["agenda", jaar, maand], (old) => {
                                    if (!old) return old;
                                    return old.map((a) =>
                                      a.id === item.id ? { ...a, startDatum: newStart, eindDatum: newEnd } : a
                                    );
                                  });
                                  // Refetch in background to ensure consistency
                                  queryClient.invalidateQueries({ queryKey: ["agenda", jaar, maand] });
                                } else {
                                  const err = await res.json();
                                  addToast(err.fout || "Kon niet verplaatsen", "fout");
                                }
                              } catch {
                                addToast("Kon niet verplaatsen", "fout");
                              }
                            }
                          }}
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
                      bgColor = `${tc.borderColor}18`; borderColor = tc.borderColor; textColor = tc.borderColor;
                    }

                    const startTimeStr = `${String(startUur).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
                    const titel = isExtern ? (item as ExternEvent).titel : (item as AgendaItem).titel;
                    const eventGradient = `linear-gradient(160deg, ${bgColor} 0%, rgba(14,23,25,0.05) 100%)`;
                    const eventGlow = `0 2px 8px ${borderColor}18, inset 0 1px 0 ${borderColor}12`;

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

                    const TypeIcon = isExtern ? null : (typeConfig[(item as AgendaItem).type] || typeConfig.afspraak).icon;

                    return (
                      <div
                        key={`week-${item.id}-${wd.datumStr}`}
                        draggable={!isExtern}
                        onDragStart={(e) => {
                          if (!isExtern) {
                            setDragAgendaItem(item as AgendaItem);
                            e.dataTransfer.setData("text/plain", String(item.id));
                            e.dataTransfer.effectAllowed = "move";
                          }
                        }}
                        onDragEnd={() => setDragAgendaItem(null)}
                        className={cn("absolute rounded-xl px-2 py-1 overflow-hidden hover:brightness-110 transition-all border-l-[3px] z-10 group", isExtern ? "cursor-pointer" : "cursor-grab active:cursor-grabbing")}
                        style={{
                          top: `${topOffset}px`,
                          height: `${height}px`,
                          background: eventGradient,
                          borderLeftColor: borderColor,
                          color: textColor,
                          boxShadow: `${eventGlow}, 0 0 0 1px ${borderColor}14`,
                          left: `calc(48px + (${dagIdx} + ${leftPct / 100}) * (100% - 48px) / 7 + 2px)`,
                          width: `calc(${widthPct / 100} * (100% - 48px) / 7 - 4px)`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isExtern) openItemDetail(item as AgendaItem);
                        }}
                      >
                        <div className="flex items-start gap-1">
                          {TypeIcon && height > 22 && <TypeIcon className="w-2.5 h-2.5 flex-shrink-0 mt-0.5 opacity-80" />}
                          <p className="text-[11px] font-semibold overflow-hidden whitespace-nowrap leading-tight flex-1">{titel}</p>
                        </div>
                        {height > 30 && (
                          <p className="text-[10px] opacity-75 tabular-nums font-medium">
                            {startTimeStr}{eindTimeStr ? ` – ${eindTimeStr}` : ""}
                          </p>
                        )}
                        {height > 52 && isExtern && (item as ExternEvent).deelnemers?.length > 0 && (
                          <p className="text-[9px] opacity-55 mt-0.5 flex items-center gap-0.5 truncate">
                            <Users className="w-2 h-2 flex-shrink-0" />
                            {(item as ExternEvent).deelnemers.slice(0, 2).map(d => d.naam || d.email.split("@")[0]).join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  });
                })}

                {/* Ingeplande taken als groene blokken in week view */}
                {toonTaken && weekDagen.map((wd, dagIdx) => {
                  const dagTaken = ingeplandPerDag[wd.datumStr] || [];
                  if (dagTaken.length === 0) return null;

                  return dagTaken.map((taak) => {
                    if (!taak.ingeplandStart) return null;
                    const startDate = new Date(taak.ingeplandStart);
                    const startUur = startDate.getHours();
                    const startMin = startDate.getMinutes();

                    const wStart = weekUren[0] ?? 7;
                    const wEind = (weekUren[weekUren.length - 1] ?? 20) + 1;
                    if (startUur < wStart || startUur >= wEind) return null;

                    const duurMin = taak.geschatteDuur || 60;
                    const slotH = 64;
                    const topOffset = (startUur - wStart) * slotH + (startMin / 60) * slotH;
                    const height = Math.max(24, (duurMin / 60) * slotH);

                    const kKleur = taak.kalenderKleur;
                    const pk = kKleur
                      ? { bg: `${kKleur}24`, border: kKleur, text: `${kKleur}CC` }
                      : getProjectKleur(taak.projectNaam);

                    return (
                      <div
                        key={`taak-plan-${taak.id}-${wd.datumStr}`}
                        draggable
                        onDragStart={(e) => {
                          setDragTaak(taak);
                          e.dataTransfer.setData("text/plain", String(taak.id));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDragTaak(null)}
                        className="absolute rounded-xl px-2 py-1 overflow-hidden border-l-[3px] z-[8] cursor-grab active:cursor-grabbing hover:brightness-110 transition-all group"
                        style={{
                          top: `${topOffset}px`,
                          height: `${height}px`,
                          background: `linear-gradient(160deg, ${pk.bg} 0%, rgba(14,23,25,0.05) 100%)`,
                          borderLeftColor: pk.border,
                          color: kKleur || pk.text,
                          boxShadow: `0 2px 8px ${pk.border}20, 0 0 0 1px ${pk.border}14`,
                          left: `calc(48px + ${dagIdx} * (100% - 48px) / 7 + 2px)`,
                          width: `calc((100% - 48px) / 7 - 4px)`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPlanModal(taak, wd.datumStr, `${String(startUur).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`);
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <CheckSquare className="w-2.5 h-2.5 flex-shrink-0 opacity-80" />
                          <p className="text-[11px] font-semibold overflow-hidden whitespace-nowrap leading-tight flex-1">{taak.titel}</p>
                        </div>
                        {height > 30 && (
                          <p className="text-[10px] opacity-75 tabular-nums font-medium">
                            {`${String(startUur).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`}
                            {taak.ingeplandEind && ` – ${new Date(taak.ingeplandEind).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`}
                          </p>
                        )}
                        {height > 48 && taak.projectNaam && (
                          <p className="text-[9px] opacity-55 mt-0.5 truncate">{taak.projectNaam}</p>
                        )}
                        <div className="absolute top-1 right-1 flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-0.5 rounded bg-emerald-500/30 text-white/80 hover:bg-emerald-500/50 transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleTaakToggle(taak.id); }}
                            title="Afvinken"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            className="p-0.5 rounded bg-black/20 text-white/60 hover:bg-black/30 transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleUnplanTaak(taak.id); }}
                            title="Uit agenda halen"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })}

                {/* Niet-ingeplande taken met deadline als dashed suggestie blokken */}
                {toonTaken && weekDagen.map((wd, dagIdx) => {
                  const dagTaken = (takenPerDag[wd.datumStr] || []).filter((t) => !t.ingeplandStart);
                  if (dagTaken.length === 0) return null;

                  return dagTaken.slice(0, 3).map((taak, taakIdx) => {
                    const wStart = weekUren[0] ?? 7;
                    const suggestedUur = 9 + taakIdx;
                    if (suggestedUur < wStart || suggestedUur >= (weekUren[weekUren.length - 1] ?? 20)) return null;

                    // Skip als er al een ingepland blok is op deze positie
                    const ingeplandOpDitSlot = (ingeplandPerDag[wd.datumStr] || []).some((t) => {
                      if (!t.ingeplandStart) return false;
                      const s = new Date(t.ingeplandStart);
                      return s.getHours() === suggestedUur;
                    });
                    if (ingeplandOpDitSlot) return null;

                    const slotH = 64;
                    const topOffset = (suggestedUur - wStart) * slotH + 4;
                    const height = slotH * 0.85;
                    const spk = getProjectKleur(taak.projectNaam);
                    const prioColor = taak.prioriteit === "hoog" ? "#ef4444" : taak.prioriteit === "normaal" ? "#f97316" : spk.border;

                    return (
                      <div
                        key={`taak-sug-${taak.id}-${wd.datumStr}`}
                        className="absolute rounded-xl px-2 py-1 overflow-hidden z-[4] opacity-30 hover:opacity-85 transition-all cursor-pointer border-l-[3px]"
                        style={{
                          top: `${topOffset}px`,
                          height: `${height}px`,
                          backgroundColor: `${spk.bg}`,
                          border: `1px dashed ${spk.border}50`,
                          borderLeftColor: prioColor,
                          color: spk.text,
                          left: `calc(48px + ${dagIdx} * (100% - 48px) / 7 + 2px)`,
                          width: `calc((100% - 48px) / 7 - 4px)`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPlanModal(taak, wd.datumStr, `${String(suggestedUur).padStart(2, "0")}:00`);
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <CheckSquare className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
                          <p className="text-[11px] font-medium truncate leading-tight">{taak.titel}</p>
                        </div>
                        {height > 28 && (
                          <p className="text-[9px] opacity-50 mt-0.5">Klik om in te plannen</p>
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
                  const nuUur = nuTijd.getHours();
                  const nuMin = nuTijd.getMinutes();
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
          </motion.div>
          </AnimatePresence>
          </div>
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
              {/* ── Sidebar tabs ── */}
              <div className="flex gap-1 mb-4 bg-autronis-bg/40 rounded-xl p-1 border border-autronis-border/40">
                {([
                  { key: "plannen", label: "Te plannen", count: nietIngeplandeTaken.length },
                  { key: "vandaag", label: "Vandaag", count: ingeplandeTaken.filter((t) => t.ingeplandStart?.slice(0, 10) === vandaagStr).length },
                  { key: "aankomend", label: "Aankomend", count: aankomend.length },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSidebarTab(tab.key)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                      sidebarTab === tab.key
                        ? "bg-autronis-card text-autronis-text-primary shadow-sm"
                        : "text-autronis-text-secondary hover:text-autronis-text-primary"
                    )}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={cn(
                        "text-[10px] tabular-nums px-1.5 py-0.5 rounded-full",
                        sidebarTab === tab.key
                          ? "bg-autronis-accent/20 text-autronis-accent"
                          : "bg-autronis-border/50 text-autronis-text-secondary"
                      )}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">

              {/* ── Tab: Te plannen ── */}
              {sidebarTab === "plannen" && (
                <motion.div key="plannen" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                  {/* Priority filter */}
                  <div className="flex gap-1 mb-3">
                    {([
                      { key: "alle", label: "Alle" },
                      { key: "hoog", label: "Hoog" },
                      { key: "bezig", label: "Bezig" },
                    ] as const).map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setPlannenFilter(f.key)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors border",
                          plannenFilter === f.key
                            ? f.key === "hoog"
                              ? "bg-red-500/15 border-red-500/30 text-red-400"
                              : f.key === "bezig"
                                ? "bg-autronis-accent/15 border-autronis-accent/30 text-autronis-accent"
                                : "bg-autronis-card border-autronis-border text-autronis-text-primary"
                            : "bg-transparent border-autronis-border/40 text-autronis-text-secondary hover:border-autronis-border"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                    <button
                      onClick={() => { setSelectMode(!selectMode); setSelectedTaakIds(new Set()); }}
                      className={cn(
                        "ml-auto text-[10px] self-center transition-colors",
                        selectMode
                          ? "text-autronis-accent font-medium"
                          : "text-autronis-text-secondary/50 hover:text-autronis-text-secondary"
                      )}
                    >
                      {selectMode ? "Klaar" : "Selecteer"}
                    </button>
                  </div>

                  {/* Bulk acties balk */}
                  {selectMode && selectedTaakIds.size > 0 && (
                    <div className="flex items-center gap-1.5 mb-3 p-2 rounded-xl bg-autronis-accent/5 border border-autronis-accent/20">
                      <span className="text-[10px] text-autronis-accent font-semibold tabular-nums mr-auto">
                        {selectedTaakIds.size} geselecteerd
                      </span>
                      <button
                        onClick={() => bulkAction("afronden")}
                        className="px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/15 rounded-lg transition-colors"
                      >
                        Afronden
                      </button>
                      <button
                        onClick={() => bulkAction("ontplannen")}
                        className="px-2 py-1 text-[10px] font-medium text-amber-400 hover:bg-amber-500/15 rounded-lg transition-colors"
                      >
                        Uit planning
                      </button>
                      <button
                        onClick={() => bulkAction("verwijderen")}
                        className="px-2 py-1 text-[10px] font-medium text-red-400 hover:bg-red-500/15 rounded-lg transition-colors"
                      >
                        Verwijder
                      </button>
                    </div>
                  )}

                  {takenPerProject.length === 0 && slimmeActiesAgenda.length === 0 ? (
                    <div className="py-3 space-y-3">
                      <p className="text-xs text-autronis-text-secondary text-center">
                        {plannenFilter !== "alle" ? "Geen taken voor dit filter" : "Alle taken zijn ingepland!"}
                      </p>
                      {plannenFilter === "alle" && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 px-2 mb-1.5">
                            <span className="text-[10px] font-semibold text-autronis-text-secondary/60 uppercase tracking-wider">Wat je nu kunt doen</span>
                          </div>
                          {[
                            { tekst: "Lead opvolgen — bel of mail een prospect", kleur: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", Icon: Phone },
                            { tekst: "LinkedIn post schrijven over recent werk", kleur: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", Icon: PenLine },
                            { tekst: "Offerte opstellen voor openstaande lead", kleur: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", Icon: FileText },
                            { tekst: "Portfolio/case study bijwerken", kleur: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", Icon: Palette },
                            { tekst: "Netwerken — connecties leggen op LinkedIn", kleur: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", Icon: Handshake },
                            { tekst: "Content plannen — blog, video, social media", kleur: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", Icon: Megaphone },
                          ].map((s) => (
                            <button
                              key={s.tekst}
                              onClick={() => {
                                setSelectedItem(null);
                                setTitel(s.tekst);
                                setOmschrijving("");
                                setType("afspraak");
                                setStartDatum(selectedDay || datumStr(jaar, maand, vandaag.getDate()));
                                setStartTijd("09:00");
                                setEindTijd("09:30");
                                setHeleDag(false);
                                setModalOpen(true);
                              }}
                              className="flex items-center gap-2.5 px-2 py-2 rounded-lg border border-transparent hover:border-autronis-border/40 hover:bg-autronis-bg/40 transition-all w-full text-left group"
                            >
                              <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0", s.bg, "border", s.border)}>
                                <s.Icon className={cn("w-3 h-3", s.kleur)} />
                              </div>
                              <span className="text-[11px] text-autronis-text-secondary group-hover:text-autronis-text-primary transition-colors leading-tight">{s.tekst}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Slimme acties ook tonen als alles ingepland is */}
                      {slimmeTemplates.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-autronis-accent/20">
                          <div className="flex items-center gap-2 px-1 mb-2">
                            <Sparkles className="w-3 h-3 text-autronis-accent flex-shrink-0" />
                            <span className="text-[11px] font-semibold text-autronis-accent uppercase tracking-wider flex-1">
                              Slimme acties
                            </span>
                            <span className="text-[10px] tabular-nums text-autronis-text-secondary/50 flex-shrink-0">
                              {slimmeTemplates.length}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 px-1">
                            {slimmeTemplates.map((tpl) => {
                              const k = getClusterKleur(tpl.cluster);
                              return (
                              <button
                                key={tpl.id}
                                onClick={() => { setSlimmeTakenPreSelect(tpl.slug); setSlimmeTakenOpen(true); }}
                                className="text-left flex flex-col gap-1 px-2 py-1.5 rounded-lg border transition-colors hover:brightness-125"
                                style={{ backgroundColor: k.bg, borderColor: k.border }}
                                title={tpl.beschrijving || tpl.naam}
                              >
                                <div className="text-[11px] font-medium text-autronis-text-primary truncate" style={{ color: k.text }}>
                                  {tpl.naam}
                                </div>
                                {tpl.beschrijving && (
                                  <div className="text-[9px] text-autronis-text-secondary/70 line-clamp-2 leading-snug">
                                    {tpl.beschrijving}
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-1 mt-0.5">
                                  <span className={cn("text-[8px] px-1 py-0.5 rounded-full font-medium", k.badge)}>
                                    {tpl.cluster}
                                  </span>
                                  {tpl.geschatteDuur && (
                                    <span className="text-[8px] text-autronis-text-secondary/60 tabular-nums">
                                      {tpl.geschatteDuur}m
                                    </span>
                                  )}
                                </div>
                              </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto pr-0.5">
                      {takenPerProject.map((groep) => {
                        const isExpanded = expandedProjecten.has(groep.projectNaam) || takenPerProject.length === 1;
                        return (
                          <div key={groep.projectNaam}>
                            {/* Project header */}
                            <button
                              onClick={() => setExpandedProjecten((prev) => {
                                const next = new Set(prev);
                                if (next.has(groep.projectNaam)) next.delete(groep.projectNaam);
                                else next.add(groep.projectNaam);
                                return next;
                              })}
                              className="w-full flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-autronis-bg/30 transition-colors group"
                            >
                              <ChevronRight className={cn("w-3 h-3 text-autronis-text-secondary/60 transition-transform flex-shrink-0", isExpanded && "rotate-90")} />
                              <span className="text-[11px] font-semibold text-autronis-text-secondary truncate flex-1 text-left">{groep.projectNaam}</span>
                              <span className="text-[10px] tabular-nums text-autronis-text-secondary/50 flex-shrink-0">{groep.taken.length}</span>
                            </button>

                            {/* Fases binnen dit project */}
                            <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-2 mt-1.5 pl-1">
                                  {groep.fases.map((fase) => {
                                    const faseKey = `${groep.projectNaam}::${fase.faseNaam}`;
                                    const fpk = getProjectKleur(groep.projectNaam);
                                    const faseExpanded = expandedProjecten.has(faseKey);
                                    const allClaude = fase.taken.every((t) => t.uitvoerder === "claude");
                                    return (
                                      <div key={faseKey} className="rounded-lg border border-autronis-border/30 overflow-hidden" style={{ backgroundColor: fpk.bg, borderLeftWidth: "2px", borderLeftColor: fpk.border }}>
                                        {/* Fase header met plan-knop */}
                                        <div className="flex items-center gap-1.5 px-2 py-1.5">
                                          <button
                                            onClick={() => setExpandedProjecten((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(faseKey)) next.delete(faseKey);
                                              else next.add(faseKey);
                                              return next;
                                            })}
                                            className="flex items-center gap-1 flex-1 min-w-0 text-left"
                                          >
                                            <ChevronRight className={cn("w-3 h-3 flex-shrink-0 transition-transform", faseExpanded && "rotate-90")} style={{ color: fpk.text }} />
                                            <span className="text-[11px] font-bold truncate" style={{ color: fpk.text }}>
                                              {fase.faseNaam}
                                            </span>
                                            <span className="text-[9px] tabular-nums ml-1 flex-shrink-0" style={{ color: fpk.text + "80" }}>
                                              {fase.taken.length}×
                                            </span>
                                            {allClaude && (
                                              <span className="text-[8px] font-semibold uppercase px-1 py-0.5 rounded bg-purple-500/25 text-purple-300 flex-shrink-0">
                                                Claude
                                              </span>
                                            )}
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const vandaag = new Date();
                                              const datum = `${vandaag.getFullYear()}-${String(vandaag.getMonth() + 1).padStart(2, "0")}-${String(vandaag.getDate()).padStart(2, "0")}`;
                                              handlePlanFase(fase.taken, datum, allClaude ? "08:00" : "09:00");
                                            }}
                                            title={`Plan hele fase (${fase.taken.length} taken)`}
                                            className="text-[9px] font-semibold px-2 py-1 rounded flex-shrink-0 transition-colors"
                                            style={{ backgroundColor: fpk.border + "30", color: fpk.text }}
                                          >
                                            Plan fase
                                          </button>
                                        </div>

                                        {/* Taken in fase (collapsible) */}
                                        <AnimatePresence>
                                        {faseExpanded && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="space-y-0.5 px-2 pb-2 pt-0.5">
                                              {fase.taken.map((taak) => {
                                                const taakIsClaude = taak.uitvoerder === "claude";
                                                const isSelected = selectedTaakIds.has(taak.id);
                                                return (
                                                <div
                                                  key={taak.id}
                                                  draggable={!selectMode}
                                                  onDragStart={(e) => {
                                                    if (selectMode) return;
                                                    setDragTaak(taak);
                                                    e.dataTransfer.setData("text/plain", String(taak.id));
                                                    e.dataTransfer.effectAllowed = "move";
                                                  }}
                                                  onDragEnd={() => setDragTaak(null)}
                                                  onClick={() => selectMode ? toggleTaakSelect(taak.id) : openPlanModal(taak)}
                                                  className={cn(
                                                    "flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] group transition-colors",
                                                    selectMode
                                                      ? isSelected ? "bg-autronis-accent/10" : "hover:bg-white/5 cursor-pointer"
                                                      : "hover:bg-white/5 cursor-grab active:cursor-grabbing"
                                                  )}
                                                  style={{ color: fpk.text }}
                                                >
                                                  {selectMode ? (
                                                    <div className={cn(
                                                      "w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                                                      isSelected ? "bg-autronis-accent border-autronis-accent" : "border-autronis-text-secondary/40"
                                                    )}>
                                                      {isSelected && <Check className="w-2.5 h-2.5 text-autronis-bg" />}
                                                    </div>
                                                  ) : (
                                                    <button
                                                      className="w-3 h-3 rounded-full border border-autronis-text-secondary/40 hover:border-emerald-400 flex-shrink-0"
                                                      onClick={(e) => { e.stopPropagation(); handleTaakToggle(taak.id); }}
                                                      title="Afvinken"
                                                    />
                                                  )}
                                                  <span className="truncate flex-1">{taak.titel}</span>
                                                  {taak.prioriteit === "hoog" && (
                                                    <span className="text-[8px] text-red-400 flex-shrink-0">!</span>
                                                  )}
                                                  {!selectMode && (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const v = new Date();
                                                        const datum = `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
                                                        handlePlanFase([taak], datum, taakIsClaude ? "08:00" : "09:00");
                                                      }}
                                                      title="Plan vandaag"
                                                      className="opacity-0 group-hover:opacity-100 text-[10px] font-bold leading-none w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-opacity"
                                                      style={{ backgroundColor: fpk.border + "30", color: fpk.text }}
                                                    >
                                                      +
                                                    </button>
                                                  )}
                                                </div>
                                                );
                                              })}
                                            </div>
                                          </motion.div>
                                        )}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                            </AnimatePresence>
                          </div>
                        );
                      })}

                      {/* ── Slimme acties sectie ── templates direct uit DB */}
                      {/* Toon de slimme taken templates ALS keuzes (niet als bestaande
                          taken). Klik = open modal voorgevuld met die template, vul
                          velden in, taak wordt aangemaakt + gepland op de geselecteerde
                          dag. Geen handmatige stap meer nodig om ze "te zien". */}
                      {slimmeTemplates.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-autronis-accent/20">
                          <div className="flex items-center gap-2 px-1 mb-2">
                            <Sparkles className="w-3 h-3 text-autronis-accent flex-shrink-0" />
                            <span className="text-[11px] font-semibold text-autronis-accent uppercase tracking-wider flex-1">
                              Slimme acties
                            </span>
                            <span className="text-[10px] tabular-nums text-autronis-text-secondary/50 flex-shrink-0">
                              {slimmeTemplates.length}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 px-1">
                            {slimmeTemplates.map((tpl) => {
                              const k = getClusterKleur(tpl.cluster);
                              return (
                              <button
                                key={tpl.id}
                                onClick={() => { setSlimmeTakenPreSelect(tpl.slug); setSlimmeTakenOpen(true); }}
                                className="text-left flex flex-col gap-1 px-2 py-1.5 rounded-lg border transition-colors hover:brightness-125"
                                style={{ backgroundColor: k.bg, borderColor: k.border }}
                                title={tpl.beschrijving || tpl.naam}
                              >
                                <div className="text-[11px] font-medium text-autronis-text-primary truncate" style={{ color: k.text }}>
                                  {tpl.naam}
                                </div>
                                {tpl.beschrijving && (
                                  <div className="text-[9px] text-autronis-text-secondary/70 line-clamp-2 leading-snug">
                                    {tpl.beschrijving}
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-1 mt-0.5">
                                  <span className={cn("text-[8px] px-1 py-0.5 rounded-full font-medium", k.badge)}>
                                    {tpl.cluster}
                                  </span>
                                  {tpl.geschatteDuur && (
                                    <span className="text-[8px] text-autronis-text-secondary/60 tabular-nums">
                                      {tpl.geschatteDuur}m
                                    </span>
                                  )}
                                </div>
                              </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                  )}

                  {/* ── Recent afgerond (laatste 24u) ── */}
                  {recentAfgerond.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-autronis-border/30">
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400/60 flex-shrink-0" />
                        <span className="text-[10px] font-semibold text-autronis-text-secondary/50 uppercase tracking-wider flex-1">
                          Recent afgerond
                        </span>
                        <span className="text-[10px] tabular-nums text-autronis-text-secondary/40 flex-shrink-0">
                          {recentAfgerond.length}
                        </span>
                      </div>
                      <div className="space-y-0.5 px-1">
                        {recentAfgerond.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg group hover:bg-autronis-bg/30 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-400/40 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-autronis-text-secondary/60 line-through decoration-autronis-text-secondary/30">
                                {t.titel}
                              </div>
                              <div className="text-[9px] text-autronis-text-secondary/40">
                                {t.bijgewerktOp
                                  ? new Date(t.bijgewerktOp).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
                                  : ""}
                                {t.projectNaam && ` · ${t.projectNaam}`}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                undoAfgerond.mutate(t.id, {
                                  onSuccess: () => addToast(`"${t.titel}" teruggezet naar open`, "succes"),
                                  onError: () => addToast("Kon niet ongedaan maken", "fout"),
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-400 hover:bg-amber-500/10 rounded transition-all flex-shrink-0"
                              title="Zet terug naar open"
                            >
                              Undo
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Routines (due/overdue) ── */}
                  {dueRoutines.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-autronis-border/30">
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <AlertTriangle className="w-3 h-3 text-amber-400/70 flex-shrink-0" />
                        <span className="text-[10px] font-semibold text-autronis-text-secondary/50 uppercase tracking-wider flex-1">
                          Routines
                        </span>
                        <span className="text-[10px] tabular-nums text-amber-400/60 flex-shrink-0">
                          {overdueRoutines.length > 0 ? `${overdueRoutines.length} overdue` : `${binnenkortRoutines.length} binnenkort`}
                        </span>
                      </div>
                      <div className="space-y-1 px-1">
                        {dueRoutines.map((r) => {
                          const isOverdue = r.status === "overdue";
                          const freqLabel = r.frequentie === "wekelijks" ? "w" : r.frequentie === "maandelijks" ? "m" : "kw";
                          return (
                            <div
                              key={r.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg group hover:bg-autronis-bg/30 transition-colors"
                              title={r.beschrijving ?? r.naam}
                            >
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                isOverdue ? "bg-red-400" : "bg-amber-400"
                              )} />
                              <div className="flex-1 min-w-0">
                                <div className={cn(
                                  "text-[11px] font-medium",
                                  isOverdue ? "text-red-300/80" : "text-amber-300/70"
                                )}>
                                  {r.naam}
                                </div>
                                <div className="text-[9px] text-autronis-text-secondary/40">
                                  {r.dagenGeleden !== null ? `${r.dagenGeleden}d geleden` : "nooit gedaan"} · {freqLabel}
                                </div>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-all">
                                <button
                                  onClick={() => planRoutineAlsTaak(r)}
                                  className="w-5 h-5 rounded flex items-center justify-center text-autronis-accent hover:bg-autronis-accent/15 transition-colors"
                                  title="Inplannen als taak"
                                >
                                  <Calendar className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => markeerRoutineVoltooid(r.id)}
                                  className="w-5 h-5 rounded flex items-center justify-center text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                                  title="Markeer als gedaan"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Tab: Vandaag ── */}
              {sidebarTab === "vandaag" && (
                <motion.div key="vandaag" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                  {ingeplandeTaken.filter((t) => t.ingeplandStart?.slice(0, 10) === vandaagStr).length === 0 ? (
                    <p className="text-xs text-autronis-text-secondary py-4 text-center">Nog niets ingepland vandaag.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {ingeplandeTaken
                        .filter((t) => t.ingeplandStart?.slice(0, 10) === vandaagStr)
                        .sort((a, b) => (a.ingeplandStart || "").localeCompare(b.ingeplandStart || ""))
                        .map((taak) => (
                          <div
                            key={taak.id}
                            className="p-2.5 rounded-lg border border-l-2 group"
                            style={{
                              borderLeftColor: taak.kalenderKleur || "#22c55e",
                              backgroundColor: (taak.kalenderKleur || "#22c55e") + "0D",
                              borderColor: (taak.kalenderKleur || "#22c55e") + "33",
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                className="mt-0.5 w-4.5 h-4.5 rounded-full border-2 border-autronis-text-secondary/30 hover:border-emerald-400/60 flex items-center justify-center flex-shrink-0 transition-all"
                                onClick={(e) => { e.stopPropagation(); handleTaakToggle(taak.id); }}
                                title="Afvinken"
                              >
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-autronis-text-primary truncate">{taak.titel}</p>
                                {taak.projectNaam && (
                                  <p className="text-[9px] text-autronis-text-secondary truncate mt-0.5">{taak.projectNaam}</p>
                                )}
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[9px] tabular-nums font-medium" style={{ color: (taak.kalenderKleur || "#22c55e") + "CC" }}>
                                    {taak.ingeplandStart && new Date(taak.ingeplandStart).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                                    {taak.ingeplandEind && ` – ${new Date(taak.ingeplandEind).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`}
                                  </span>
                                  <button
                                    onClick={() => handleUnplanTaak(taak.id)}
                                    className="text-[9px] text-red-400/60 hover:text-red-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    Uitplannen
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Tab: Aankomend ── */}
              {sidebarTab === "aankomend" && (
                <motion.div key="aankomend" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                  {aankomend.length === 0 ? (
                    <p className="text-xs text-autronis-text-secondary py-4 text-center">Geen aankomende items.</p>
                  ) : (
            <div className="space-y-3">
              {aankomend.map((item) => {
                // Countdown per item (real-time via nuTijd)
                const itemStartStr = item.startDatum;
                let itemCountdown: string | null = null;
                let itemIsImminent = false;
                if (itemStartStr.length > 10) {
                  const start = new Date(itemStartStr);
                  const diffMs = start.getTime() - nuTijd.getTime();
                  if (diffMs > 0) {
                    const diffMin = Math.round(diffMs / 60000);
                    itemIsImminent = diffMin < 5;
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
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                              itemIsImminent
                                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse"
                                : "bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25"
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Video className="w-3.5 h-3.5" />
                            {itemIsImminent ? "Nu deelnemen!" : "Deelnemen"}
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
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                            itemIsImminent
                              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse"
                              : "bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Video className="w-3.5 h-3.5" />
                          {itemIsImminent ? "Nu deelnemen!" : "Deelnemen"}
                        </a>
                      )}
                    </div>
                  </button>
                );
              })}
                    </div>
                  )}
                </motion.div>
              )}

              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
      {modalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={deleteShake
              ? { x: [0, -10, 10, -8, 8, -4, 4, 0], scale: 1, opacity: 1, y: 0 }
              : { scale: 1, opacity: 1, y: 0 }
            }
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={deleteShake
              ? { duration: 0.4, ease: "easeInOut" }
              : { type: "spring", stiffness: 380, damping: 30 }
            }
            className="glass-modal border border-autronis-border rounded-2xl p-6 w-full max-w-lg shadow-2xl"
          >
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
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      {/* Plan Taak Modal */}
      {planModalTaak && (
        <PlanTaakModal
          taak={planModalTaak}
          onClose={() => setPlanModalTaak(null)}
          onPlan={handlePlanTaak}
          onUnplan={handleUnplanTaak}
          isPending={planTaak.isPending}
          prefillDatum={planPrefillDatum}
          prefillTijd={planPrefillTijd}
          kalenders={kalenders.map((k) => ({ id: k.id, naam: k.naam, kleur: k.kleur || "#17B8A5" }))}
          ingeplandeTaken={ingeplandeTaken}
        />
      )}
      {/* Kalender Settings Modal */}
      {kalenderSettingsOpen && (
        <KalenderSettingsModal
          kalenders={kalenders}
          onClose={() => setKalenderSettingsOpen(false)}
        />
      )}

      {/* Taak Detail Panel — slide-in vanaf rechts bij klik op taak blok */}
      <TaakDetailPanel
        taakId={taakDetailId}
        onClose={() => setTaakDetailId(null)}
      />
      <SlimmeTakenModal
        open={slimmeTakenOpen}
        onClose={() => { setSlimmeTakenOpen(false); setSlimmeTakenPreSelect(undefined); }}
        ingeplandVoor={`${selectedDag.getFullYear()}-${String(selectedDag.getMonth() + 1).padStart(2, "0")}-${String(selectedDag.getDate()).padStart(2, "0")}`}
        preSelectedSlug={slimmeTakenPreSelect}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["agenda-taken"] });
          queryClient.invalidateQueries({ queryKey: ["taken"] });
        }}
      />
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
