"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "./confidence-badge";
import { PipelineBar } from "./pipeline-bar";
import { IdeeDetailPanel } from "./idee-detail-panel";
import type { Idee } from "@/hooks/queries/use-ideeen";

// ============ CONSTANTS ============

const categorieLabels: Record<string, string> = {
  dashboard: "Dashboard",
  klant_verkoop: "Klant & Verkoop",
  intern: "Intern",
  dev_tools: "Dev Tools",
  content_media: "Content & Media",
  geld_groei: "Geld & Groei",
  experimenteel: "Experimenteel",
  website: "Website",
};

const statusOpties = [
  { key: "idee", label: "Idee" },
  { key: "uitgewerkt", label: "Uitgewerkt" },
  { key: "actief", label: "Actief" },
  { key: "gebouwd", label: "Gebouwd" },
] as const;

// ============ TYPES ============

interface ConfidenceBreakdown {
  samenvatting: string;
}

interface DecideTabProps {
  ideeen: Idee[];
  onDaanSpar: (idee: Idee) => void;
}

// ============ HELPERS ============

function parseBreakdown(raw: string | null): ConfidenceBreakdown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConfidenceBreakdown;
  } catch {
    return null;
  }
}

// ============ COMPONENT ============

export function DecideTab({ ideeen, onDaanSpar }: DecideTabProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zoek, setZoek] = useState("");
  const [filterCategorie, setFilterCategorie] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"confidence" | "nieuwste" | "categorie">("confidence");

  // Exclude inzicht from backlog
  const backlogIdeeen = useMemo(
    () => ideeen.filter((i) => i.categorie !== "inzicht"),
    [ideeen]
  );

  // Top 3: not geparkeerd, status idee or uitgewerkt, sorted by aiScore desc
  const top3 = useMemo(
    () =>
      backlogIdeeen
        .filter(
          (i) =>
            !i.geparkeerd &&
            (i.status === "idee" || i.status === "uitgewerkt")
        )
        .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))
        .slice(0, 3),
    [backlogIdeeen]
  );

  const top3Ids = useMemo(() => new Set(top3.map((i) => i.id)), [top3]);

  // Parkeerplaats: everything not in top3, filtered and sorted
  const parkeerplaats = useMemo(() => {
    let result = backlogIdeeen.filter((i) => !top3Ids.has(i.id));

    if (zoek.trim()) {
      const q = zoek.toLowerCase();
      result = result.filter(
        (i) =>
          i.naam.toLowerCase().includes(q) ||
          (i.omschrijving ?? "").toLowerCase().includes(q)
      );
    }

    if (filterCategorie) {
      result = result.filter((i) => i.categorie === filterCategorie);
    }

    if (filterStatus) {
      result = result.filter((i) => i.status === filterStatus);
    }

    switch (sortBy) {
      case "confidence":
        result = [...result].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));
        break;
      case "nieuwste":
        result = [...result].sort(
          (a, b) =>
            new Date(b.aangemaaktOp).getTime() - new Date(a.aangemaaktOp).getTime()
        );
        break;
      case "categorie":
        result = [...result].sort((a, b) =>
          (a.categorie ?? "").localeCompare(b.categorie ?? "")
        );
        break;
    }

    return result;
  }, [backlogIdeeen, top3Ids, zoek, filterCategorie, filterStatus, sortBy]);

  const selectedIdee = ideeen.find((i) => i.id === selectedId);

  return (
    <div className="flex gap-6">
      {/* Left: main content */}
      <div className={cn("flex-1 space-y-6 min-w-0", selectedIdee && "max-w-[60%]")}>

        {/* Hero top 3 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-autronis-accent" />
            <h2 className="text-sm font-semibold text-autronis-text-primary">
              Bouw dit als eerste
            </h2>
          </div>

          {top3.length === 0 ? (
            <p className="text-sm text-autronis-text-secondary">
              Geen ideeën beschikbaar voor de top 3.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {top3.map((idee, idx) => {
                const breakdown = parseBreakdown(idee.confidenceBreakdown);
                const isSelected = selectedId === idee.id;

                return (
                  <motion.div
                    key={idee.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => setSelectedId(isSelected ? null : idee.id)}
                    className={cn(
                      "relative flex flex-col gap-3 p-4 rounded-2xl cursor-pointer transition-all",
                      "bg-gradient-to-br from-autronis-card to-autronis-bg",
                      "border border-autronis-border hover:card-glow",
                      isSelected && "border-autronis-accent"
                    )}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <ConfidenceBadge score={idee.aiScore} size="lg" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(idee.id);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-autronis-accent/10 text-autronis-accent text-xs font-medium hover:bg-autronis-accent/20 transition-colors shrink-0"
                      >
                        <Play size={11} />
                        Start
                      </button>
                    </div>

                    {/* Naam */}
                    <p className="text-sm font-semibold text-autronis-text-primary line-clamp-2 leading-snug">
                      {idee.naam}
                    </p>

                    {/* Omschrijving */}
                    {idee.omschrijving && (
                      <p className="text-xs text-autronis-text-secondary line-clamp-2 leading-relaxed">
                        {idee.omschrijving}
                      </p>
                    )}

                    {/* Samenvatting from breakdown */}
                    {breakdown?.samenvatting && (
                      <p className="text-xs text-autronis-text-secondary/70 line-clamp-2 italic border-t border-autronis-border/50 pt-2">
                        {breakdown.samenvatting}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pipeline mini-bar */}
        <PipelineBar ideeen={ideeen} />

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-autronis-text-secondary pointer-events-none" />
            <input
              type="text"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoeken…"
              className="pl-8 pr-3 py-1.5 text-sm bg-autronis-card border border-autronis-border rounded-xl text-autronis-text-primary placeholder:text-autronis-text-secondary/60 focus:outline-none focus:border-autronis-accent w-44"
            />
          </div>

          {/* Categorie dropdown */}
          <select
            value={filterCategorie ?? ""}
            onChange={(e) => setFilterCategorie(e.target.value || null)}
            className="px-3 py-1.5 text-sm bg-autronis-card border border-autronis-border rounded-xl text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
          >
            <option value="">Alle categorieën</option>
            {Object.entries(categorieLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* Status pills */}
          <div className="flex gap-1">
            {statusOpties.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(filterStatus === key ? null : key)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                  filterStatus === key
                    ? "bg-autronis-accent text-autronis-bg"
                    : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "confidence" | "nieuwste" | "categorie")}
            className="px-3 py-1.5 text-sm bg-autronis-card border border-autronis-border rounded-xl text-autronis-text-primary focus:outline-none focus:border-autronis-accent ml-auto"
          >
            <option value="confidence">Confidence</option>
            <option value="nieuwste">Nieuwste</option>
            <option value="categorie">Categorie</option>
          </select>
        </div>

        {/* Parkeerplaats grid */}
        {parkeerplaats.length === 0 ? (
          <p className="text-sm text-autronis-text-secondary">Geen ideeën gevonden.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {parkeerplaats.map((idee) => {
              const isSelected = selectedId === idee.id;
              const isGeparkeerd = Boolean(idee.geparkeerd);

              return (
                <button
                  key={idee.id}
                  onClick={() => setSelectedId(isSelected ? null : idee.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all",
                    "bg-autronis-card border hover:card-glow",
                    isSelected
                      ? "border-autronis-accent"
                      : "border-autronis-border",
                    isGeparkeerd && "opacity-60"
                  )}
                >
                  <ConfidenceBadge score={idee.aiScore} size="sm" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-autronis-text-primary truncate">
                      {idee.naam}
                    </p>
                    {idee.categorie && categorieLabels[idee.categorie] && (
                      <p className="text-xs text-autronis-text-secondary truncate">
                        {categorieLabels[idee.categorie]}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      <AnimatePresence>
        {selectedIdee && (
          <motion.div
            key={selectedIdee.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            className="w-[40%] shrink-0"
          >
            <IdeeDetailPanel
              key={selectedIdee.id}
              idee={selectedIdee}
              onClose={() => setSelectedId(null)}
              onDaanSpar={() => onDaanSpar(selectedIdee)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
