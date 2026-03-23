"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentList } from "@/components/documenten/document-list";
import { DocumentModal } from "@/components/documenten/document-modal";
import { Plus, Trash2, FolderSync, FileText, DollarSign, Phone, BookOpen, BarChart2, ClipboardList, StickyNote, AlertTriangle, ScanSearch, Loader2, X, type LucideIcon } from "lucide-react";
import { AiDocumentButton, AiDocumentPanel } from "@/components/documenten/ai-document-creator";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/types/documenten";
import { DOCUMENT_SUBTYPE_CONFIG, SUBTYPE_TO_NOTION_TYPE } from "@/types/documenten";
import type { DocumentSubtype } from "@/types/documenten";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const SNELLE_TYPES: { subtype: DocumentSubtype; notionType: DocumentType; icon: LucideIcon }[] = [
  { subtype: "contract", notionType: "contract", icon: FileText },
  { subtype: "offerte", notionType: "klantdocument", icon: DollarSign },
  { subtype: "meeting-notities", notionType: "notitie", icon: Phone },
  { subtype: "handleiding", notionType: "intern", icon: BookOpen },
  { subtype: "rapport", notionType: "klantdocument", icon: BarChart2 },
  { subtype: "plan", notionType: "plan", icon: ClipboardList },
  { subtype: "notitie", notionType: "notitie", icon: StickyNote },
  { subtype: "belangrijk", notionType: "belangrijke-info", icon: AlertTriangle },
];

export default function DocumentenPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialType, setInitialType] = useState<DocumentType | undefined>();
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [autoPlanLoading, setAutoPlanLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResults, setScanResults] = useState<Array<{ notionId: string; titel: string }> | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
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

  const handleScanOnnodig = useCallback(async () => {
    setScanLoading(true);
    try {
      const res = await fetch("/api/documenten/scan-onnodig", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout ?? "Scan mislukt");
      if (data.onnodig.length === 0) {
        addToast("Geen onnodige documenten gevonden", "succes");
        setScanResults(null);
      } else {
        setScanResults(data.onnodig);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Scan mislukt", "fout");
    } finally {
      setScanLoading(false);
    }
  }, [addToast]);

  const handleArchiveOnnodig = useCallback(async (notionIds: string[]) => {
    setArchiveLoading(true);
    try {
      const res = await fetch("/api/documenten/scan-onnodig", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notionIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout ?? "Verwijderen mislukt");
      addToast(`${data.gearchiveerd} document${data.gearchiveerd === 1 ? "" : "en"} gearchiveerd`, "succes");
      setScanResults(null);
      queryClient.invalidateQueries({ queryKey: ["documenten"] });
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Verwijderen mislukt", "fout");
    } finally {
      setArchiveLoading(false);
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
    <div className="p-3 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-autronis-text-primary tracking-tight">Documenten</h1>
          <p className="text-xs sm:text-sm text-autronis-text-secondary mt-1">Alle documenten in Notion</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <AiDocumentButton onClick={() => setAiPanelOpen(!aiPanelOpen)} />
          <button
            onClick={() => openModal()}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-autronis-accent text-autronis-bg text-xs sm:text-sm font-semibold hover:bg-autronis-accent-hover transition-colors shadow-lg shadow-autronis-accent/20 btn-press"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Nieuw document</span>
            <span className="sm:hidden">Nieuw</span>
          </button>
        </div>
      </div>

      {/* AI Document Creator Panel */}
      {aiPanelOpen && <AiDocumentPanel onClose={() => setAiPanelOpen(false)} />}

      {/* Snel aanmaken type knoppen */}
      <div className="flex flex-wrap gap-2">
        {SNELLE_TYPES.map(({ subtype, notionType, icon: Icon }) => {
          const config = DOCUMENT_SUBTYPE_CONFIG[subtype];
          return (
            <button
              key={subtype}
              onClick={() => openModal(notionType)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition-colors border",
                "border-autronis-border hover:border-autronis-accent/30",
                config.bgClass, config.textClass
              )}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Beheer acties */}
      <div className="flex flex-wrap items-center gap-2">
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
        <button
          onClick={handleScanOnnodig}
          disabled={scanLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border border-autronis-border hover:border-amber-500/30 text-autronis-text-secondary hover:text-amber-400 disabled:opacity-50"
        >
          {scanLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
          {scanLoading ? "Scannen..." : "Scan onnodige docs"}
        </button>
      </div>

      {/* Scan results */}
      {scanResults && scanResults.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScanSearch className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-autronis-text-primary">
                {scanResults.length} document{scanResults.length === 1 ? "" : "en"} zonder actief project
              </span>
            </div>
            <button onClick={() => setScanResults(null)} className="p-1 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {scanResults.map((doc) => (
              <div key={doc.notionId} className="flex items-center justify-between px-3 py-2 bg-autronis-card border border-autronis-border rounded-xl text-sm">
                <span className="text-autronis-text-primary truncate">{doc.titel}</span>
                <button
                  onClick={() => handleArchiveOnnodig([doc.notionId])}
                  disabled={archiveLoading}
                  className="text-xs text-red-400 hover:text-red-300 font-medium shrink-0 ml-3 disabled:opacity-50"
                >
                  Archiveer
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => handleArchiveOnnodig(scanResults.map((d) => d.notionId))}
            disabled={archiveLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {archiveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {archiveLoading ? "Archiveren..." : `Alle ${scanResults.length} archiveren`}
          </button>
        </div>
      )}

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
