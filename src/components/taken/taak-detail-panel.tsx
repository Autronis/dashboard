"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  Clock,
  Flag,
  Tag,
  FolderOpen,
  User,
  Bot,
  CheckCircle2,
  Circle,
  Loader2,
  Terminal,
  Copy,
  ExternalLink,
  Trash2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Taak {
  id: number;
  titel: string;
  omschrijving: string | null;
  fase: string | null;
  status: "open" | "bezig" | "afgerond" | null;
  prioriteit: "laag" | "normaal" | "hoog" | null;
  deadline: string | null;
  uitvoerder: "claude" | "handmatig" | null;
  prompt: string | null;
  projectId: number | null;
  projectNaam: string | null;
  projectMap: string | null;
  ingeplandStart: string | null;
  ingeplandEind: string | null;
  geschatteDuur: number | null;
  aangemaaktOp: string | null;
  bijgewerktOp: string | null;
}

interface Props {
  taakId: number | null;
  onClose: () => void;
}

function formatDatum(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDatumTijd(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle; classes: string }> = {
  open: { label: "Open", icon: Circle, classes: "text-slate-400 bg-slate-500/15 border-slate-500/30" },
  bezig: { label: "Bezig", icon: Loader2, classes: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
  afgerond: { label: "Afgerond", icon: CheckCircle2, classes: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
};

const PRIORITEIT_CONFIG: Record<string, { label: string; classes: string }> = {
  hoog: { label: "Hoog", classes: "text-red-400 bg-red-500/15 border-red-500/30" },
  normaal: { label: "Normaal", classes: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30" },
  laag: { label: "Laag", classes: "text-slate-400 bg-slate-500/15 border-slate-500/30" },
};

export function TaakDetailPanel({ taakId, onClose }: Props) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [bewerkOmschrijving, setBewerkOmschrijving] = useState(false);
  const [omschrijvingDraft, setOmschrijvingDraft] = useState("");

  const { data, isLoading } = useQuery<{ taak: Taak }>({
    queryKey: ["taak-detail", taakId],
    queryFn: async () => {
      const res = await fetch(`/api/taken?id=${taakId}`);
      if (!res.ok) {
        // Fallback: fetch via full list
        const listRes = await fetch("/api/taken");
        const listData = await listRes.json();
        const taak = (listData.taken ?? []).find((t: Taak) => t.id === taakId);
        if (!taak) throw new Error("Taak niet gevonden");
        return { taak };
      }
      const listData = await res.json();
      const taak = (listData.taken ?? []).find((t: Taak) => t.id === taakId);
      if (!taak) throw new Error("Taak niet gevonden");
      return { taak };
    },
    enabled: taakId !== null,
    staleTime: 10_000,
  });

  const taak = data?.taak;

  // Reset omschrijving draft when taak changes
  useEffect(() => {
    if (taak) {
      setOmschrijvingDraft(taak.omschrijving ?? "");
      setBewerkOmschrijving(false);
    }
  }, [taak]);

  const updateMutation = useMutation({
    mutationFn: async (body: Partial<Taak>) => {
      const res = await fetch(`/api/taken/${taakId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout ?? "Kon taak niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taak-detail", taakId] });
      queryClient.invalidateQueries({ queryKey: ["taken"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      addToast("Bijgewerkt", "succes");
    },
    onError: (err: Error) => addToast(err.message, "fout"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/taken/${taakId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kon taak niet verwijderen");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taken"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      addToast("Taak verwijderd", "succes");
      onClose();
    },
    onError: (err: Error) => addToast(err.message, "fout"),
  });

  const copyPrompt = () => {
    if (!taak?.prompt) return;
    navigator.clipboard.writeText(taak.prompt);
    addToast("Prompt gekopieerd", "succes");
  };

  const handleStatusToggle = (newStatus: "open" | "bezig" | "afgerond") => {
    updateMutation.mutate({ status: newStatus });
  };

  const handlePrioriteitToggle = (newPrio: "laag" | "normaal" | "hoog") => {
    updateMutation.mutate({ prioriteit: newPrio });
  };

  const saveOmschrijving = () => {
    updateMutation.mutate({ omschrijving: omschrijvingDraft || null });
    setBewerkOmschrijving(false);
  };

  return (
    <AnimatePresence>
      {taakId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Centered modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="relative w-full max-w-3xl max-h-[90vh] bg-autronis-card border border-autronis-border rounded-2xl shadow-2xl overflow-y-auto"
          >
            {isLoading && (
              <div className="p-6">
                <div className="h-6 w-40 bg-autronis-bg rounded animate-pulse mb-4" />
                <div className="h-24 bg-autronis-bg rounded animate-pulse" />
              </div>
            )}

            {!isLoading && !taak && (
              <div className="p-6 text-center text-autronis-text-secondary">
                <p>Taak niet gevonden</p>
                <button onClick={onClose} className="mt-4 text-sm text-autronis-accent hover:underline">
                  Sluiten
                </button>
              </div>
            )}

            {taak && (
              <div className="p-6 lg:p-8 space-y-6">
                {/* Header — met wrap-enabled titel */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide mb-1.5">Taak</p>
                    <h2 className="text-2xl lg:text-3xl font-bold text-autronis-text-primary leading-tight break-words">
                      {taak.titel}
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg transition-colors shrink-0"
                    aria-label="Sluiten"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Project + fase */}
                {(taak.projectNaam || taak.fase) && (
                  <div className="flex items-center gap-2 text-xs">
                    {taak.projectNaam && (
                      <Link
                        href={`/projecten/${taak.projectId}`}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-autronis-accent/10 text-autronis-accent rounded-lg hover:bg-autronis-accent/20 transition-colors"
                      >
                        <FolderOpen className="w-3 h-3" />
                        {taak.projectNaam}
                      </Link>
                    )}
                    {taak.fase && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-autronis-bg text-autronis-text-secondary rounded-lg">
                        <Tag className="w-3 h-3" />
                        {taak.fase}
                      </span>
                    )}
                  </div>
                )}

                {/* Status + Prioriteit toggles */}
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide mb-2">Status</p>
                    <div className="flex gap-2">
                      {(["open", "bezig", "afgerond"] as const).map((s) => {
                        const cfg = STATUS_CONFIG[s];
                        const Icon = cfg.icon;
                        const active = taak.status === s;
                        return (
                          <button
                            key={s}
                            onClick={() => handleStatusToggle(s)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition",
                              active ? cfg.classes : "border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/40"
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide mb-2">Prioriteit</p>
                    <div className="flex gap-2">
                      {(["laag", "normaal", "hoog"] as const).map((p) => {
                        const cfg = PRIORITEIT_CONFIG[p];
                        const active = taak.prioriteit === p;
                        return (
                          <button
                            key={p}
                            onClick={() => handlePrioriteitToggle(p)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition",
                              active ? cfg.classes : "border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/40"
                            )}
                          >
                            <Flag className="w-3 h-3" />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Omschrijving / stappen */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide flex items-center gap-1.5">
                      <FileText className="w-3 h-3" />
                      Omschrijving / stappen
                    </p>
                    {!bewerkOmschrijving && (
                      <button
                        onClick={() => setBewerkOmschrijving(true)}
                        className="text-xs text-autronis-accent hover:underline"
                      >
                        {taak.omschrijving ? "Bewerken" : "Toevoegen"}
                      </button>
                    )}
                  </div>
                  {bewerkOmschrijving ? (
                    <div className="space-y-2">
                      <textarea
                        value={omschrijvingDraft}
                        onChange={(e) => setOmschrijvingDraft(e.target.value)}
                        placeholder="Stappen, context, acceptatiecriteria..."
                        className="w-full min-h-[120px] bg-autronis-bg border border-autronis-border rounded-lg p-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 font-mono"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setOmschrijvingDraft(taak.omschrijving ?? "");
                            setBewerkOmschrijving(false);
                          }}
                          className="px-3 py-1.5 text-xs text-autronis-text-secondary hover:text-autronis-text-primary"
                        >
                          Annuleren
                        </button>
                        <button
                          onClick={saveOmschrijving}
                          className="px-3 py-1.5 bg-autronis-accent text-autronis-bg rounded-lg text-xs font-medium hover:bg-autronis-accent/90"
                        >
                          Opslaan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-autronis-bg rounded-lg p-3 text-sm text-autronis-text-primary whitespace-pre-wrap font-mono min-h-[60px]">
                      {taak.omschrijving || (
                        <span className="text-autronis-text-secondary/50 italic">Nog geen omschrijving</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Claude prompt */}
                {taak.uitvoerder === "claude" && taak.prompt && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide flex items-center gap-1.5">
                        <Terminal className="w-3 h-3" />
                        Claude prompt
                      </p>
                      <button
                        onClick={copyPrompt}
                        className="flex items-center gap-1 text-xs text-autronis-accent hover:underline"
                      >
                        <Copy className="w-3 h-3" />
                        Kopieer
                      </button>
                    </div>
                    <div className="bg-autronis-bg border border-purple-500/20 rounded-lg p-3 text-xs text-autronis-text-primary whitespace-pre-wrap font-mono">
                      {taak.prompt}
                    </div>
                  </div>
                )}

                {/* Meta info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-autronis-bg rounded-lg p-3">
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Deadline
                    </p>
                    <p className="text-autronis-text-primary">{formatDatum(taak.deadline)}</p>
                  </div>
                  <div className="bg-autronis-bg rounded-lg p-3">
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Ingepland
                    </p>
                    <p className="text-autronis-text-primary">{formatDatumTijd(taak.ingeplandStart)}</p>
                  </div>
                  <div className="bg-autronis-bg rounded-lg p-3">
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide mb-1 flex items-center gap-1">
                      {taak.uitvoerder === "claude" ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      Uitvoerder
                    </p>
                    <p className="text-autronis-text-primary capitalize">{taak.uitvoerder ?? "handmatig"}</p>
                  </div>
                  <div className="bg-autronis-bg rounded-lg p-3">
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Geschatte duur
                    </p>
                    <p className="text-autronis-text-primary">{taak.geschatteDuur ? `${taak.geschatteDuur} min` : "—"}</p>
                  </div>
                </div>

                {/* Actions footer */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-autronis-border/30">
                  <button
                    onClick={() => {
                      if (confirm(`Taak "${taak.titel}" verwijderen?`)) {
                        deleteMutation.mutate();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Verwijder
                  </button>
                  <Link
                    href={`/taken?highlight=${taak.id}`}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-autronis-accent hover:bg-autronis-accent/10 rounded-lg transition-colors"
                  >
                    Open in Taken
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
