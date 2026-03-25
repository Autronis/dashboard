"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentList } from "@/components/documenten/document-list";
import { DocumentModal } from "@/components/documenten/document-modal";
import { Plus, Trash2, FolderSync, FileText, DollarSign, Phone, BookOpen, BarChart2, ClipboardList, StickyNote, AlertTriangle, ScanSearch, Loader2, X, ChevronDown, Settings2, CheckCircle2, type LucideIcon } from "lucide-react";
import { AiDocumentButton, AiDocumentPanel } from "@/components/documenten/ai-document-creator";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/types/documenten";
import { DOCUMENT_SUBTYPE_CONFIG, SUBTYPE_TO_NOTION_TYPE } from "@/types/documenten";
import type { DocumentSubtype } from "@/types/documenten";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

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

type ProgressStep = { label: string; status: "pending" | "active" | "done" | "error" };

export default function DocumentenPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialType, setInitialType] = useState<DocumentType | undefined>();
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [autoPlanLoading, setAutoPlanLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResults, setScanResults] = useState<Array<{ notionId: string; titel: string }> | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [beheerOpen, setBeheerOpen] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const beheerRef = useRef<HTMLDivElement>(null);
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

  // Close beheer dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (beheerRef.current && !beheerRef.current.contains(e.target as Node)) {
        setBeheerOpen(false);
      }
    }
    if (beheerOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [beheerOpen]);

  function openModal(type?: DocumentType) {
    setInitialType(type);
    setModalOpen(true);
  }

  const handleCleanup = useCallback(async () => {
    setBeheerOpen(false);
    setCleanupLoading(true);
    setProgressSteps([
      { label: "Documenten ophalen", status: "active" },
      { label: "Duplicaten detecteren", status: "pending" },
      { label: "Archiveren", status: "pending" },
    ]);
    try {
      // Brief delay so first step registers visually
      await new Promise((r) => setTimeout(r, 400));
      setProgressSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: "done" } : i === 1 ? { ...s, status: "active" } : s))
      );

      const res = await fetch("/api/documenten/opschonen", { method: "POST" });
      const data = await res.json();

      setProgressSteps((prev) =>
        prev.map((s, i) =>
          i === 1 ? { ...s, status: "done" } :
          i === 2 ? { ...s, status: "active", label: `${data.gearchiveerd ?? 0} archiveren` } : s
        )
      );
      await new Promise((r) => setTimeout(r, 300));
      setProgressSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));

      if (!res.ok) throw new Error(data.fout ?? "Fout bij opschonen");
      addToast(
        data.duplicatenGevonden > 0
          ? `${data.gearchiveerd} duplica${data.gearchiveerd === 1 ? "at" : "ten"} gearchiveerd`
          : "Geen duplicaten gevonden",
        "succes"
      );
      queryClient.invalidateQueries({ queryKey: ["documenten"] });
    } catch (err) {
      setProgressSteps((prev) => prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s)));
      addToast(err instanceof Error ? err.message : "Opschonen mislukt", "fout");
    } finally {
      setCleanupLoading(false);
      setTimeout(() => setProgressSteps([]), 2500);
    }
  }, [addToast, queryClient]);

  const handleScanOnnodig = useCallback(async () => {
    setBeheerOpen(false);
    setScanLoading(true);
    setProgressSteps([
      { label: "Actieve projecten laden", status: "active" },
      { label: "Plan-documenten ophalen", status: "pending" },
      { label: "Vergelijken", status: "pending" },
    ]);
    try {
      await new Promise((r) => setTimeout(r, 350));
      setProgressSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: "done" } : i === 1 ? { ...s, status: "active" } : s))
      );
      await new Promise((r) => setTimeout(r, 350));
      setProgressSteps((prev) =>
        prev.map((s, i) => (i < 2 ? { ...s, status: "done" } : { ...s, status: "active" }))
      );

      const res = await fetch("/api/documenten/scan-onnodig", { method: "POST" });
      const data = await res.json();

      setProgressSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));

      if (!res.ok) throw new Error(data.fout ?? "Scan mislukt");
      if (data.onnodig.length === 0) {
        addToast("Geen onnodige documenten gevonden", "succes");
        setScanResults(null);
      } else {
        setScanResults(data.onnodig);
      }
    } catch (err) {
      setProgressSteps((prev) => prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s)));
      addToast(err instanceof Error ? err.message : "Scan mislukt", "fout");
    } finally {
      setScanLoading(false);
      setTimeout(() => setProgressSteps([]), 2500);
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
    setBeheerOpen(false);
    setAutoPlanLoading(true);
    setProgressSteps([
      { label: "Projecten controleren", status: "active" },
      { label: "Ontbrekende plannen aanmaken", status: "pending" },
    ]);
    try {
      await new Promise((r) => setTimeout(r, 500));
      setProgressSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: "done" } : { ...s, status: "active" }))
      );
      const res = await fetch("/api/documenten/auto-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout ?? "Fout bij aanmaken plannen");
      setProgressSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
      addToast(
        data.aangemaakt > 0
          ? `${data.aangemaakt} projectplan${data.aangemaakt === 1 ? "" : "nen"} aangemaakt`
          : `Alle projecten hebben al een plan (${data.overgeslagen} overgeslagen)`,
        "succes"
      );
      queryClient.invalidateQueries({ queryKey: ["documenten"] });
    } catch (err) {
      setProgressSteps((prev) => prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s)));
      addToast(err instanceof Error ? err.message : "Plannen aanmaken mislukt", "fout");
    } finally {
      setAutoPlanLoading(false);
      setTimeout(() => setProgressSteps([]), 2500);
    }
  }, [addToast, queryClient]);

  const anyLoading = cleanupLoading || autoPlanLoading || scanLoading;

  return (
    <PageTransition>
    <div className="p-3 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-autronis-text-primary tracking-tight">Documenten</h1>
          <p className="text-xs sm:text-sm text-autronis-text-secondary mt-1">Alle documenten in Notion</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Beheer dropdown */}
          <div className="relative" ref={beheerRef}>
            <button
              onClick={() => setBeheerOpen(!beheerOpen)}
              disabled={anyLoading}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border",
                "border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/30 disabled:opacity-50"
              )}
            >
              {anyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Beheer</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", beheerOpen ? "rotate-180" : "")} />
            </button>
            <AnimatePresence>
              {beheerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-56 bg-autronis-card border border-autronis-border rounded-xl shadow-xl z-30 overflow-hidden"
                >
                  <button
                    onClick={handleCleanup}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Duplicaten opschonen
                  </button>
                  <button
                    onClick={handleAutoPlan}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/5 transition-colors"
                  >
                    <FolderSync className="w-4 h-4" />
                    Missende plannen aanmaken
                  </button>
                  <button
                    onClick={handleScanOnnodig}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-amber-400 hover:bg-amber-500/5 transition-colors"
                  >
                    <ScanSearch className="w-4 h-4" />
                    Scan onnodige docs
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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

      {/* Progress steps */}
      <AnimatePresence>
        {progressSteps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-autronis-card border border-autronis-border rounded-xl">
              {progressSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {i > 0 && <div className="w-4 h-px bg-autronis-border" />}
                  <div className="flex items-center gap-1.5">
                    {step.status === "done" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    ) : step.status === "active" ? (
                      <Loader2 className="w-3.5 h-3.5 text-autronis-accent animate-spin flex-shrink-0" />
                    ) : step.status === "error" ? (
                      <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-autronis-border flex-shrink-0" />
                    )}
                    <span className={cn(
                      "text-xs",
                      step.status === "done" ? "text-green-400" :
                      step.status === "active" ? "text-autronis-text-primary" :
                      step.status === "error" ? "text-red-400" :
                      "text-autronis-text-secondary"
                    )}>
                      {step.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Document Creator Panel */}
      <AnimatePresence>
        {aiPanelOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <AiDocumentPanel onClose={() => setAiPanelOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Snel aanmaken type knoppen */}
      <div className="flex flex-wrap gap-2">
        {SNELLE_TYPES.map(({ subtype, notionType, icon: Icon }, i) => {
          const config = DOCUMENT_SUBTYPE_CONFIG[subtype];
          return (
            <motion.button
              key={subtype}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              whileHover={{ y: -1, transition: { duration: 0.12 } }}
              onClick={() => openModal(notionType)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition-colors border",
                "border-autronis-border hover:border-autronis-accent/30",
                config.bgClass, config.textClass
              )}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {config.label}
            </motion.button>
          );
        })}
      </div>

      {/* Scan results */}
      <AnimatePresence>
        {scanResults && scanResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>

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
