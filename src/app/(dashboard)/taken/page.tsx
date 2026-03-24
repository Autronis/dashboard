"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAutoSync } from "@/hooks/use-auto-sync";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, ListTodo, Loader2,
  ChevronDown, ChevronRight, Search, FolderOpen, Layers, Plus, X,
  Pencil, Bot, User, Copy, Terminal, GripVertical, Timer, Sparkles,
  Zap, RefreshCw, LayoutGrid, List, BarChart3, Play, CalendarPlus,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonTaken } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckBurst } from "@/components/ui/confetti";
import { useTaken } from "@/hooks/queries/use-taken";
import type { Taak, ProjectVoortgang } from "@/hooks/queries/use-taken";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTimer } from "@/hooks/use-timer";

// ─── Config ───
const statusConfig: Record<string, { icon: typeof Circle; color: string; bg: string; label: string }> = {
  open: { icon: Circle, color: "text-slate-400", bg: "bg-slate-500/15", label: "Open" },
  bezig: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/15", label: "Bezig" },
  afgerond: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/15", label: "Afgerond" },
};

const prioriteitConfig: Record<string, { color: string; bg: string; label: string; borderColor: string; sortOrder: number }> = {
  hoog: { color: "text-red-400", bg: "bg-red-500/15", label: "Hoog", borderColor: "border-l-red-500", sortOrder: 0 },
  normaal: { color: "text-yellow-400", bg: "bg-yellow-500/15", label: "Normaal", borderColor: "border-l-yellow-500/50", sortOrder: 1 },
  laag: { color: "text-slate-400", bg: "bg-slate-500/15", label: "Laag", borderColor: "border-l-slate-500/30", sortOrder: 2 },
};

const kanbanKolommen = [
  { status: "open", label: "Open", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30" },
  { status: "bezig", label: "Bezig", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  { status: "afgerond", label: "Afgerond", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
];

// ─── Progress Bar ───
function ProgressBar({ afgerond, totaal, size = "md" }: { afgerond: number; totaal: number; size?: "sm" | "md" }) {
  const pct = totaal > 0 ? Math.round((afgerond / totaal) * 100) : 0;
  const h = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className="flex items-center gap-2">
      <div className={cn("flex-1 rounded-full bg-autronis-border/30", h)}>
        <div className={cn("rounded-full transition-all duration-500", h, pct === 100 ? "bg-green-400/70" : "bg-autronis-accent/50")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-autronis-text-secondary/70 tabular-nums whitespace-nowrap">{afgerond}/{totaal}</span>
    </div>
  );
}

// ─── Types ───
interface GegroepeerdeData {
  projectId: number;
  projectNaam: string;
  totaal: number;
  afgerond: number;
  fases: { fase: string; totaal: number; afgerond: number; taken: Taak[] }[];
}

function groepeerTaken(taken: Taak[]): GegroepeerdeData[] {
  const projectMap = new Map<number, GegroepeerdeData>();
  const sorted = [...taken].sort((a, b) => (prioriteitConfig[a.prioriteit]?.sortOrder ?? 1) - (prioriteitConfig[b.prioriteit]?.sortOrder ?? 1));

  for (const taak of sorted) {
    const pId = taak.projectId ?? 0;
    const pNaam = taak.projectNaam ?? "Zonder project";
    let project = projectMap.get(pId);
    if (!project) { project = { projectId: pId, projectNaam: pNaam, totaal: 0, afgerond: 0, fases: [] }; projectMap.set(pId, project); }
    project.totaal++;
    if (taak.status === "afgerond") project.afgerond++;

    const faseNaam = taak.fase || "Backlog";
    let fase = project.fases.find((f) => f.fase === faseNaam);
    if (!fase) { fase = { fase: faseNaam, totaal: 0, afgerond: 0, taken: [] }; project.fases.push(fase); }
    fase.totaal++;
    if (taak.status === "afgerond") fase.afgerond++;
    fase.taken.push(taak);
  }

  return Array.from(projectMap.values()).sort((a, b) => a.projectNaam.localeCompare(b.projectNaam));
}

// ─── Copy Prompt ───
function CopyPromptButton({ prompt }: { prompt: string }) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prompt);
    addToast("Prompt gekopieerd", "succes");
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="relative">
      <button onClick={handleCopy} className="p-1 text-autronis-text-secondary hover:text-autronis-accent transition-colors" title="Kopieer prompt">
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            </motion.span>
          ) : (
            <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>
              <Copy className="w-3.5 h-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-autronis-card border border-autronis-border rounded-md text-[10px] text-green-400 whitespace-nowrap pointer-events-none z-10"
          >
            Gekopieerd!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Vandaag Doen Card (prominent, full width) ───
function VandaagDoenCard({ taken, onStatusToggle, onStartTimer, onPlanTaak }: {
  taken: Taak[];
  onStatusToggle: (taak: Taak) => void;
  onStartTimer: (taak: Taak) => void;
  onPlanTaak: (taak: Taak) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (taken.length === 0) return null;

  const eersteTaak = taken[0];
  const maxVisible = 3;
  const visibleTaken = showAll ? taken.slice(1) : taken.slice(1, maxVisible);
  const hiddenCount = taken.length - maxVisible;

  return (
    <div className="bg-gradient-to-r from-autronis-accent/10 via-autronis-card to-autronis-card border border-autronis-accent/30 rounded-2xl p-4">
      {/* Focus taak — de belangrijkste */}
      <div className="flex items-center gap-3 mb-3">
        <div className="p-1.5 rounded-lg bg-autronis-accent/15"><Zap className="w-4 h-4 text-autronis-accent" /></div>
        <span className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider">Volgende taak</span>
      </div>
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 bg-autronis-bg/60 rounded-xl border-l-[3px] transition-colors mb-2",
        eersteTaak.prioriteit === "hoog" ? "urgent-pulse" : "",
        prioriteitConfig[eersteTaak.prioriteit]?.borderColor ?? "border-l-yellow-500/50"
      )}>
        <button onClick={() => onStatusToggle(eersteTaak)}
          className={cn("flex-shrink-0 transition-colors hover:scale-110", statusConfig[eersteTaak.status]?.color ?? "text-slate-400")}>
          {eersteTaak.status === "afgerond" ? <CheckCircle2 className="w-5 h-5" /> :
           eersteTaak.status === "bezig" ? <Loader2 className="w-5 h-5 animate-spin" /> :
           <Circle className="w-5 h-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-autronis-text-primary truncate">{eersteTaak.titel}</p>
          <p className="text-xs text-autronis-text-secondary truncate">{eersteTaak.projectNaam}{eersteTaak.fase ? ` · ${eersteTaak.fase}` : ""}</p>
        </div>
        {eersteTaak.uitvoerder === "claude" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-semibold flex-shrink-0">Claude</span>}
        <button onClick={() => onPlanTaak(eersteTaak)}
          className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors flex-shrink-0" title="Plan in agenda">
          <CalendarPlus className="w-4 h-4" />
        </button>
        <button onClick={() => onStartTimer(eersteTaak)}
          className="btn-shimmer flex items-center gap-1.5 px-4 py-2 rounded-lg bg-autronis-accent text-autronis-bg text-xs font-bold hover:bg-autronis-accent-hover transition-colors flex-shrink-0">
          <Play className="w-3.5 h-3.5" /> Start
        </button>
        <button onClick={() => onStatusToggle({ ...eersteTaak, status: "bezig" } as Taak)}
          className="px-3 py-2 rounded-lg bg-green-500/15 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-colors flex-shrink-0">
          Klaar
        </button>
      </div>

      {/* Overige taken compact — max 2 meer zichtbaar */}
      {taken.length > 1 && (
        <div className="space-y-0.5">
          <AnimatePresence initial={false}>
          {visibleTaken.map((taak, i) => {
            const pc = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
            const sc = statusConfig[taak.status] || statusConfig.open;
            const StatusIcon = sc.icon;
            return (
              <motion.div
                key={taak.id}
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -4 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
              >
                <div className={cn("flex items-center gap-2.5 px-3 py-1.5 bg-autronis-bg/20 rounded-lg border-l-[2px] transition-colors hover:bg-autronis-bg/40 group", pc.borderColor)}>
                  <button onClick={() => onStatusToggle(taak)} className={cn("flex-shrink-0 transition-colors hover:scale-110", sc.color)}>
                    <StatusIcon className={cn("w-3 h-3", taak.status === "bezig" && "animate-spin")} />
                  </button>
                  <p className="flex-1 text-[11px] text-autronis-text-primary truncate">{taak.titel}</p>
                  <span className="text-[10px] text-autronis-text-secondary truncate max-w-16">{taak.projectNaam}</span>
                  {taak.uitvoerder === "claude" && <Bot className="w-2.5 h-2.5 text-purple-400 flex-shrink-0" />}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => onPlanTaak(taak)} className="p-0.5 text-autronis-text-secondary hover:text-autronis-accent transition-colors" title="Plan"><CalendarPlus className="w-3 h-3" /></button>
                    <button onClick={() => onStartTimer(taak)} className="p-0.5 text-autronis-text-secondary hover:text-autronis-accent transition-colors" title="Start"><Timer className="w-3 h-3" /></button>
                    <button onClick={() => onStatusToggle({ ...taak, status: "bezig" } as Taak)} className="p-0.5 text-autronis-text-secondary hover:text-green-400 transition-colors" title="Klaar"><CheckCircle2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
          {!showAll && hiddenCount > 0 && (
            <button onClick={() => setShowAll(true)} className="w-full text-center py-1 text-[11px] text-autronis-text-secondary hover:text-autronis-accent transition-colors">
              +{hiddenCount} meer
            </button>
          )}
          {showAll && hiddenCount > 0 && (
            <button onClick={() => setShowAll(false)} className="w-full text-center py-1 text-[11px] text-autronis-text-secondary hover:text-autronis-accent transition-colors">
              Minder tonen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Kanban Card ───
function KanbanCard({ taak, onStatusToggle, onOpenDetail, vandaag }: { taak: Taak; onStatusToggle: (t: Taak) => void; onOpenDetail: (t: Taak) => void; vandaag: string }) {
  const pc = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
  const isVerlopen = taak.deadline && taak.deadline < vandaag && taak.status !== "afgerond";
  return (
    <div draggable onDragStart={(e) => { e.dataTransfer.setData("taakId", String(taak.id)); e.dataTransfer.effectAllowed = "move"; }}
      className={cn("bg-autronis-bg/60 rounded-lg p-3 border-l-[3px] cursor-grab active:cursor-grabbing hover:bg-autronis-bg/80 transition-colors", pc.borderColor)}>
      <div className="flex items-start gap-2">
        <button onClick={() => onStatusToggle(taak)} className={cn("flex-shrink-0 mt-0.5", statusConfig[taak.status]?.color || "text-slate-400")}>
          {taak.status === "afgerond" ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p onClick={() => onOpenDetail(taak)} className={cn("text-xs font-medium leading-snug cursor-pointer hover:text-autronis-accent transition-colors", taak.status === "afgerond" ? "text-autronis-text-secondary line-through" : "text-autronis-text-primary")}>{taak.titel}</p>
          <p className="text-[10px] text-autronis-text-secondary mt-1 truncate">{taak.projectNaam}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", pc.bg, pc.color)}>{pc.label}</span>
        {taak.uitvoerder === "claude" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-medium">Claude</span>}
        {isVerlopen && <span className="text-[10px] text-red-400 font-medium ml-auto"><AlertTriangle className="w-3 h-3 inline" /></span>}
        {taak.deadline && !isVerlopen && <span className="text-[10px] text-autronis-text-secondary ml-auto tabular-nums">{formatDatum(taak.deadline)}</span>}
      </div>
    </div>
  );
}

// ─── Voortgang Compact (onderaan) ───
function VoortgangCompact({ taken, projecten }: { taken: Taak[]; projecten: ProjectVoortgang[] }) {
  const totaal = taken.length;
  const afgerond = taken.filter((t) => t.status === "afgerond").length;
  const pct = totaal > 0 ? Math.round((afgerond / totaal) * 100) : 0;

  if (totaal === 0) return null;

  return (
    <div className="bg-autronis-card/60 border border-autronis-border/50 rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-3.5 h-3.5 text-autronis-text-secondary" />
        <span className="text-xs font-medium text-autronis-text-secondary">Voortgang</span>
        <div className="flex-1 max-w-32 h-1 bg-autronis-bg rounded-full overflow-hidden">
          <div className="h-full bg-autronis-accent/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-semibold text-autronis-accent tabular-nums">{pct}%</span>
        <span className="text-[10px] text-autronis-text-secondary tabular-nums">{afgerond}/{totaal}</span>
        {projecten.length > 0 && (
          <div className="hidden lg:flex items-center gap-3 ml-2 pl-3 border-l border-autronis-border/50">
            {projecten.slice(0, 4).map((p) => {
              const ppct = p.totaal > 0 ? Math.round((p.afgerond / p.totaal) * 100) : 0;
              return (
                <div key={p.projectId} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-autronis-text-secondary truncate max-w-20">{p.projectNaam}</span>
                  <div className="w-8 h-1 bg-autronis-bg rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full bg-autronis-accent/40 rounded-full" style={{ width: `${ppct}%` }} />
                  </div>
                  <span className="text-[10px] text-autronis-text-secondary/70 tabular-nums">{ppct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Taak Detail Modal ───
function TaakDetailModal({ taak, onClose, onStatusToggle, onStartTimer, onPlanTaak, onDelete, onEdit }: {
  taak: Taak;
  onClose: () => void;
  onStatusToggle: (taak: Taak) => void;
  onStartTimer: (taak: Taak) => void;
  onPlanTaak: (taak: Taak) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, body: Record<string, string | undefined>) => void;
}) {
  const sc = statusConfig[taak.status] || statusConfig.open;
  const pc = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
  const StatusIcon = sc.icon;
  const isClaude = taak.uitvoerder === "claude";
  const isVerlopen = taak.deadline && taak.deadline < new Date().toISOString().slice(0, 10) && taak.status !== "afgerond";
  const { addToast } = useToast();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl w-full max-w-xl mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header met status + acties */}
        <div className="flex items-center gap-3 p-5 pb-0">
          <button onClick={() => onStatusToggle(taak)} className={cn("flex-shrink-0 transition-colors hover:scale-110", sc.color)} title={`Status: ${sc.label}`}>
            <StatusIcon className={cn("w-6 h-6", taak.status === "bezig" && "animate-spin")} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-autronis-text-primary">{taak.titel}</h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-autronis-text-secondary">{taak.projectNaam}</span>
              {taak.fase && <span className="text-xs text-autronis-text-secondary">&middot; {taak.fase}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
          <span className={cn("text-xs px-2 py-1 rounded-full font-medium", sc.bg, sc.color)}>{sc.label}</span>
          <span className={cn("text-xs px-2 py-1 rounded-full font-medium", pc.bg, pc.color)}>{pc.label} prioriteit</span>
          {isClaude && <span className="text-xs px-2 py-1 rounded-full bg-purple-500/15 text-purple-400 font-medium flex items-center gap-1"><Bot className="w-3 h-3" /> Claude</span>}
          {!isClaude && <span className="text-xs px-2 py-1 rounded-full bg-orange-500/15 text-orange-400 font-medium flex items-center gap-1"><User className="w-3 h-3" /> Handmatig</span>}
          {taak.deadline && (
            <span className={cn("text-xs px-2 py-1 rounded-full font-medium", isVerlopen ? "bg-red-500/15 text-red-400" : "bg-autronis-bg text-autronis-text-secondary")}>
              {isVerlopen && <AlertTriangle className="w-3 h-3 inline mr-1" />}
              Deadline: {formatDatum(taak.deadline)}
            </span>
          )}
          {taak.klantNaam && <span className="text-xs text-autronis-text-secondary">Klant: {taak.klantNaam}</span>}
          {taak.toegewezenAanNaam && <span className="text-xs text-autronis-text-secondary">Toegewezen: {taak.toegewezenAanNaam}</span>}
        </div>

        {/* Omschrijving */}
        <div className="px-5 pt-4 space-y-3">
          {taak.omschrijving ? (
            <div>
              <h3 className="text-[11px] font-semibold text-autronis-text-secondary uppercase tracking-wider mb-1.5">Wat moet er gebeuren</h3>
              <div className="bg-autronis-bg/50 rounded-xl p-4 border border-autronis-border/50">
                <p className="text-sm text-autronis-text-primary leading-relaxed whitespace-pre-wrap">{taak.omschrijving}</p>
              </div>
            </div>
          ) : (
            <div className="bg-autronis-bg/30 rounded-xl p-4 border border-autronis-border/30">
              <p className="text-sm text-autronis-text-secondary italic">Geen omschrijving toegevoegd</p>
            </div>
          )}

          {/* Claude prompt */}
          {isClaude && taak.prompt && (
            <div>
              <h3 className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Terminal className="w-3 h-3" /> Prompt
              </h3>
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                <pre className="text-sm text-autronis-text-primary leading-relaxed whitespace-pre-wrap font-mono">{taak.prompt}</pre>
              </div>
            </div>
          )}

          {/* Project map */}
          {isClaude && taak.projectMap && (
            <div className="flex items-center gap-2 bg-autronis-bg/50 border border-autronis-border/50 rounded-lg px-3 py-2">
              <FolderOpen className="w-3.5 h-3.5 text-autronis-accent flex-shrink-0" />
              <span className="text-[11px] text-autronis-text-secondary">Project map:</span>
              <span className="text-xs text-autronis-text-primary font-mono select-all">{taak.projectMap}</span>
            </div>
          )}

          {/* Aangemaakt op */}
          {taak.aangemaaktOp && (
            <p className="text-[11px] text-autronis-text-secondary/60">Aangemaakt op {formatDatum(taak.aangemaaktOp)}</p>
          )}
        </div>

        {/* Acties onderaan */}
        <div className="flex flex-wrap items-center gap-2 p-5 pt-4 border-t border-autronis-border/50 mt-4">
          {taak.status !== "afgerond" && (
            <>
              <button onClick={() => { onStartTimer(taak); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-autronis-accent text-autronis-bg text-sm font-bold hover:bg-autronis-accent-hover transition-colors">
                <Play className="w-3.5 h-3.5" /> Start timer
              </button>
              <button onClick={() => { onStatusToggle({ ...taak, status: "bezig" } as Taak); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500/15 text-green-400 text-sm font-semibold hover:bg-green-500/25 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" /> Markeer klaar
              </button>
              <button onClick={() => { onPlanTaak(taak); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-autronis-border text-autronis-text-secondary text-sm font-medium hover:border-autronis-accent/40 hover:text-autronis-accent transition-colors">
                <CalendarPlus className="w-3.5 h-3.5" /> Plan in agenda
              </button>
            </>
          )}
          {taak.status === "afgerond" && (
            <button onClick={() => { onStatusToggle(taak); onClose(); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-autronis-border text-autronis-text-secondary text-sm font-medium hover:text-autronis-text-primary transition-colors">
              <Circle className="w-3.5 h-3.5" /> Heropenen
            </button>
          )}
          {isClaude && taak.prompt && taak.status !== "afgerond" && (
            <button onClick={() => { navigator.clipboard.writeText(taak.prompt!); addToast("Prompt gekopieerd", "succes"); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm font-semibold hover:bg-purple-500/20 transition-colors">
              <Sparkles className="w-3.5 h-3.5" /> Kopieer prompt
            </button>
          )}
          <button onClick={() => { onDelete(taak.id); onClose(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-red-400/70 text-sm font-medium hover:bg-red-500/10 hover:text-red-400 transition-colors ml-auto">
            <X className="w-3.5 h-3.5" /> Verwijder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function TakenPage() {
  useAutoSync();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const timer = useTimer();
  const [weergave, setWeergave] = useState<"lijst" | "kanban" | "compact">("lijst");
  const [statusFilter, setStatusFilter] = useState("alle");
  const [projectFilter, setProjectFilter] = useState("alle");
  const [faseFilter, setFaseFilter] = useState("alle");
  const [prioriteitFilter, setPrioriteitFilter] = useState("alle");
  const [uitvoerderFilter, setUitvoerderFilter] = useState("alle");
  const [zoek, setZoek] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(new Set());
  const [collapsedFases, setCollapsedFases] = useState<Set<string>>(new Set());
  const [completedTaskId, setCompletedTaskId] = useState<number | null>(null);
  const [selectedTaak, setSelectedTaak] = useState<Taak | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFase, setEditFase] = useState("");
  const [editPrioriteit, setEditPrioriteit] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [nieuwTitel, setNieuwTitel] = useState("");
  const [nieuwProject, setNieuwProject] = useState("");
  const [nieuwFase, setNieuwFase] = useState("");
  const [nieuwPrioriteit, setNieuwPrioriteit] = useState("normaal");
  const [nieuwDeadline, setNieuwDeadline] = useState("");
  const [nieuwOmschrijving, setNieuwOmschrijving] = useState("");
  const [nieuwUitvoerder, setNieuwUitvoerder] = useState("handmatig");
  const [nieuwPrompt, setNieuwPrompt] = useState("");
  const [nieuwProjectMap, setNieuwProjectMap] = useState("");
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectSectionsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const { data, isLoading: loading, refetch: fetchTaken } = useTaken({
    status: statusFilter,
    zoek,
    projectId: projectFilter,
    fase: faseFilter,
    prioriteit: prioriteitFilter,
  });

  const { data: mappenData } = useQuery({
    queryKey: ["projectmappen"],
    queryFn: async () => {
      const res = await fetch("/api/taken/projectmappen");
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ mappen: { naam: string; pad: string }[] }>;
    },
    staleTime: 60_000,
  });
  const projectMappen = mappenData?.mappen ?? [];

  const taken = data?.taken ?? [];
  const kpis = data?.kpis ?? { totaal: 0, open: 0, bezig: 0, afgerond: 0, verlopen: 0 };
  const projectVoortgang = data?.projecten ?? [];

  const gefilterdeTaken = useMemo(() => {
    if (uitvoerderFilter === "alle") return taken;
    return taken.filter((t) => (t.uitvoerder || "handmatig") === uitvoerderFilter);
  }, [taken, uitvoerderFilter]);

  const gegroepeerd = useMemo(() => groepeerTaken(gefilterdeTaken), [gefilterdeTaken]);

  // "Vandaag doen" — top 5 niet-afgeronde taken
  const vandaagTaken = useMemo(() => {
    const vandaag = new Date().toISOString().slice(0, 10);
    return taken
      .filter((t) => t.status !== "afgerond")
      .sort((a, b) => {
        const aV = a.deadline && a.deadline <= vandaag ? -1 : 0;
        const bV = b.deadline && b.deadline <= vandaag ? -1 : 0;
        if (aV !== bV) return aV - bV;
        const pa = prioriteitConfig[a.prioriteit]?.sortOrder ?? 1;
        const pb = prioriteitConfig[b.prioriteit]?.sortOrder ?? 1;
        if (pa !== pb) return pa - pb;
        if (a.status === "bezig" && b.status !== "bezig") return -1;
        if (b.status === "bezig" && a.status !== "bezig") return 1;
        return 0;
      })
      .slice(0, 5);
  }, [taken]);

  const uniekeProjecten = useMemo(() => {
    const set = new Map<string, string>();
    for (const pv of projectVoortgang) set.set(String(pv.projectId), pv.projectNaam);
    return Array.from(set.entries()).map(([id, naam]) => ({ id, naam }));
  }, [projectVoortgang]);

  const uniekeFases = useMemo(() => {
    const set = new Set<string>();
    for (const t of taken) set.add(t.fase || "Backlog");
    return Array.from(set).sort();
  }, [taken]);

  const showCheckBurst = useCallback((taskId: number) => {
    setCompletedTaskId(taskId);
    if (completedTimerRef.current) clearTimeout(completedTimerRef.current);
    completedTimerRef.current = setTimeout(() => setCompletedTaskId(null), 500);
  }, []);

  // ─── Mutations ───
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/taken/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error();
      return status;
    },
    onSuccess: (status, { id }) => { if (status === "afgerond") showCheckBurst(id); queryClient.invalidateQueries({ queryKey: ["taken"] }); },
    onError: () => addToast("Kon status niet bijwerken", "fout"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (taakId: number) => { const res = await fetch(`/api/taken/${taakId}`, { method: "DELETE" }); if (!res.ok) throw new Error(); },
    onSuccess: () => { addToast("Taak verwijderd", "succes"); queryClient.invalidateQueries({ queryKey: ["taken"] }); },
    onError: () => addToast("Kon taak niet verwijderen", "fout"),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, ...body }: { id: number; fase?: string; prioriteit?: string }) => {
      const res = await fetch(`/api/taken/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setEditingId(null); queryClient.invalidateQueries({ queryKey: ["taken"] }); },
    onError: () => addToast("Kon taak niet bijwerken", "fout"),
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => { const res = await fetch("/api/taken", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!res.ok) throw new Error(); },
    onSuccess: () => { addToast("Taak aangemaakt", "succes"); setModalOpen(false); queryClient.invalidateQueries({ queryKey: ["taken"] }); },
    onError: () => addToast("Kon taak niet aanmaken", "fout"),
  });

  // ─── Handlers ───
  const handleStatusToggle = (taak: Taak) => {
    const volgende = taak.status === "open" ? "bezig" : taak.status === "bezig" ? "afgerond" : "open";
    statusMutation.mutate({ id: taak.id, status: volgende });
  };

  const handleMarkDone = (taak: Taak) => {
    statusMutation.mutate({ id: taak.id, status: "afgerond" });
  };

  const handleDelete = (taakId: number) => deleteMutation.mutate(taakId);

  const handleStartTimer = useCallback(async (taak: Taak) => {
    if (timer.isRunning) { addToast("Timer loopt al — stop eerst de huidige", "fout"); return; }
    try {
      const res = await fetch("/api/tijdregistraties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: taak.projectId, omschrijving: taak.titel, categorie: "development" }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      timer.start(taak.projectId ?? 0, taak.titel, "development", data.registratie.id);
      if (taak.status === "open") statusMutation.mutate({ id: taak.id, status: "bezig" });
      addToast(`Timer gestart: ${taak.titel}`, "succes");
    } catch { addToast("Kon timer niet starten", "fout"); }
  }, [timer, addToast, statusMutation]);

  const handlePlanTaak = useCallback((taak: Taak) => {
    const vandaagDatum = new Date().toISOString().slice(0, 10);
    const params = new URLSearchParams({
      titel: taak.titel,
      datum: taak.deadline || vandaagDatum,
      projectId: String(taak.projectId ?? ""),
    });
    window.location.href = `/agenda?plan=${params.toString()}`;
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/projecten/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout || "Sync mislukt");
      const totaalNieuw = json.resultaten.reduce((s: number, r: { takenToegevoegd: number }) => s + r.takenToegevoegd, 0);
      addToast(`${json.totaalProjecten} projecten gesynced — ${totaalNieuw} nieuwe taken`, "succes");
      fetchTaken();
    } catch (err) { addToast(err instanceof Error ? err.message : "Sync mislukt", "fout"); }
    finally { setSyncing(false); }
  };

  const openNieuwModal = () => {
    setNieuwTitel(""); setNieuwProject(uniekeProjecten[0]?.id ?? ""); setNieuwFase("");
    setNieuwPrioriteit("normaal"); setNieuwDeadline(""); setNieuwOmschrijving("");
    setNieuwUitvoerder("handmatig"); setNieuwPrompt(""); setNieuwProjectMap("");
    setModalOpen(true);
  };

  const handleCreate = () => {
    if (!nieuwTitel.trim() || !nieuwProject) return;
    createMutation.mutate({
      projectId: Number(nieuwProject), titel: nieuwTitel.trim(),
      omschrijving: nieuwOmschrijving.trim() || null, fase: nieuwFase || null,
      prioriteit: nieuwPrioriteit, deadline: nieuwDeadline || null,
      uitvoerder: nieuwUitvoerder,
      prompt: nieuwUitvoerder === "claude" ? nieuwPrompt.trim() || null : null,
      projectMap: nieuwUitvoerder === "claude" ? nieuwProjectMap || null : null,
    });
  };

  const toggleProject = (projectId: number) => {
    setCollapsedProjects((prev) => { const next = new Set(prev); next.has(projectId) ? next.delete(projectId) : next.add(projectId); return next; });
  };

  const toggleFase = (key: string) => {
    setCollapsedFases((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };

  const scrollToProject = (projectId: number) => {
    setProjectFilter("alle");
    setCollapsedProjects((prev) => { const next = new Set(prev); next.delete(projectId); return next; });
    setTimeout(() => {
      const el = projectSectionsRef.current.get(projectId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // ─── Drag & Drop ───
  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverStatus(null);
    const taakId = Number(e.dataTransfer.getData("taakId"));
    if (taakId) statusMutation.mutate({ id: taakId, status: newStatus });
  };

  const vandaag = new Date().toISOString().slice(0, 10);

  // Active filters count for badge
  const activeFilterCount = [
    statusFilter !== "alle",
    projectFilter !== "alle",
    faseFilter !== "alle",
    prioriteitFilter !== "alle",
    uitvoerderFilter !== "alle",
    zoek.length > 0,
  ].filter(Boolean).length;

  if (loading) return <div className="p-4 lg:p-6"><SkeletonTaken /></div>;

  return (
    <PageTransition>
      <div className="max-w-[1400px] mx-auto p-4 lg:p-6 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary">Taken</h1>
            <p className="text-sm text-autronis-text-secondary">
              {kpis.open + kpis.bezig} actief &middot; {kpis.afgerond} afgerond
              {kpis.verlopen > 0 && <span className="text-red-400 ml-1">&middot; {kpis.verlopen} verlopen</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-autronis-bg border border-autronis-border rounded-lg p-0.5">
              {([
                { key: "lijst" as const, icon: List, label: "Lijst" },
                { key: "kanban" as const, icon: LayoutGrid, label: "Kanban" },
                { key: "compact" as const, icon: ListTodo, label: "Compact" },
              ]).map((v) => (
                <button key={v.key} onClick={() => setWeergave(v.key)} title={v.label}
                  className={cn("p-1.5 rounded-md transition-colors", weergave === v.key ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>
                  <v.icon className="w-4 h-4" />
                </button>
              ))}
            </div>
            <button onClick={handleSync} disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-autronis-border hover:border-autronis-accent/40 text-autronis-text-secondary hover:text-autronis-accent rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
              <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
              Sync
            </button>
            <button onClick={openNieuwModal} className="inline-flex items-center gap-1.5 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4" /> Nieuw
            </button>
          </div>
        </div>

        {/* 1. VANDAAG DOEN — bovenaan, full width, prominent */}
        <VandaagDoenCard taken={vandaagTaken} onStatusToggle={handleMarkDone} onStartTimer={handleStartTimer} onPlanTaak={handlePlanTaak} />

        {/* 2. FILTER BAR — één compacte rij met groepen */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Status pills */}
          <div className="flex items-center gap-0.5 bg-autronis-card border border-autronis-border rounded-lg p-0.5">
            {[{ key: "alle", label: "Alle" }, { key: "open", label: "Open" }, { key: "bezig", label: "Bezig" }, { key: "afgerond", label: "Afgerond" }].map((f) => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors", statusFilter === f.key ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>{f.label}</button>
            ))}
          </div>

          <div className="w-px h-5 bg-autronis-border/40 mx-1 hidden sm:block" />

          {/* Dropdowns groep */}
          <div className="flex items-center gap-1.5">
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="bg-autronis-card border border-autronis-border rounded-lg px-2 py-1.5 text-xs text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent/50">
              <option value="alle">Project</option>
              {uniekeProjecten.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
            </select>
            <select value={prioriteitFilter} onChange={(e) => setPrioriteitFilter(e.target.value)} className="bg-autronis-card border border-autronis-border rounded-lg px-2 py-1.5 text-xs text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent/50">
              <option value="alle">Prioriteit</option>
              <option value="hoog">Hoog</option><option value="normaal">Normaal</option><option value="laag">Laag</option>
            </select>
            <select value={uitvoerderFilter} onChange={(e) => setUitvoerderFilter(e.target.value)} className="bg-autronis-card border border-autronis-border rounded-lg px-2 py-1.5 text-xs text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent/50">
              <option value="alle">Uitvoerder</option>
              <option value="claude">Claude</option>
              <option value="handmatig">Handmatig</option>
            </select>
            <select value={faseFilter} onChange={(e) => setFaseFilter(e.target.value)} className="bg-autronis-card border border-autronis-border rounded-lg px-2 py-1.5 text-xs text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent/50">
              <option value="alle">Fase</option>
              {uniekeFases.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Search + clear */}
          <div className="flex items-center gap-1.5 sm:ml-auto">
            <div className="relative sm:w-40">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-autronis-text-secondary/50" />
              <input type="text" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoeken..."
                className="w-full bg-autronis-card border border-autronis-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-autronis-accent/50" />
            </div>
            {activeFilterCount > 0 && (
              <button onClick={() => { setStatusFilter("alle"); setProjectFilter("alle"); setFaseFilter("alle"); setPrioriteitFilter("alle"); setUitvoerderFilter("alle"); setZoek(""); }}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-autronis-text-secondary hover:text-red-400 transition-colors whitespace-nowrap">
                <X className="w-3 h-3" /> Wis ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* 3. TAKEN LIJST / KANBAN / COMPACT — core product */}

        {/* ─── KANBAN VIEW ─── */}
        {weergave === "kanban" && (
          <div className="grid grid-cols-3 gap-3" style={{ minHeight: 400 }}>
            {kanbanKolommen.map((kolom) => {
              const kolomTaken = gefilterdeTaken.filter((t) => t.status === kolom.status);
              return (
                <div key={kolom.status}
                  onDragOver={(e) => { e.preventDefault(); setDragOverStatus(kolom.status); }}
                  onDragLeave={() => setDragOverStatus(null)}
                  onDrop={(e) => handleDrop(e, kolom.status)}
                  className={cn("bg-autronis-card border rounded-xl p-3 transition-colors", dragOverStatus === kolom.status ? "border-autronis-accent bg-autronis-accent/5" : "border-autronis-border")}>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className={cn("w-2 h-2 rounded-full", kolom.bg.replace("/10", ""))} />
                    <span className={cn("text-sm font-semibold", kolom.color)}>{kolom.label}</span>
                    <span className="text-xs text-autronis-text-secondary ml-auto tabular-nums">{kolomTaken.length}</span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {kolomTaken.map((taak) => (
                      <KanbanCard key={taak.id} taak={taak} onStatusToggle={handleStatusToggle} onOpenDetail={setSelectedTaak} vandaag={vandaag} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── COMPACT VIEW ─── */}
        {weergave === "compact" && (
          <div className="bg-autronis-card border border-autronis-border rounded-xl overflow-hidden">
            <div className="divide-y divide-autronis-border/30">
              {gefilterdeTaken.map((taak) => {
                const sc = statusConfig[taak.status] || statusConfig.open;
                const pc = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
                const StatusIcon = sc.icon;
                const isVerlopen = taak.deadline && taak.deadline < vandaag && taak.status !== "afgerond";
                return (
                  <div key={taak.id} className={cn("flex items-center gap-3 px-4 py-1.5 hover:bg-autronis-bg/30 transition-colors group", taak.status === "afgerond" && "opacity-40")}>
                    <button onClick={() => handleStatusToggle(taak)} className={cn("flex-shrink-0", sc.color)}>
                      <StatusIcon className={cn("w-3.5 h-3.5", taak.status === "bezig" && "animate-spin")} />
                    </button>
                    <p onClick={() => setSelectedTaak(taak)} className={cn("flex-1 text-xs truncate cursor-pointer hover:text-autronis-accent transition-colors", taak.status === "afgerond" ? "text-autronis-text-secondary line-through" : "text-autronis-text-primary")}>{taak.titel}</p>
                    <span className="text-[10px] text-autronis-text-secondary truncate max-w-24">{taak.projectNaam}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0", pc.bg, pc.color)}>{pc.label}</span>
                    {taak.uitvoerder === "claude" && <Bot className="w-3 h-3 text-purple-400 flex-shrink-0" />}
                    {isVerlopen && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                    {/* Hover actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {taak.status !== "afgerond" && (
                        <>
                          <button onClick={() => handleStartTimer(taak)} className="p-0.5 text-autronis-text-secondary hover:text-autronis-accent transition-colors" title="Start timer"><Timer className="w-3 h-3" /></button>
                          <button onClick={() => handleMarkDone(taak)} className="p-0.5 text-autronis-text-secondary hover:text-green-400 transition-colors" title="Markeer klaar"><CheckCircle2 className="w-3 h-3" /></button>
                        </>
                      )}
                    </div>
                    <div className="relative"><CheckBurst active={completedTaskId === taak.id} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── LIJST VIEW ─── */}
        {weergave === "lijst" && (
          <>
            {/* Drop zones */}
            <div className="grid grid-cols-3 gap-2">
              {(["open", "bezig", "afgerond"] as const).map((status) => {
                const sc = statusConfig[status]; const Icon = sc.icon;
                const count = taken.filter((t) => t.status === status).length;
                return (
                  <div key={status} onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }} onDragLeave={() => setDragOverStatus(null)} onDrop={(e) => handleDrop(e, status)}
                    className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-dashed transition-colors", dragOverStatus === status ? "border-autronis-accent bg-autronis-accent/10" : "border-autronis-border/30 bg-autronis-bg/20")}>
                    <Icon className={cn("w-3.5 h-3.5", sc.color)} /><span className="text-xs font-medium text-autronis-text-primary">{sc.label}</span>
                    <span className="text-xs text-autronis-text-secondary ml-auto tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Gegroepeerde taken */}
            {gefilterdeTaken.length === 0 ? (
              <EmptyState titel="Geen taken" beschrijving="Voeg je eerste taak toe om te beginnen." actieLabel="Nieuwe taak" onActie={openNieuwModal} />
            ) : (
              <div className="space-y-2">
                {gegroepeerd.map((project) => {
                  const isPC = !collapsedProjects.has(project.projectId);
                  return (
                    <div key={project.projectId} ref={(el) => { if (el) projectSectionsRef.current.set(project.projectId, el); }}
                      className="bg-autronis-card border border-autronis-border rounded-xl overflow-hidden">
                      <button onClick={() => toggleProject(project.projectId)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-autronis-bg/30 transition-colors">
                        {isPC ? <ChevronRight className="w-3.5 h-3.5 text-autronis-text-secondary" /> : <ChevronDown className="w-3.5 h-3.5 text-autronis-text-secondary" />}
                        <FolderOpen className="w-3.5 h-3.5 text-autronis-accent" />
                        <span className="text-xs font-semibold text-autronis-text-primary">{project.projectNaam}</span>
                        <div className="flex-1 max-w-32"><ProgressBar afgerond={project.afgerond} totaal={project.totaal} size="sm" /></div>
                      </button>
                      {!isPC && (
                        <div className="border-t border-autronis-border/50">
                          {project.fases.map((fase) => {
                            const faseKey = `${project.projectId}-${fase.fase}`;
                            const isFC = collapsedFases.has(faseKey);
                            const isComplete = fase.afgerond === fase.totaal && fase.totaal > 0;
                            return (
                              <div key={faseKey}>
                                <button onClick={() => toggleFase(faseKey)} className="w-full flex items-center gap-2 px-3 py-1.5 pl-9 hover:bg-autronis-bg/20 transition-colors">
                                  {isFC ? <ChevronRight className="w-3 h-3 text-autronis-text-secondary" /> : <ChevronDown className="w-3 h-3 text-autronis-text-secondary" />}
                                  <Layers className="w-3 h-3 text-autronis-text-secondary" />
                                  <span className={cn("text-[11px] font-medium", isComplete ? "text-green-400" : "text-autronis-text-primary")}>{fase.fase}</span>
                                  {isComplete && <CheckCircle2 className="w-2.5 h-2.5 text-green-400" />}
                                  <div className="flex-1 max-w-24"><ProgressBar afgerond={fase.afgerond} totaal={fase.totaal} size="sm" /></div>
                                </button>
                                {!isFC && (
                                  <div className="space-y-px px-3 pb-1 pl-14">
                                    {fase.taken.map((taak) => {
                                      const sc = statusConfig[taak.status] || statusConfig.open;
                                      const pc = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
                                      const StatusIcon = sc.icon;
                                      const isVerlopen = taak.deadline && taak.deadline < vandaag && taak.status !== "afgerond";
                                      const isExp = expandedId === taak.id;
                                      const isClaude = taak.uitvoerder === "claude";

                                      return (
                                        <motion.div
                                          key={taak.id}
                                          initial={{ opacity: 0, x: -6 }}
                                          animate={{ opacity: taak.status === "afgerond" ? 0.4 : 1, x: 0 }}
                                          transition={{ duration: 0.18, delay: Math.min(fase.taken.indexOf(taak) * 0.03, 0.3) }}
                                          draggable
                                          onDragStart={(e) => { e.dataTransfer.setData("taakId", String(taak.id)); e.dataTransfer.effectAllowed = "move"; }}
                                          className={cn(
                                            "hover-slide-bg bg-autronis-bg/30 rounded-lg border-l-[3px] transition-colors cursor-grab active:cursor-grabbing group",
                                            taak.prioriteit === "hoog" ? "urgent-pulse" : taak.prioriteit === "normaal" ? "normaal-pulse" : "",
                                            pc.borderColor
                                          )}
                                        >
                                          <div className="flex items-center gap-2 px-3 py-1.5">
                                            <GripVertical className="w-3 h-3 text-autronis-text-secondary/20 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <button onClick={() => handleStatusToggle(taak)} className={cn("flex-shrink-0 transition-colors hover:scale-110", sc.color)} title={`Status: ${sc.label}`}>
                                              <StatusIcon className={cn("w-3.5 h-3.5", taak.status === "bezig" && "animate-spin")} />
                                            </button>
                                            <div className="flex-1 min-w-0">
                                              <p onClick={() => setSelectedTaak(taak)} className={cn("text-xs font-medium truncate cursor-pointer hover:text-autronis-accent transition-colors", taak.status === "afgerond" ? "text-autronis-text-secondary line-through" : "text-autronis-text-primary")}>{taak.titel}</p>
                                            </div>
                                            {isClaude && <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-semibold flex-shrink-0"><Bot className="w-2.5 h-2.5" />Claude</span>}
                                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0", pc.bg, pc.color)}>{pc.label}</span>
                                            {taak.deadline && <div className={cn("text-[10px] font-medium flex-shrink-0 tabular-nums", isVerlopen ? "text-red-400" : "text-autronis-text-secondary")}>{isVerlopen && <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />}{formatDatum(taak.deadline)}</div>}
                                            {/* Hover actions */}
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                              {taak.status !== "afgerond" && (
                                                <>
                                                  <button onClick={(e) => { e.stopPropagation(); handlePlanTaak(taak); }} className="p-0.5 text-autronis-text-secondary hover:text-autronis-accent transition-colors" title="Plan in agenda"><CalendarPlus className="w-3 h-3" /></button>
                                                  <button onClick={(e) => { e.stopPropagation(); handleStartTimer(taak); }} className="p-0.5 text-autronis-text-secondary hover:text-autronis-accent transition-colors" title="Start timer"><Timer className="w-3 h-3" /></button>
                                                </>
                                              )}
                                              {isClaude && taak.prompt && taak.status !== "afgerond" && <CopyPromptButton prompt={taak.prompt} />}
                                              <button onClick={() => editingId === taak.id ? setEditingId(null) : (setEditingId(taak.id), setEditFase(taak.fase ?? ""), setEditPrioriteit(taak.prioriteit))}
                                                className={cn("flex-shrink-0 p-0.5 transition-colors", editingId === taak.id ? "text-autronis-accent" : "text-autronis-text-secondary hover:text-autronis-text-primary")}><Pencil className="w-3 h-3" /></button>
                                              {(taak.omschrijving || taak.prompt || taak.projectMap) && <button onClick={() => setExpandedId(isExp ? null : taak.id)} className="flex-shrink-0 p-0.5 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">{isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</button>}
                                            </div>
                                            <div className="relative"><CheckBurst active={completedTaskId === taak.id} /></div>
                                          </div>

                                          {editingId === taak.id && (
                                            <div className="flex items-center gap-2 px-3 pb-1.5 pl-12">
                                              <input type="text" value={editFase} onChange={(e) => setEditFase(e.target.value)} placeholder="Fase..." className="bg-autronis-bg border border-autronis-border rounded-md px-2 py-1 text-xs text-autronis-text-primary w-28 focus:outline-none focus:ring-1 focus:ring-autronis-accent/50" />
                                              <select value={editPrioriteit} onChange={(e) => setEditPrioriteit(e.target.value)} className="bg-autronis-bg border border-autronis-border rounded-md px-2 py-1 text-xs text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent/50">
                                                <option value="hoog">Hoog</option><option value="normaal">Normaal</option><option value="laag">Laag</option>
                                              </select>
                                              <button onClick={() => editMutation.mutate({ id: taak.id, fase: editFase || undefined, prioriteit: editPrioriteit })} className="px-2 py-1 bg-autronis-accent text-autronis-bg rounded-md text-xs font-medium">Opslaan</button>
                                              <button onClick={() => handleDelete(taak.id)} className="px-2 py-1 bg-red-500/15 text-red-400 rounded-md text-xs font-medium hover:bg-red-500/25 transition-colors">Verwijder</button>
                                            </div>
                                          )}

                                          {isExp && (
                                            <div className="px-3 pb-1.5 pl-12 space-y-1.5">
                                              {taak.omschrijving && <p className="text-xs text-autronis-text-secondary leading-relaxed whitespace-pre-wrap">{taak.omschrijving}</p>}
                                              {isClaude && taak.prompt && (
                                                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2.5">
                                                  <div className="flex items-center gap-2 mb-1"><Terminal className="w-3 h-3 text-purple-400" /><span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Prompt</span><CopyPromptButton prompt={taak.prompt} /></div>
                                                  <pre className="text-xs text-autronis-text-primary leading-relaxed whitespace-pre-wrap font-mono">{taak.prompt}</pre>
                                                </div>
                                              )}
                                              {isClaude && taak.projectMap && (
                                                <div className="bg-autronis-bg/50 border border-autronis-border/50 rounded-lg p-2.5">
                                                  <div className="flex items-center gap-2"><FolderOpen className="w-3 h-3 text-autronis-accent" /><span className="text-[10px] font-semibold text-autronis-accent uppercase tracking-wider">Project map</span></div>
                                                  <p className="text-xs text-autronis-text-primary font-mono mt-1 select-all">{taak.projectMap}</p>
                                                </div>
                                              )}
                                              {isClaude && taak.status !== "afgerond" && (
                                                <button onClick={() => { if (taak.prompt) { navigator.clipboard.writeText(taak.prompt); addToast("Prompt gekopieerd — open Claude Code in het juiste project", "succes"); } }}
                                                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-lg text-xs font-semibold hover:bg-purple-500/20 transition-colors w-full justify-center">
                                                  <Sparkles className="w-3.5 h-3.5" /> Laat Claude dit doen
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* 4. VOORTGANG — compact onderaan */}
        <VoortgangCompact taken={taken} projecten={projectVoortgang} />

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 w-full max-w-lg mx-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-autronis-text-primary">Nieuwe taak</h2>
                <button onClick={() => setModalOpen(false)} className="p-1 text-autronis-text-secondary hover:text-autronis-text-primary"><X className="w-4 h-4" /></button>
              </div>
              <div>
                <label className="text-[10px] font-medium text-autronis-text-secondary uppercase tracking-wider mb-1.5 block">Wie voert uit?</label>
                <div className="flex gap-2">
                  <button onClick={() => setNieuwUitvoerder("claude")} className={cn("flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors border", nieuwUitvoerder === "claude" ? "bg-purple-500/15 border-purple-500/30 text-purple-400" : "border-autronis-border text-autronis-text-secondary hover:border-purple-500/30")}><Bot className="w-4 h-4" />Claude</button>
                  <button onClick={() => setNieuwUitvoerder("handmatig")} className={cn("flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors border", nieuwUitvoerder === "handmatig" ? "bg-orange-500/15 border-orange-500/30 text-orange-400" : "border-autronis-border text-autronis-text-secondary hover:border-orange-500/30")}><User className="w-4 h-4" />Handmatig</button>
                </div>
              </div>
              <input type="text" value={nieuwTitel} onChange={(e) => setNieuwTitel(e.target.value)} placeholder="Titel..." autoFocus className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50" />
              <div className="grid grid-cols-2 gap-2">
                <select value={nieuwProject} onChange={(e) => setNieuwProject(e.target.value)} className="bg-autronis-bg border border-autronis-border rounded-lg px-2 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50">
                  <option value="">Selecteer project...</option>
                  {uniekeProjecten.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
                </select>
                <input type="text" value={nieuwFase} onChange={(e) => setNieuwFase(e.target.value)} placeholder="Fase" className="bg-autronis-bg border border-autronis-border rounded-lg px-2 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={nieuwPrioriteit} onChange={(e) => setNieuwPrioriteit(e.target.value)} className="bg-autronis-bg border border-autronis-border rounded-lg px-2 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50">
                  <option value="hoog">Hoog</option><option value="normaal">Normaal</option><option value="laag">Laag</option>
                </select>
                <input type="date" value={nieuwDeadline} onChange={(e) => setNieuwDeadline(e.target.value)} className="bg-autronis-bg border border-autronis-border rounded-lg px-2 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50" />
              </div>
              <textarea value={nieuwOmschrijving} onChange={(e) => setNieuwOmschrijving(e.target.value)} placeholder="Beschrijving..." rows={2} className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 resize-none" />
              {nieuwUitvoerder === "claude" && (
                <div className="space-y-2 border-t border-purple-500/20 pt-3">
                  <div className="flex items-center gap-2"><Bot className="w-3.5 h-3.5 text-purple-400" /><span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Claude instellingen</span></div>
                  <textarea value={nieuwPrompt} onChange={(e) => setNieuwPrompt(e.target.value)} placeholder="Prompt voor Claude..." rows={3} className="w-full bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none font-mono" />
                  <select value={nieuwProjectMap} onChange={(e) => setNieuwProjectMap(e.target.value)} className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-2 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50">
                    <option value="">Selecteer project map...</option>
                    {projectMappen.map((m) => <option key={m.pad} value={m.pad}>{m.naam}</option>)}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setModalOpen(false)} className="px-3 py-1.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">Annuleren</button>
                <button onClick={handleCreate} disabled={!nieuwTitel.trim() || !nieuwProject || createMutation.isPending} className="px-4 py-1.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                  {createMutation.isPending ? "Aanmaken..." : "Taak aanmaken"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Taak detail modal */}
        {selectedTaak && (
          <TaakDetailModal
            taak={selectedTaak}
            onClose={() => setSelectedTaak(null)}
            onStatusToggle={(t) => { handleStatusToggle(t); setSelectedTaak(null); }}
            onStartTimer={handleStartTimer}
            onPlanTaak={handlePlanTaak}
            onDelete={(id) => { handleDelete(id); setSelectedTaak(null); }}
            onEdit={(id, body) => editMutation.mutate({ id, ...body })}
          />
        )}
      </div>
    </PageTransition>
  );
}
