"use client";

import { useState, useCallback, useEffect } from "react";
import {
  FileText,
  Plus,
  Loader2,
  Shield,
  Handshake,
  Clock,
  ChevronRight,
  Sparkles,
  X,
  Download,
  Check,
  ArrowRight,
  CalendarClock,
  AlertTriangle,
  Building,
  UserCheck,
  Briefcase,
  Users2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Contract {
  id: number;
  klantId: number;
  klantNaam: string | null;
  offerteNummer: string | null;
  titel: string;
  type: string;
  status: string;
  verloopdatum: string | null;
  aangemaaktOp: string;
}

interface Klant {
  id: number;
  bedrijfsnaam: string;
  email?: string;
}

interface Offerte {
  id: number;
  offertenummer: string;
  titel: string | null;
  klantId: number;
}

const TYPE_CONFIG: Record<string, {
  label: string; shortLabel: string; icon: typeof FileText;
  kleur: string; glow: string; beschrijving: string
}> = {
  samenwerkingsovereenkomst: {
    label: "Samenwerkingsovereenkomst",
    shortLabel: "Samenwerking",
    icon: Handshake,
    kleur: "#17B8A5",
    glow: "hover:shadow-[0_0_20px_rgba(23,184,165,0.15)] hover:border-[#17B8A5]/40",
    beschrijving: "Freelance/agency overeenkomst voor projecten en dienstverlening.",
  },
  sla: {
    label: "SLA",
    shortLabel: "SLA",
    icon: Clock,
    kleur: "#3B82F6",
    glow: "hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-blue-500/40",
    beschrijving: "Service Level Agreement voor maandelijks onderhoud en support.",
  },
  nda: {
    label: "NDA",
    shortLabel: "NDA",
    icon: Shield,
    kleur: "#A855F7",
    glow: "hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:border-purple-500/40",
    beschrijving: "Geheimhoudingsovereenkomst voor vertrouwelijke informatie.",
  },
  onderhuurovereenkomst: {
    label: "Onderhuurovereenkomst",
    shortLabel: "Onderhuur",
    icon: Building,
    kleur: "#F59E0B",
    glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/40",
    beschrijving: "Overeenkomst voor het onderverhuren van kantoor- of werkruimte.",
  },
  freelance: {
    label: "Freelance overeenkomst",
    shortLabel: "Freelance",
    icon: UserCheck,
    kleur: "#EC4899",
    glow: "hover:shadow-[0_0_20px_rgba(236,72,153,0.15)] hover:border-pink-500/40",
    beschrijving: "Overeenkomst voor freelance opdrachten en inhuur.",
  },
  projectovereenkomst: {
    label: "Projectovereenkomst",
    shortLabel: "Project",
    icon: Briefcase,
    kleur: "#06B6D4",
    glow: "hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:border-cyan-500/40",
    beschrijving: "Overeenkomst voor een specifiek project met vaste scope en prijs.",
  },
  vof: {
    label: "VOF-overeenkomst",
    shortLabel: "VOF",
    icon: Users2,
    kleur: "#10B981",
    glow: "hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:border-emerald-500/40",
    beschrijving: "Vennootschap onder firma overeenkomst tussen vennoten.",
  },
};

const STATUS_CONFIG: Record<string, { label: string; kleur: string; bg: string; borderLeft: string }> = {
  concept: { label: "Concept", kleur: "text-zinc-400", bg: "bg-zinc-500/20", borderLeft: "border-l-zinc-500/50" },
  verzonden: { label: "Verstuurd", kleur: "text-blue-400", bg: "bg-blue-500/20", borderLeft: "border-l-blue-500/50" },
  ondertekend: { label: "Ondertekend", kleur: "text-green-400", bg: "bg-green-500/20", borderLeft: "border-l-green-500/70" },
  verlopen: { label: "Verlopen", kleur: "text-red-400", bg: "bg-red-500/20", borderLeft: "border-l-red-500/50" },
};

// Stap-loader stappen
const GEN_STAPPEN = [
  "Template laden",
  "AI schrijft contract",
  "Opslaan",
];

// Simpele confetti burst
function ConfettiBurst() {
  const particles = Array.from({ length: 12 }, (_, i) => i);
  const kleuren = ["#17B8A5", "#4DC9B4", "#3B82F6", "#A855F7", "#F59E0B", "#10B981"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 1, x: "50%", y: "50%", scale: 0 }}
          animate={{
            opacity: 0,
            x: `${50 + (Math.random() - 0.5) * 200}%`,
            y: `${50 + (Math.random() - 0.5) * 200}%`,
            scale: Math.random() * 1.5 + 0.5,
            rotate: Math.random() * 360,
          }}
          transition={{ duration: 0.8 + Math.random() * 0.4, ease: "easeOut" }}
          style={{
            position: "absolute",
            width: 6 + Math.random() * 6,
            height: 6 + Math.random() * 6,
            backgroundColor: kleuren[Math.floor(Math.random() * kleuren.length)],
            borderRadius: Math.random() > 0.5 ? "50%" : "0",
          }}
        />
      ))}
    </div>
  );
}

export default function ContractenPage() {
  const { addToast } = useToast();
  const [contracten, setContracten] = useState<Contract[]>([]);
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [offertes, setOffertes] = useState<Offerte[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [genStap, setGenStap] = useState<number | null>(null); // null = niet bezig
  const [confettiId, setConfettiId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("alle");

  // Form state
  const [type, setType] = useState("samenwerkingsovereenkomst");
  const [klantId, setKlantId] = useState("");
  const [titel, setTitel] = useState("");
  const [offerteId, setOfferteId] = useState("");
  const [verloopdatum, setVerloopdatum] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [cRes, kRes, oRes] = await Promise.all([
        fetch("/api/contracten"),
        fetch("/api/klanten"),
        fetch("/api/offertes"),
      ]);
      if (cRes.ok) {
        const d = await cRes.json();
        const lijst: Contract[] = d.contracten ?? [];
        setContracten(lijst);
        // Trigger confetti voor ondertekende contracten (enkel bij eerste load)
        const ondertekend = lijst.find((c) => c.status === "ondertekend");
        if (ondertekend) setConfettiId(ondertekend.id);
      }
      if (kRes.ok) {
        const d = await kRes.json();
        setKlanten(d.klanten ?? []);
      }
      if (oRes.ok) {
        const d = await oRes.json();
        setOffertes(d.offertes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter offertes op geselecteerde klant
  const offertesByKlant = klantId
    ? offertes.filter((o) => String(o.klantId) === klantId)
    : offertes;

  async function handleCreate() {
    if (!klantId || !titel) {
      addToast("Selecteer een klant en voer een titel in", "info");
      return;
    }

    setGenStap(0); // "Template laden"
    try {
      await new Promise((r) => setTimeout(r, 400));
      setGenStap(1); // "AI schrijft contract"

      const genRes = await fetch("/api/contracten/genereer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId: Number(klantId),
          type,
          offerteId: offerteId ? Number(offerteId) : undefined,
        }),
      });

      let inhoud = "";
      if (genRes.ok) {
        const genData = await genRes.json();
        inhoud = genData.inhoud ?? "";
      }

      setGenStap(2); // "Opslaan"

      const res = await fetch("/api/contracten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId: Number(klantId),
          type,
          titel,
          inhoud,
          offerteId: offerteId ? Number(offerteId) : undefined,
          verloopdatum: verloopdatum || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Aanmaken mislukt");
      }

      const { contract } = await res.json();
      addToast("Contract aangemaakt", "succes");
      setModalOpen(false);
      resetForm();
      fetchData();

      // Navigeer direct naar detailpagina
      window.location.href = `/offertes/contracten/${contract.id}`;
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout bij aanmaken", "fout");
    } finally {
      setGenStap(null);
    }
  }

  function resetForm() {
    setTitel(""); setKlantId(""); setOfferteId(""); setVerloopdatum(""); setType("samenwerkingsovereenkomst");
  }

  async function handlePdfDownload(e: React.MouseEvent, contractId: number, titel: string) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/contracten/${contractId}/pdf`);
      if (!res.ok) throw new Error("PDF mislukt");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${titel}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast("PDF genereren mislukt", "fout");
    }
  }

  const vandaag = new Date().toISOString().slice(0, 10);

  // Smart empty state: klanten zonder contract
  const klantIdsMetContract = new Set(contracten.map((c) => c.klantId));
  const klantZonderContract = klanten.find((k) => !klantIdsMetContract.has(k.id));

  // Stats
  const stats = {
    totaal: contracten.length,
    ondertekend: contracten.filter((c) => c.status === "ondertekend").length,
    concept: contracten.filter((c) => c.status === "concept" || c.status === "verzonden").length,
    verlopen: contracten.filter((c) => c.status === "verlopen" || (c.verloopdatum && c.verloopdatum < vandaag)).length,
  };

  // Filter
  const gefilterdeContracten = filterStatus === "alle"
    ? contracten
    : filterStatus === "actief"
      ? contracten.filter((c) => c.status === "ondertekend")
      : filterStatus === "concept"
        ? contracten.filter((c) => c.status === "concept" || c.status === "verzonden")
        : contracten.filter((c) => c.status === "verlopen" || (c.verloopdatum && c.verloopdatum < vandaag));

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">Contracten</h1>
            <p className="text-autronis-text-secondary mt-1">{contracten.length} contracten</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
          >
            <Plus className="w-4 h-4" />
            Nieuw contract
          </button>
        </div>

        {/* Stats balk */}
        {contracten.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Totaal", value: stats.totaal, color: "text-autronis-text-primary", bg: "bg-autronis-card" },
              { label: "Ondertekend", value: stats.ondertekend, color: "text-green-400", bg: "bg-green-500/5" },
              { label: "In behandeling", value: stats.concept, color: "text-blue-400", bg: "bg-blue-500/5" },
              { label: "Verlopen", value: stats.verlopen, color: "text-red-400", bg: "bg-red-500/5" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                className={cn("border border-autronis-border rounded-xl p-4", stat.bg)}
              >
                <AnimatedNumber
                  value={stat.value}
                  format={(n) => Math.round(n).toString()}
                  className={cn("text-2xl font-bold tabular-nums", stat.color)}
                />
                <p className="text-xs text-autronis-text-secondary mt-0.5 uppercase tracking-wide">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Template action cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(TYPE_CONFIG).map(([key, config], i) => {
            const Icon = config.icon;
            const count = contracten.filter(c => c.type === key).length;
            return (
              <motion.button
                key={key}
                onClick={() => { setType(key); setModalOpen(true); }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2, delay: i * 0.06 }}
                className={cn(
                  "bg-autronis-card border border-autronis-border rounded-xl p-6 text-left transition-all duration-200 group",
                  config.glow
                )}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors"
                  style={{ backgroundColor: `${config.kleur}15` }}
                >
                  <Icon className="w-6 h-6 transition-transform group-hover:scale-110" style={{ color: config.kleur }} />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-semibold text-autronis-text-primary">{config.label}</span>
                  {count > 0 && (
                    <span className="text-xs text-autronis-text-secondary bg-autronis-bg px-1.5 py-0.5 rounded-full">{count}</span>
                  )}
                </div>
                <p className="text-sm text-autronis-text-secondary mb-4 leading-relaxed">{config.beschrijving}</p>
                <div className="flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: config.kleur }}>
                  Aanmaken
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Filter chips */}
        {contracten.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: "alle", label: "Alle", count: contracten.length },
              { key: "actief", label: "Ondertekend", count: stats.ondertekend },
              { key: "concept", label: "In behandeling", count: stats.concept },
              { key: "verlopen", label: "Verlopen", count: stats.verlopen },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  filterStatus === f.key
                    ? "bg-autronis-accent/15 border-autronis-accent/40 text-autronis-accent"
                    : "bg-autronis-card border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                {f.label}
                <span className="opacity-60">{f.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Contract lijst */}
        {loading ? (
          <div className="flex items-center gap-2 text-autronis-text-secondary py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Laden...
          </div>
        ) : gefilterdeContracten.length === 0 && filterStatus !== "alle" ? (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-10 text-center">
            <p className="text-autronis-text-secondary text-sm">Geen contracten in deze categorie.</p>
          </div>
        ) : contracten.length === 0 ? (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center space-y-4">
            <FileText className="w-10 h-10 text-autronis-text-secondary/30 mx-auto" />
            {klantZonderContract ? (
              <>
                <p className="text-autronis-text-secondary text-sm">
                  Je hebt {klanten.filter(k => !klantIdsMetContract.has(k.id)).length} klant{klanten.filter(k => !klantIdsMetContract.has(k.id)).length !== 1 ? "en" : ""} zonder contract.
                </p>
                <button
                  onClick={() => { setKlantId(String(klantZonderContract.id)); setModalOpen(true); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent/10 hover:bg-autronis-accent/20 text-autronis-accent rounded-xl text-sm font-medium transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Maak een Samenwerkingsovereenkomst aan voor {klantZonderContract.bedrijfsnaam}
                </button>
              </>
            ) : (
              <p className="text-autronis-text-secondary text-sm">Kies een template hierboven om te beginnen.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {gefilterdeContracten.map((c, index) => {
                const config = TYPE_CONFIG[c.type] || TYPE_CONFIG.samenwerkingsovereenkomst;
                const Icon = config.icon;
                const status = STATUS_CONFIG[c.status] || STATUS_CONFIG.concept;
                const verlopen = c.verloopdatum && c.verloopdatum < vandaag;
                const dagenVerlopen = verlopen && c.verloopdatum
                  ? Math.floor((Date.now() - new Date(c.verloopdatum).getTime()) / 86400000)
                  : null;
                const dagenTotExpiry = !verlopen && c.verloopdatum
                  ? Math.ceil((new Date(c.verloopdatum).getTime() - Date.now()) / 86400000)
                  : null;
                const binaVerlopen = dagenTotExpiry !== null && dagenTotExpiry <= 30;
                const isOndertekend = c.status === "ondertekend";
                const showConfetti = confettiId === c.id && isOndertekend;

                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.04 }}
                    className="relative"
                  >
                    {showConfetti && (
                      <ConfettiBurst />
                    )}
                    <Link
                      href={`/offertes/contracten/${c.id}`}
                      className={cn(
                        "flex items-center gap-4 bg-autronis-card border border-autronis-border border-l-4 rounded-xl p-4 hover:border-autronis-accent/30 transition-colors group",
                        status.borderLeft,
                        verlopen ? "opacity-70" : ""
                      )}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${config.kleur}15` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: config.kleur }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-autronis-text-primary truncate">{c.titel}</p>
                          {/* Type chip */}
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${config.kleur}15`, color: config.kleur }}
                          >
                            {config.shortLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-autronis-text-secondary flex-wrap">
                          <span>{c.klantNaam || "Geen klant"}</span>
                          {c.offerteNummer && <span className="text-autronis-accent">· {c.offerteNummer}</span>}
                          {verlopen && dagenVerlopen !== null && (
                            <span className="flex items-center gap-1 text-amber-400">
                              <AlertTriangle className="w-3 h-3" />
                              {dagenVerlopen} {dagenVerlopen === 1 ? "dag" : "dagen"} verlopen
                            </span>
                          )}
                          {binaVerlopen && dagenTotExpiry !== null && (
                            <span className="flex items-center gap-1 text-amber-400 font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              Verloopt over {dagenTotExpiry} {dagenTotExpiry === 1 ? "dag" : "dagen"}
                            </span>
                          )}
                          {!verlopen && !binaVerlopen && c.verloopdatum && (
                            <span className="flex items-center gap-1 text-autronis-text-secondary/60">
                              <CalendarClock className="w-3 h-3" />
                              {new Date(c.verloopdatum).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.span
                          key={c.status}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className={cn("px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 shrink-0", status.bg, status.kleur)}
                        >
                          {isOndertekend && <Check className="w-3 h-3" />}
                          {status.label}
                        </motion.span>
                      </AnimatePresence>

                      <span className="text-xs text-autronis-text-secondary shrink-0 hidden sm:block">
                        {new Date(c.aangemaaktOp).toLocaleDateString("nl-NL")}
                      </span>

                      {/* PDF knop */}
                      <button
                        onClick={(e) => handlePdfDownload(e, c.id, c.titel)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-autronis-text-secondary hover:text-autronis-accent transition-all rounded-lg shrink-0"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <ChevronRight className="w-4 h-4 text-autronis-text-secondary shrink-0" />
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Aanmaken modal */}
        <AnimatePresence>
          {modalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => !genStap && setModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-autronis-card border border-autronis-border rounded-2xl p-7 w-full max-w-lg space-y-5"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-autronis-text-primary">Nieuw contract</h2>
                  {!genStap && (
                    <button onClick={() => setModalOpen(false)} className="p-1 text-autronis-text-secondary hover:text-autronis-text-primary">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Stap-loader */}
                <AnimatePresence>
                  {genStap !== null && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-2"
                    >
                      {GEN_STAPPEN.map((stap, i) => (
                        <div key={i} className={cn("flex items-center gap-2.5 text-sm transition-colors", i < genStap ? "text-green-400" : i === genStap ? "text-autronis-accent" : "text-autronis-text-secondary/40")}>
                          {i < genStap ? (
                            <Check className="w-4 h-4 flex-shrink-0" />
                          ) : i === genStap ? (
                            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-current flex-shrink-0" />
                          )}
                          <span className={i === genStap ? "font-medium" : ""}>{stap}</span>
                          {i === genStap && (
                            <motion.span
                              animate={{ opacity: [1, 0.4, 1] }}
                              transition={{ repeat: Infinity, duration: 1.2 }}
                              className="text-xs"
                            >...</motion.span>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {genStap === null && (
                  <>
                    {/* Type keuze */}
                    <div>
                      <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">Type contract</label>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(TYPE_CONFIG).map(([key, config]) => {
                          const Icon = config.icon;
                          const selected = type === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setType(key)}
                              className={cn(
                                "flex flex-col items-center gap-2 p-3.5 rounded-xl border text-center transition-all",
                                selected
                                  ? "border-current bg-opacity-10"
                                  : "border-autronis-border text-autronis-text-secondary hover:border-autronis-border/80"
                              )}
                              style={selected ? { borderColor: config.kleur, backgroundColor: `${config.kleur}12`, color: config.kleur } : {}}
                            >
                              <Icon className="w-5 h-5" />
                              <span className="text-[11px] font-medium leading-tight">{config.shortLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Klant */}
                    <div>
                      <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">Klant</label>
                      <select
                        value={klantId}
                        onChange={e => { setKlantId(e.target.value); setOfferteId(""); }}
                        className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/40"
                      >
                        <option value="">Selecteer klant...</option>
                        {klanten.map(k => <option key={k.id} value={k.id}>{k.bedrijfsnaam}</option>)}
                      </select>
                    </div>

                    {/* Offerte koppelen */}
                    {offertesByKlant.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">
                          Koppel aan offerte <span className="text-autronis-text-secondary/50 font-normal">(optioneel)</span>
                        </label>
                        <select
                          value={offerteId}
                          onChange={e => setOfferteId(e.target.value)}
                          className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/40"
                        >
                          <option value="">Geen offerte</option>
                          {offertesByKlant.map(o => (
                            <option key={o.id} value={o.id}>{o.offertenummer}{o.titel ? ` — ${o.titel}` : ""}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Titel */}
                    <div>
                      <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">Titel</label>
                      <input
                        value={titel}
                        onChange={e => setTitel(e.target.value)}
                        placeholder={`${TYPE_CONFIG[type]?.label || "Contract"} — ${klanten.find(k => String(k.id) === klantId)?.bedrijfsnaam || "Klantnaam"}`}
                        className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/40"
                      />
                    </div>

                    {/* Verloopdatum */}
                    <div>
                      <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">
                        Verloopdatum <span className="text-autronis-text-secondary/50 font-normal">(optioneel)</span>
                      </label>
                      <input
                        type="date"
                        value={verloopdatum}
                        onChange={e => setVerloopdatum(e.target.value)}
                        className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/40"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                      <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
                        Annuleren
                      </button>
                      <button
                        onClick={handleCreate}
                        disabled={!klantId || !titel}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-autronis-accent text-autronis-bg font-semibold rounded-xl hover:bg-autronis-accent-hover transition-colors disabled:opacity-50 shadow-lg shadow-autronis-accent/20"
                      >
                        <Sparkles className="w-4 h-4" />
                        Genereer & maak aan
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
