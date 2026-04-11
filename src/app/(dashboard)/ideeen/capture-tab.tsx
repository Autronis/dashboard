"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Mic,
  TrendingUp,
  Sparkles,
  Trash2,
  ArrowRight,
  Loader2,
  Radio,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateIdee,
  useDeleteIdee,
  useUpdateIdee,
  useGenereerIdeeen,
} from "@/hooks/queries/use-ideeen";
import type { Idee } from "@/hooks/queries/use-ideeen";

// ============ TYPES ============

interface CaptureTabProps {
  ideeen: Idee[];
}

// ============ CONSTANTS ============

const bronIcons: Record<string, { icon: typeof Mic; label: string; color: string }> = {
  meeting: { icon: Mic, label: "Meeting", color: "text-blue-400 bg-blue-400/10" },
  lead: { icon: TrendingUp, label: "Lead", color: "text-emerald-400 bg-emerald-400/10" },
  radar: { icon: Radio, label: "Radar", color: "text-purple-400 bg-purple-400/10" },
};

const bronType = (bron: string): string => bron.split(":")[0];

// ============ COMPONENT ============

export function CaptureTab({ ideeen: alleIdeeen }: CaptureTabProps) {
  const [input, setInput] = useState("");
  const { addToast } = useToast();

  const createMutation = useCreateIdee();
  const deleteMutation = useDeleteIdee();
  const updateMutation = useUpdateIdee();
  const genereerMutation = useGenereerIdeeen();

  const autoCaptures = useMemo(
    () =>
      alleIdeeen
        .filter((i) => i.categorie === "inzicht" && i.bron !== null)
        .sort(
          (a, b) =>
            new Date(b.aangemaaktOp).getTime() - new Date(a.aangemaaktOp).getTime()
        ),
    [alleIdeeen]
  );

  const handmatig = useMemo(
    () =>
      alleIdeeen
        .filter((i) => i.categorie === "inzicht" && i.bron === null)
        .sort(
          (a, b) =>
            new Date(b.aangemaaktOp).getTime() - new Date(a.aangemaaktOp).getTime()
        ),
    [alleIdeeen]
  );

  const handleSubmit = useCallback(async () => {
    const naam = input.trim();
    if (!naam) return;
    try {
      await createMutation.mutateAsync({ naam, categorie: "inzicht", status: "idee" });
      setInput("");
      addToast("Vastgelegd", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Vastleggen mislukt", "fout");
    }
  }, [input, createMutation, addToast]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSubmit();
    },
    [handleSubmit]
  );

  const handleGenereer = useCallback(async () => {
    try {
      await genereerMutation.mutateAsync();
      addToast("Ideeën gegenereerd", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Genereren mislukt", "fout");
    }
  }, [genereerMutation, addToast]);

  const handlePromoveer = useCallback(
    async (idee: Idee) => {
      try {
        await updateMutation.mutateAsync({
          id: idee.id,
          body: { categorie: "experimenteel", isAiSuggestie: 0, gepromoveerd: 1 },
        });
        addToast(`"${idee.naam}" naar backlog`, "succes");
      } catch (err) {
        addToast(err instanceof Error ? err.message : "Promoveren mislukt", "fout");
      }
    },
    [updateMutation, addToast]
  );

  const handleDelete = useCallback(
    async (idee: Idee) => {
      try {
        await deleteMutation.mutateAsync(idee.id);
        addToast("Verwijderd", "succes");
      } catch (err) {
        addToast(err instanceof Error ? err.message : "Verwijderen mislukt", "fout");
      }
    },
    [deleteMutation, addToast]
  );

  const isEmpty = autoCaptures.length === 0 && handmatig.length === 0;

  return (
    <div className="space-y-6">
      {/* Quick input */}
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Snel vastleggen…"
          className="flex-1 bg-[#192225] border border-[#2A3538] rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-autronis-accent transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={createMutation.isPending || !input.trim()}
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all",
            "bg-autronis-accent text-white hover:bg-autronis-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {createMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Vastleggen
        </button>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenereer}
        disabled={genereerMutation.isPending}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all border",
          "border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        {genereerMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        AI: Genereer ideeën
      </button>

      {/* Auto-capture feed */}
      {autoCaptures.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white/70">Automatisch gevangen</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-autronis-accent/10 text-autronis-accent font-medium">
              {autoCaptures.length}
            </span>
          </div>
          <div className="space-y-2">
            {autoCaptures.map((idee) => {
              const type = bronType(idee.bron!);
              const meta = bronIcons[type] ?? bronIcons["meeting"];
              const BronIcon = meta.icon;

              return (
                <motion.div
                  key={idee.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 bg-[#192225] border border-[#2A3538] rounded-xl p-4 group"
                >
                  {/* Bron icon */}
                  <div
                    className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                      meta.color
                    )}
                  >
                    <BronIcon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{idee.naam}</p>
                    {idee.bronTekst && (
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-2 italic">
                        &ldquo;{idee.bronTekst}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-white/30 mt-1">{formatDatum(idee.aangemaaktOp)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handlePromoveer(idee)}
                      disabled={updateMutation.isPending}
                      title="Naar backlog"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-autronis-accent/10 text-autronis-accent hover:bg-autronis-accent/20 disabled:opacity-40 transition-colors"
                    >
                      Backlog
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(idee)}
                      disabled={deleteMutation.isPending}
                      title="Verwijderen"
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Manual notes */}
      {handmatig.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white/70">Handmatig vastgelegd</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40 font-medium">
              {handmatig.length}
            </span>
          </div>
          <div className="space-y-2">
            {handmatig.map((idee) => (
              <motion.div
                key={idee.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 bg-[#192225] border border-[#2A3538] rounded-xl px-4 py-3 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{idee.naam}</p>
                  <p className="text-xs text-white/30 mt-0.5">{formatDatum(idee.aangemaaktOp)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handlePromoveer(idee)}
                    disabled={updateMutation.isPending}
                    title="Naar backlog"
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-autronis-accent/10 text-autronis-accent hover:bg-autronis-accent/20 disabled:opacity-40 transition-colors"
                  >
                    Backlog
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(idee)}
                    disabled={deleteMutation.isPending}
                    title="Verwijderen"
                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-autronis-accent/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-autronis-accent" />
          </div>
          <div>
            <p className="text-white/60 font-medium">Nog geen captures</p>
            <p className="text-sm text-white/30 mt-1">
              Leg snel een inzicht vast of laat AI ideeën genereren.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
