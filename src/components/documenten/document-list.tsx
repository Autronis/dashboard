"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDocumenten, useArchiveDocument } from "@/hooks/queries/use-documenten";
import { useRecentDocuments, usePinnedDocuments } from "@/hooks/use-document-prefs";
import { useToast } from "@/hooks/use-toast";
import { DocumentBase, DocumentType, SortOption, DOCUMENT_TYPE_CONFIG, SORT_LABELS } from "@/types/documenten";
import { DocumentPreview } from "./document-preview";
import { DocumentModal } from "./document-modal";
import { DocumentKanban } from "./document-kanban";
import { SavedFilters } from "./saved-filters";
import {
  FileText, ExternalLink, Search, ArrowUpDown, Loader2, ChevronLeft, ChevronRight,
  Pin, X, Clock, Archive, List, LayoutGrid, ChevronDown, FolderOpen, BookOpen,
  AlertTriangle, ClipboardList, Lightbulb, Copy, Eye, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<DocumentType, LucideIcon> = {
  plan: ClipboardList,
  contract: FileText,
  klantdocument: FolderOpen,
  intern: BookOpen,
  notitie: Lightbulb,
  "belangrijke-info": AlertTriangle,
};

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-autronis-accent/30 text-autronis-text-primary rounded px-0.5 not-italic">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

function isStaleDoc(doc: DocumentBase): boolean {
  if (doc.type !== "plan" || doc.isOptimistic) return false;
  return (Date.now() - new Date(doc.aangemaaktOp).getTime()) / (1000 * 60 * 60 * 24) > 30;
}

export function DocumentList() {
  const [zoekterm, setZoekterm] = useState("");
  const [filterType, setFilterType] = useState<DocumentType | "alle">("alle");
  const [filterKlant, setFilterKlant] = useState("");
  const [filterDatum, setFilterDatum] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("datum-desc");
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocumentBase | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [duplicateDoc, setDuplicateDoc] = useState<DocumentBase | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<DocumentType>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [hoverDocId, setHoverDocId] = useState<string | null>(null);
  const [pinGlowId, setPinGlowId] = useState<string | null>(null);

  const { data, isLoading, error } = useDocumenten(sortBy, cursor);
  const documenten = data?.documenten;
  const { recent, addRecent, hidden: recentHidden, toggleHidden: toggleRecentHidden } = useRecentDocuments();
  const { togglePin, isPinned } = usePinnedDocuments();
  const archiveDocument = useArchiveDocument();
  const { addToast } = useToast();

  const klantNamen = [...new Set(documenten?.map((d: DocumentBase) => d.klantNaam).filter(Boolean) ?? [])];

  // Count per type across all loaded docs (ignoring current type filter)
  const typeCountsAll = (documenten ?? []).reduce((acc: Record<string, number>, doc: DocumentBase) => {
    acc[doc.type] = (acc[doc.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const anyFilterActive = zoekterm !== "" || filterType !== "alle" || filterKlant !== "" || filterDatum !== "";

  const gefilterd = documenten
    ?.filter((doc: DocumentBase) => {
      const matchType = filterType === "alle" || doc.type === filterType;
      const matchZoek = !zoekterm || doc.titel.toLowerCase().includes(zoekterm.toLowerCase()) || doc.samenvatting.toLowerCase().includes(zoekterm.toLowerCase());
      const matchKlant = !filterKlant || doc.klantNaam === filterKlant;
      const matchDatum = !filterDatum || doc.aangemaaktOp.startsWith(filterDatum);
      return matchType && matchZoek && matchKlant && matchDatum;
    })
    .sort((a: DocumentBase, b: DocumentBase) => {
      const aPinned = isPinned(a.notionId) ? 0 : 1;
      const bPinned = isPinned(b.notionId) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      return 0;
    });

  const GROUP_ORDER: DocumentType[] = ["plan", "contract", "klantdocument", "intern", "notitie", "belangrijke-info"];

  const grouped = gefilterd
    ? GROUP_ORDER.map((type) => ({
        type,
        config: DOCUMENT_TYPE_CONFIG[type],
        docs: gefilterd.filter((d: DocumentBase) => d.type === type),
      })).filter((g) => g.docs.length > 0)
    : [];

  // Flat list across visible groups for keyboard nav
  const flatDocs = grouped.flatMap((g) => (collapsedGroups.has(g.type) ? [] : g.docs));

  // Reset focus when filters change
  useEffect(() => { setFocusedIndex(-1); }, [zoekterm, filterType, filterKlant, filterDatum]);

  // Keyboard navigation
  useEffect(() => {
    if (previewOpen) return;
    function handle(e: KeyboardEvent) {
      if (!flatDocs.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIndex((p) => Math.min(p + 1, flatDocs.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIndex((p) => Math.max(p - 1, 0)); }
      else if (e.key === "Enter" && focusedIndex >= 0 && flatDocs[focusedIndex]) { openPreview(flatDocs[focusedIndex]); }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [previewOpen, flatDocs, focusedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleGroup(type: DocumentType) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  function handleArchive(doc: DocumentBase) {
    archiveDocument.mutate(
      { id: doc.notionId, archived: true },
      {
        onSuccess: () => addToast("Document gearchiveerd", "succes"),
        onError: () => addToast("Kon document niet archiveren", "fout"),
      }
    );
  }

  function handleDuplicate(doc: DocumentBase) {
    setDuplicateDoc(doc);
    setPreviewOpen(false);
  }

  function openPreview(doc: DocumentBase) {
    setPreviewDoc(doc);
    setPreviewOpen(true);
    addRecent(doc.notionId, doc.titel, doc.type);
  }

  const handleTogglePin = useCallback((id: string) => {
    togglePin(id);
    setPinGlowId(id);
    setTimeout(() => setPinGlowId(null), 800);
  }, [togglePin]);

  function handleNextPage() {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, cursor ?? ""]);
      setCursor(data.nextCursor);
    }
  }

  function handlePrevPage() {
    const prev = cursorHistory.slice(0, -1);
    setCursorHistory(prev);
    setCursor(cursorHistory[cursorHistory.length - 1] || undefined);
  }

  function handleSortChange(newSort: SortOption) {
    setSortBy(newSort);
    setCursor(undefined);
    setCursorHistory([]);
  }

  function timeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "zojuist";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min geleden`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} uur geleden`;
    const days = Math.floor(hours / 24);
    return `${days} dag${days > 1 ? "en" : ""} geleden`;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-autronis-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-autronis-card border border-autronis-border p-8 text-center">
        <p className="text-autronis-text-secondary">Kon documenten niet ophalen. Probeer het opnieuw.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Recent opened */}
      {!recentHidden && recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-autronis-text-secondary uppercase tracking-wide">
              <Clock className="w-3.5 h-3.5" />
              Recent
            </div>
            <button onClick={toggleRecentHidden} className="p-1 rounded hover:bg-autronis-border transition-colors">
              <X className="w-3.5 h-3.5 text-autronis-text-secondary" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {recent.map((r, i) => {
              const rConfig = DOCUMENT_TYPE_CONFIG[r.type as DocumentType];
              return (
                <motion.button
                  key={r.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                  whileHover={{ y: -2, transition: { duration: 0.15 } }}
                  onClick={() => {
                    const found = documenten?.find((d: DocumentBase) => d.notionId === r.id);
                    if (found) openPreview(found);
                  }}
                  className="flex-shrink-0 rounded-xl bg-autronis-card border border-autronis-border hover:border-autronis-accent/50 transition-colors text-left min-w-[160px] overflow-hidden"
                >
                  {/* Type-kleur accent strip */}
                  <div className="h-1 w-full" style={{ backgroundColor: rConfig?.color ?? "#666" }} />
                  <div className="px-3 py-2">
                    <span className={`text-xs ${rConfig?.textClass ?? "text-autronis-text-secondary"}`}>{rConfig?.label ?? r.type}</span>
                    <p className="text-sm text-autronis-text-primary truncate mt-0.5">{r.titel}</p>
                    <p className="text-xs text-autronis-text-secondary mt-0.5">{timeAgo(r.timestamp)}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved filters — prominent chips above search */}
      <SavedFilters
        currentFilters={{ type: filterType, klant: filterKlant, maand: filterDatum, zoekterm }}
        onApply={(f) => {
          setFilterType(f.type);
          setFilterKlant(f.klant);
          setFilterDatum(f.maand);
          setZoekterm(f.zoekterm);
        }}
      />

      {/* Type filter chips — colored per type with counts */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          onClick={() => setFilterType("alle")}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border", filterType === "alle" ? "bg-autronis-accent/20 text-autronis-accent border-autronis-accent/30" : "border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary")}
        >
          Alle
          {(documenten?.length ?? 0) > 0 && (
            <span className="ml-1.5 text-[10px] opacity-60">{documenten?.length}</span>
          )}
        </button>
        {(Object.entries(DOCUMENT_TYPE_CONFIG) as [DocumentType, typeof DOCUMENT_TYPE_CONFIG[DocumentType]][]).map(([type, cfg]) => {
          const Icon = TYPE_ICONS[type];
          const count = typeCountsAll[type] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? "alle" : type)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                filterType === type ? `${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}` : "border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              <Icon className="w-3 h-3" />
              {cfg.label}
              <span className={cn("text-[10px] tabular-nums", filterType === type ? "opacity-70" : "opacity-40")}>{count}</span>
            </button>
          );
        })}
        {anyFilterActive && (
          <button
            onClick={() => { setFilterType("alle"); setFilterKlant(""); setFilterDatum(""); setZoekterm(""); }}
            className="ml-1 text-xs text-autronis-text-secondary/50 hover:text-autronis-accent transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Wissen
          </button>
        )}
      </div>

      {/* Search + secondary filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary pointer-events-none" />
          <input
            type="text"
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            placeholder="Zoek documenten..."
            className="w-full pl-10 pr-8 py-2 rounded-lg bg-autronis-card border border-autronis-border text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
          />
          {zoekterm && (
            <button
              onClick={() => setZoekterm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-autronis-text-secondary/50 hover:text-autronis-text-primary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select value={filterKlant} onChange={(e) => setFilterKlant(e.target.value)} className="rounded-lg bg-autronis-card border border-autronis-border px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent">
          <option value="">Alle klanten</option>
          {klantNamen.map((naam) => <option key={naam} value={naam}>{naam}</option>)}
        </select>
        <input type="month" value={filterDatum} onChange={(e) => setFilterDatum(e.target.value)} className="rounded-lg bg-autronis-card border border-autronis-border px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent" />
        <div className="flex items-center gap-2 flex-shrink-0">
          <ArrowUpDown className="w-4 h-4 text-autronis-text-secondary" />
          <select value={sortBy} onChange={(e) => handleSortChange(e.target.value as SortOption)} className="rounded-lg bg-autronis-card border border-autronis-border px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent">
            {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="flex items-center rounded-lg border border-autronis-border overflow-hidden">
            <button onClick={() => setViewMode("list")} className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-autronis-accent/10 text-autronis-accent" : "text-autronis-text-secondary hover:text-autronis-text-primary"}`}><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode("kanban")} className={`p-1.5 transition-colors ${viewMode === "kanban" ? "bg-autronis-accent/10 text-autronis-accent" : "text-autronis-text-secondary hover:text-autronis-text-primary"}`}><LayoutGrid className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setShowArchived(!showArchived)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showArchived ? "bg-autronis-accent/10 text-autronis-accent" : "text-autronis-text-secondary hover:text-autronis-text-primary"}`}>
            <Archive className="w-3.5 h-3.5" />
            {showArchived ? "Actief" : "Archief"}
          </button>
        </div>
      </div>

      {/* Document list / kanban */}
      {viewMode === "kanban" && gefilterd?.length ? (
        <DocumentKanban documenten={gefilterd} onSelect={openPreview} isPinned={isPinned} onTogglePin={handleTogglePin} />
      ) : !gefilterd?.length ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-autronis-card border border-autronis-border p-12 text-center"
        >
          <FileText className="w-10 h-10 mx-auto mb-3 text-autronis-text-secondary opacity-30" />
          {anyFilterActive ? (
            <>
              <p className="text-sm text-autronis-text-secondary mb-3">Geen documenten gevonden voor deze filter</p>
              <button
                onClick={() => { setFilterType("alle"); setFilterKlant(""); setFilterDatum(""); setZoekterm(""); }}
                className="text-xs text-autronis-accent hover:text-autronis-accent-hover transition-colors"
              >
                Filters wissen
              </button>
            </>
          ) : (
            <p className="text-sm text-autronis-text-secondary">Nog geen documenten. Maak je eerste document aan!</p>
          )}
        </motion.div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ type, config, docs }) => {
            const isCollapsed = collapsedGroups.has(type);
            const Icon = TYPE_ICONS[type];
            return (
              <div key={type}>
                <button onClick={() => toggleGroup(type)} className="flex items-center gap-2 w-full mb-3">
                  <div className="w-1 h-5 rounded-full" style={{ backgroundColor: config.color }} />
                  <span className="text-sm font-semibold text-autronis-text-primary flex items-center gap-1.5">
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                    {config.label}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", config.bgClass, config.textClass)}>{docs.length}</span>
                  <div className="flex-1 h-px bg-autronis-border ml-2" />
                  <ChevronDown className={`w-4 h-4 text-autronis-text-secondary transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2">
                        {docs.map((doc: DocumentBase, docIdx: number) => {
                          const pinned = isPinned(doc.notionId);
                          const stale = isStaleDoc(doc);
                          const flatIdx = flatDocs.indexOf(doc);
                          const isFocused = flatIdx === focusedIndex;
                          const isGlowing = pinGlowId === doc.notionId;

                          return (
                            <motion.div
                              key={doc.notionId}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              whileHover={doc.isOptimistic ? undefined : { y: -1, transition: { duration: 0.15 } }}
                              transition={{ delay: docIdx * 0.03 }}
                              onMouseEnter={() => setHoverDocId(doc.notionId)}
                              onMouseLeave={() => setHoverDocId(null)}
                              onClick={() => !doc.isOptimistic && openPreview(doc)}
                              className={cn(
                                "rounded-xl bg-autronis-card border-l-4 border border-autronis-border p-4 transition-colors group cursor-pointer card-glow relative",
                                isFocused && "ring-1 ring-autronis-accent/50 bg-autronis-accent/5",
                                doc.isOptimistic ? "opacity-60 pointer-events-none" : "hover:border-autronis-accent/40",
                              )}
                              style={{ borderLeftColor: pinned ? "#f59e0b" : config.color + "50" }}
                            >
                              {/* Amber glow burst on pin */}
                              {isGlowing && (
                                <motion.div
                                  initial={{ opacity: 0.7, scale: 0.95 }}
                                  animate={{ opacity: 0, scale: 1.2 }}
                                  transition={{ duration: 0.7 }}
                                  className="absolute inset-0 rounded-xl pointer-events-none"
                                  style={{ boxShadow: "0 0 0 2px #f59e0b, 0 0 20px #f59e0b50" }}
                                />
                              )}

                              <div className="flex items-start gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h3 className="text-sm font-medium text-autronis-text-primary">
                                      <HighlightText text={doc.titel} query={zoekterm} />
                                    </h3>
                                    {doc.isOptimistic && <Loader2 className="w-3.5 h-3.5 animate-spin text-autronis-text-secondary" />}
                                    {pinned && <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                                    {stale && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        Mogelijk verouderd
                                      </span>
                                    )}
                                  </div>
                                  {doc.samenvatting && (
                                    <p className="text-xs text-autronis-text-secondary line-clamp-1">{doc.samenvatting}</p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2 text-xs text-autronis-text-secondary">
                                    {doc.klantNaam && <span>{doc.klantNaam}</span>}
                                    {doc.aangemaaktOp && <span>{new Date(doc.aangemaaktOp).toLocaleDateString("nl-NL")}</span>}
                                    <span>{doc.aangemaaktDoor}</span>
                                  </div>
                                </div>

                                {/* Hover inline actions */}
                                <div className={cn("flex items-center gap-0.5 flex-shrink-0 transition-opacity duration-150", hoverDocId === doc.notionId || isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                                  <button onClick={(e) => { e.stopPropagation(); openPreview(doc); }} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors" title="Preview">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <a href={doc.notionUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border transition-colors" title="Openen in Notion">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                  <button onClick={(e) => { e.stopPropagation(); handleDuplicate(doc); }} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border transition-colors" title="Dupliceren">
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleTogglePin(doc.notionId); }} className={cn("p-1.5 rounded-lg transition-colors", pinned ? "text-amber-400 hover:bg-amber-500/10" : "text-autronis-text-secondary hover:text-amber-400 hover:bg-amber-500/10")} title={pinned ? "Losmaken" : "Vastzetten"}>
                                    <Pin className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleArchive(doc); }} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Archiveren">
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {(data?.hasMore || cursorHistory.length > 0) && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={handlePrevPage} disabled={cursorHistory.length === 0} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none">
            <ChevronLeft className="w-4 h-4" />Vorige
          </button>
          <span className="text-xs text-autronis-text-secondary">Pagina {cursorHistory.length + 1}</span>
          <button onClick={handleNextPage} disabled={!data?.hasMore} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none">
            Volgende<ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <DocumentPreview document={previewDoc} open={previewOpen} onClose={() => setPreviewOpen(false)} onDuplicate={handleDuplicate} onArchive={handleArchive} />

      {duplicateDoc && (
        <DocumentModal open={!!duplicateDoc} onClose={() => setDuplicateDoc(null)} initialValues={{ titel: `${duplicateDoc.titel} — kopie`, type: duplicateDoc.type }} />
      )}
    </div>
  );
}
