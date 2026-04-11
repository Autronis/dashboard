"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PenLine, Loader2, Bot, ArrowRight, Lightbulb, Trash2, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateIdee,
  useDeleteIdee,
  useUpdateIdee,
  useVerwerkNotitie,
  type Idee,
  type VerwerkSuggestie,
} from "@/hooks/queries/use-ideeen";
import { useProjecten } from "@/hooks/queries/use-projecten";

interface CaptureTabProps {
  ideeen: Idee[];
}

export function CaptureTab({ ideeen }: CaptureTabProps) {
  const { addToast } = useToast();
  const createMutation = useCreateIdee();
  const deleteMutation = useDeleteIdee();
  const updateMutation = useUpdateIdee();
  const verwerkMutation = useVerwerkNotitie();
  const { data: projectenLijst = [] } = useProjecten();

  const [inzichtInput, setInzichtInput] = useState("");
  const [verwerkResult, setVerwerkResult] = useState<{ notitieId: number; suggestie: VerwerkSuggestie } | null>(null);
  const [koppelNotitieId, setKoppelNotitieId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const inzichtIdeeen = ideeen
    .filter((i) => i.categorie === "inzicht")
    .sort((a, b) => b.aangemaaktOp.localeCompare(a.aangemaaktOp));

  const handleSaveInzicht = useCallback(() => {
    const tekst = inzichtInput.trim();
    if (!tekst) return;
    const naam = tekst.length > 60 ? tekst.slice(0, 57) + "..." : tekst;
    createMutation.mutate(
      { naam, omschrijving: tekst.length > 60 ? tekst : null, categorie: "inzicht", status: "idee", prioriteit: "normaal" },
      {
        onSuccess: () => { setInzichtInput(""); inputRef.current?.focus(); },
        onError: () => addToast("Kon inzicht niet opslaan", "fout"),
      }
    );
  }, [inzichtInput, createMutation, addToast]);

  return (
    <div className="space-y-4">
      {/* Quick capture */}
      <div className="bg-autronis-card border border-amber-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={inzichtInput}
            onChange={(e) => setInzichtInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveInzicht(); }}
            placeholder="Typ een inzicht of notitie..."
            className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-amber-500/50"
            autoFocus
          />
          <button
            onClick={handleSaveInzicht}
            disabled={!inzichtInput.trim() || createMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-autronis-text-secondary/50 mt-2 ml-1">Enter om op te slaan · Eerste 60 tekens worden de titel</p>
      </div>

      {/* Verwerk suggestie panel */}
      <AnimatePresence>
        {verwerkResult && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-autronis-card border border-autronis-accent/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-autronis-accent" />
                <span className="text-sm font-medium text-autronis-text-primary">AI Suggestie</span>
              </div>
              <button onClick={() => setVerwerkResult(null)} className="text-autronis-text-secondary/40 hover:text-autronis-text-primary"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-autronis-text-secondary">{verwerkResult.suggestie.reden}</p>
            <div className="flex gap-2">
              {verwerkResult.suggestie.project.id && (
                <button
                  onClick={async () => {
                    const s = verwerkResult.suggestie;
                    const res = await fetch("/api/taken", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ projectId: s.project.id, titel: s.project.taakTitel }),
                      redirect: "error",
                    }).catch(() => null);
                    if (!res || !res.ok) {
                      addToast("Fout bij toevoegen taak", "fout");
                      return;
                    }
                    deleteMutation.mutate(verwerkResult.notitieId);
                    setVerwerkResult(null);
                    addToast(`Taak toegevoegd aan ${s.project.naam}`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg text-xs font-medium transition-colors"
                >
                  <ArrowRight className="w-3 h-3" />
                  Koppel aan {verwerkResult.suggestie.project.naam}
                </button>
              )}
              <button
                onClick={() => {
                  const s = verwerkResult.suggestie;
                  updateMutation.mutate({ id: verwerkResult.notitieId, body: {
                    naam: s.idee.naam,
                    omschrijving: s.idee.omschrijving,
                    categorie: s.idee.categorie,
                    prioriteit: s.idee.prioriteit,
                  }});
                  setVerwerkResult(null);
                  addToast(`Omgezet naar idee: ${s.idee.naam}`);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 rounded-lg text-xs font-medium transition-colors"
              >
                <Lightbulb className="w-3 h-3" />
                Maak idee ({verwerkResult.suggestie.idee.categorie.replace("_", "/")})
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inzichten lijst */}
      {inzichtIdeeen.length === 0 ? (
        <div className="text-center py-12">
          <PenLine className="w-10 h-10 text-autronis-text-secondary/20 mx-auto mb-3" />
          <p className="text-sm text-autronis-text-secondary">Nog geen inzichten — typ hierboven om te beginnen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inzichtIdeeen.map((inzicht, i) => {
            const datum = new Date(inzicht.aangemaaktOp);
            const datumStr = datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: datum.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
            const isVerwerken = verwerkMutation.isPending && verwerkMutation.variables === inzicht.id;
            return (
              <motion.div key={inzicht.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: i * 0.04 }} className="group bg-autronis-card border border-autronis-border hover:border-amber-500/30 rounded-xl px-4 py-3 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-autronis-text-primary">{inzicht.omschrijving || inzicht.naam}</p>
                    {inzicht.omschrijving && inzicht.naam !== inzicht.omschrijving.slice(0, 60) && (
                      <p className="text-xs text-amber-400/70 mt-0.5">{inzicht.naam}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[11px] text-autronis-text-secondary/50 mr-1">{datumStr}</span>
                    {/* AI Verwerk knop */}
                    <button
                      onClick={async () => {
                        const result = await verwerkMutation.mutateAsync(inzicht.id);
                        setVerwerkResult({ notitieId: inzicht.id, suggestie: result.suggestie });
                      }}
                      disabled={isVerwerken}
                      title="AI verwerkt deze notitie"
                      className="p-1.5 rounded-lg bg-autronis-accent/10 text-autronis-accent/70 hover:bg-autronis-accent/25 hover:text-autronis-accent transition-colors"
                    >
                      {isVerwerken ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                    </button>
                    {/* Koppel aan project knop */}
                    <div className="relative">
                      <button
                        onClick={() => setKoppelNotitieId(koppelNotitieId === inzicht.id ? null : inzicht.id)}
                        title="Koppel aan project"
                        className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400/70 hover:bg-blue-500/25 hover:text-blue-400 transition-colors"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      {koppelNotitieId === inzicht.id && (
                        <div className="absolute right-0 top-8 z-50 w-56 bg-autronis-card border border-autronis-border rounded-xl shadow-xl py-1 max-h-48 overflow-y-auto">
                          {projectenLijst.filter((p) => p.status === "actief").map((project) => (
                            <button
                              key={project.id}
                              onClick={async () => {
                                const titel = (inzicht.naam.length > 60 ? inzicht.naam.slice(0, 57) + "..." : inzicht.naam);
                                const res = await fetch("/api/taken", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ projectId: project.id, titel }),
                                  redirect: "error",
                                }).catch(() => null);
                                if (!res || !res.ok) {
                                  addToast("Fout bij toevoegen taak", "fout");
                                  setKoppelNotitieId(null);
                                  return;
                                }
                                deleteMutation.mutate(inzicht.id);
                                setKoppelNotitieId(null);
                                addToast(`Taak toegevoegd aan ${project.naam}`);
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-autronis-text-primary hover:bg-autronis-accent/10 transition-colors"
                            >
                              {project.naam}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Maak idee knop */}
                    <button
                      onClick={() => {
                        updateMutation.mutate({ id: inzicht.id, body: {
                          naam: inzicht.naam,
                          omschrijving: inzicht.omschrijving || inzicht.naam,
                          categorie: "experimenteel",
                          prioriteit: "normaal",
                        }});
                        addToast("Omgezet naar idee");
                      }}
                      title="Maak idee"
                      className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400/70 hover:bg-amber-500/25 hover:text-amber-400 transition-colors"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                    </button>
                    {/* Verwijder */}
                    <button
                      onClick={() => deleteMutation.mutate(inzicht.id)}
                      title="Verwijderen"
                      className={cn("p-1.5 rounded-lg bg-red-500/10 text-red-400/70 hover:bg-red-500/25 hover:text-red-400 transition-colors")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
