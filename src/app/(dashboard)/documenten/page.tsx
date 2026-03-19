"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentList } from "@/components/documenten/document-list";
import { DocumentModal } from "@/components/documenten/document-modal";
import { Plus, Trash2, FolderSync } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/types/documenten";
import { DOCUMENT_SUBTYPE_CONFIG, SUBTYPE_TO_NOTION_TYPE } from "@/types/documenten";
import type { DocumentSubtype } from "@/types/documenten";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const SNELLE_TYPES: { subtype: DocumentSubtype; notionType: DocumentType }[] = [
  { subtype: "contract", notionType: "contract" },
  { subtype: "offerte", notionType: "klantdocument" },
  { subtype: "meeting-notities", notionType: "notitie" },
  { subtype: "handleiding", notionType: "intern" },
  { subtype: "rapport", notionType: "klantdocument" },
  { subtype: "plan", notionType: "plan" },
  { subtype: "notitie", notionType: "notitie" },
  { subtype: "belangrijk", notionType: "belangrijke-info" },
];

export default function DocumentenPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialType, setInitialType] = useState<DocumentType | undefined>();
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [autoPlanLoading, setAutoPlanLoading] = useState(false);
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const nieuwType = searchParams.get("nieuw");
    if (nieuwType) {
      setInitialType(nieuwType as DocumentType);
      setModalOpen(true);
      window.history.replaceState({}, "", "/documenten");
    }
  }, [searchParams]);

  function openModal(type?: DocumentType) {
    setInitialType(type);
    setModalOpen(true);
  }

  const handleCleanup = useCallback(async () => {
    setCleanupLoading(true);
    try {
      const res = await fetch("/api/documenten/opschonen", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout ?? "Fout bij opschonen");
      addToast(
        data.duplicatenGevonden > 0
          ? `${data.gearchiveerd} duplica${data.gearchiveerd === 1 ? "at" : "ten"} gearchiveerd`
          : "Geen duplicaten gevonden",
        data.duplicatenGevonden > 0 ? "succes" : "succes"
      );
      queryClient.invalidateQueries({ queryKey: ["documenten"] });
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Opschonen mislukt", "fout");
    } finally {
      setCleanupLoading(false);
    }
  }, [addToast, queryClient]);

  const handleAutoPlan = useCallback(async () => {
    setAutoPlanLoading(true);
    try {
      const res = await fetch("/api/documenten/auto-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout ?? "Fout bij aanmaken plannen");
      addToast(
        data.aangemaakt > 0
          ? `${data.aangemaakt} projectplan${data.aangemaakt === 1 ? "" : "nen"} aangemaakt`
          : `Alle projecten hebben al een plan (${data.overgeslagen} overgeslagen)`,
        "succes"
      );
      queryClient.invalidateQueries({ queryKey: ["documenten"] });
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Plannen aanmaken mislukt", "fout");
    } finally {
      setAutoPlanLoading(false);
    }
  }, [addToast, queryClient]);

  return (
    <PageTransition>
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Documenten</h1>
          <p className="text-sm text-autronis-text-secondary mt-1">Alle documenten in Notion</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors shadow-lg shadow-autronis-accent/20 btn-press"
        >
          <Plus className="w-4 h-4" />
          Nieuw document
        </button>
      </div>

      {/* Snel aanmaken type knoppen */}
      <div className="flex flex-wrap gap-2">
        {SNELLE_TYPES.map(({ subtype, notionType }) => {
          const config = DOCUMENT_SUBTYPE_CONFIG[subtype];
          return (
            <button
              key={subtype}
              onClick={() => openModal(notionType)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border",
                "border-autronis-border hover:border-autronis-accent/30",
                config.bgClass, config.textClass
              )}
            >
              <span>{config.emoji}</span>
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Beheer acties */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCleanup}
          disabled={cleanupLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border border-autronis-border hover:border-red-500/30 text-autronis-text-secondary hover:text-red-400 disabled:opacity-50"
        >
          <Trash2 className={cn("w-3.5 h-3.5", cleanupLoading && "animate-spin")} />
          {cleanupLoading ? "Opschonen..." : "Duplicaten opschonen"}
        </button>
        <button
          onClick={handleAutoPlan}
          disabled={autoPlanLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border border-autronis-border hover:border-autronis-accent/30 text-autronis-text-secondary hover:text-autronis-accent disabled:opacity-50"
        >
          <FolderSync className={cn("w-3.5 h-3.5", autoPlanLoading && "animate-spin")} />
          {autoPlanLoading ? "Aanmaken..." : "Missende plannen aanmaken"}
        </button>
      </div>

      <DocumentList />

      <DocumentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialType={initialType}
      />
    </div>
    </PageTransition>
  );
}
