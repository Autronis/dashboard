"use client";

import { useState, useCallback } from "react";
import { Search, Loader2, Brain, FileText, Link2, Image as ImageIcon, FileDown, Code, Sparkles } from "lucide-react";
import { useAiZoeken, type SecondBrainItem } from "@/hooks/queries/use-second-brain";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AiZoekenTabProps {
  onSelectItem: (item: SecondBrainItem) => void;
}

const typeIcons: Record<string, typeof FileText> = {
  tekst: FileText,
  url: Link2,
  afbeelding: ImageIcon,
  pdf: FileDown,
  code: Code,
};

interface QaPaar {
  vraag: string;
  antwoord: string;
  bronnen: { id: number; titel: string; type: string }[];
}

const suggesties = [
  "Wat weet ik over webhooks?",
  "Welke tools heb ik opgeslagen?",
  "Samenvatting van mijn laatste notities",
];

export function AiZoekenTab({ onSelectItem }: AiZoekenTabProps) {
  const { addToast } = useToast();
  const [vraag, setVraag] = useState("");
  const [geschiedenis, setGeschiedenis] = useState<QaPaar[]>([]);
  const zoekMutation = useAiZoeken();

  const handleZoek = useCallback(
    (input?: string) => {
      const q = (input ?? vraag).trim();
      if (!q) return;
      // Send last 3 Q&A pairs as conversation history
      const recentGeschiedenis = geschiedenis.slice(-3).map((qa) => ({
        vraag: qa.vraag,
        antwoord: qa.antwoord,
      }));
      zoekMutation.mutate({ vraag: q, geschiedenis: recentGeschiedenis }, {
        onSuccess: (data) => {
          const cleanAntwoord = data.antwoord
            .replace(/\[ID:\d+\]/g, "")
            .replace(/\s{2,}/g, " ")
            .trim();
          setGeschiedenis((prev) => [
            ...prev,
            { vraag: q, antwoord: cleanAntwoord, bronnen: data.bronnen },
          ]);
          setVraag("");
        },
        onError: () => addToast("Zoeken mislukt", "fout"),
      });
    },
    [vraag, geschiedenis, zoekMutation, addToast]
  );

  const handleBronClick = useCallback(
    async (bronId: number) => {
      try {
        const res = await fetch(`/api/second-brain/${bronId}`);
        if (!res.ok) throw new Error("Kon item niet laden");
        const data = (await res.json()) as { item: SecondBrainItem };
        onSelectItem(data.item);
      } catch {
        addToast("Kon item niet openen", "fout");
      }
    },
    [onSelectItem, addToast]
  );

  // Collect related items from the last response's bronnen (shared tags concept)
  const laatsteBronnen = geschiedenis.length > 0
    ? geschiedenis[geschiedenis.length - 1].bronnen
    : [];
  const gerelateerd = laatsteBronnen.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Previous Q&A pairs */}
      {geschiedenis.length > 0 && (
        <div className="space-y-4">
          {geschiedenis.map((qa, i) => (
            <div key={i} className="space-y-3">
              {/* Question */}
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-autronis-accent/10 shrink-0 mt-0.5">
                  <Search className="w-3.5 h-3.5 text-autronis-accent" />
                </div>
                <p className="text-autronis-text-primary font-medium pt-1">{qa.vraag}</p>
              </div>

              {/* Answer */}
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 ml-10">
                <p className="text-autronis-text-primary whitespace-pre-wrap leading-relaxed">
                  {qa.antwoord}
                </p>
              </div>

              {/* Sources */}
              {qa.bronnen.length > 0 && (
                <div className="ml-10">
                  <h4 className="text-autronis-text-secondary text-xs font-medium mb-2 uppercase tracking-wide">
                    Bronnen
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    {qa.bronnen.map((bron) => {
                      const TypeIcon = typeIcons[bron.type] ?? FileText;
                      return (
                        <button
                          key={bron.id}
                          type="button"
                          onClick={() => handleBronClick(bron.id)}
                          className="bg-autronis-card border border-autronis-border rounded-xl px-3 py-2 hover:border-autronis-accent/30 transition-colors flex items-center gap-2"
                        >
                          <TypeIcon className="w-3.5 h-3.5 text-autronis-text-secondary" />
                          <span className="text-sm text-autronis-text-primary whitespace-nowrap">
                            {bron.titel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Related items section after last answer */}
          {gerelateerd.length > 0 && !zoekMutation.isPending && (
            <div className="ml-10">
              <h4 className="text-autronis-text-secondary text-xs font-medium mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Gerelateerd
              </h4>
              <div className="flex gap-2 flex-wrap">
                {gerelateerd.map((item) => {
                  const TypeIcon = typeIcons[item.type] ?? FileText;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleBronClick(item.id)}
                      className="bg-autronis-accent/5 border border-autronis-accent/15 rounded-xl px-3 py-2 hover:border-autronis-accent/30 transition-colors flex items-center gap-2"
                    >
                      <TypeIcon className="w-3.5 h-3.5 text-autronis-accent" />
                      <span className="text-sm text-autronis-accent">
                        {item.titel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {zoekMutation.isPending && (
        <div className="flex items-center gap-3 text-autronis-text-secondary px-1">
          <Loader2 className="w-4 h-4 animate-spin text-autronis-accent" />
          <span className="text-sm">Even denken...</span>
        </div>
      )}

      {/* Search input — larger */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 flex items-center gap-3">
        <Search className="w-6 h-6 text-autronis-text-secondary shrink-0" />
        <input
          className="flex-1 bg-transparent text-xl text-autronis-text-primary placeholder:text-autronis-text-secondary/50 outline-none"
          placeholder={geschiedenis.length > 0 ? "Stel een vervolgvraag..." : "Stel een vraag over je opgeslagen kennis..."}
          value={vraag}
          onChange={(e) => setVraag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !zoekMutation.isPending && handleZoek()}
        />
        <button
          type="button"
          onClick={() => handleZoek()}
          disabled={zoekMutation.isPending || !vraag.trim()}
          className="disabled:opacity-40 transition-opacity"
          aria-label="Zoeken"
        >
          {zoekMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-autronis-accent" />
          ) : (
            <Brain className="w-6 h-6 text-autronis-accent" />
          )}
        </button>
      </div>

      {/* Suggested questions — always visible */}
      {!zoekMutation.isPending && (
        <div className="flex flex-wrap gap-2">
          {suggesties.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setVraag(s);
                handleZoek(s);
              }}
              className={cn(
                "bg-autronis-card border border-autronis-border rounded-xl px-3 py-2",
                "text-xs text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/30 transition-colors"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
