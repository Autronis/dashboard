"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDocumenten, useArchiveDocument } from "@/hooks/queries/use-documenten";
import { useRecentDocuments, usePinnedDocuments } from "@/hooks/use-document-prefs";
import { useToast } from "@/hooks/use-toast";
import { DocumentBase, DocumentType, SortOption, DOCUMENT_TYPE_CONFIG, DOCUMENT_TYPE_LABELS, SORT_LABELS } from "@/types/documenten";
import { DocumentPreview } from "./document-preview";
import { DocumentModal } from "./document-modal";
import { DocumentKanban } from "./document-kanban";
import { SavedFilters } from "./saved-filters";
import { FileText, ExternalLink, Search, ArrowUpDown, Loader2, ChevronLeft, ChevronRight, Pin, X, Clock, Archive, List, LayoutGrid, ChevronDown, FolderOpen, BookOpen, AlertTriangle, ClipboardList, Lightbulb, Copy, Eye, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<DocumentType, LucideIcon> = {
  plan: ClipboardList,
  contract: FileText,
  klantdocument: FolderOpen,
  intern: BookOpen,
  notitie: Lightbulb,
  "belangrijke-info": AlertTriangle,
};

// Highlight matching text in a string
function HighlightText({ text, zoekterm }: { text: string; zoekterm: string }) {
  if (!zoekterm.trim()) return <>{text}</>;
  const escaped = zoekterm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === zoekterm.toLowerCase() ? (
          <mark key={i} className="bg-autronis-accent/30 text-autronis-text-primary rounded px-0.5 not-italic">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<DocumentType>>(new Set(["plan", "contract", "klantdocument", "intern", "notitie", "belangrijke-info"] as DocumentType[]));
  const [focusedDocId, setFocusedDocId] = useState<string | null>(null);

  const { data, isLoading, error } = useDocumenten(sortBy, cursor);
  const documenten = data?.documenten;
  const { recent, addRecent, hidden: recentHidden, toggleHidden: toggleRecentHidden } = useRecentDocuments();
  const { togglePin, isPinned } = usePinnedDocuments();
  const archiveDocument = useArchiveDocument();
  const { addToast } = useToast();

  const klantNamen = [...new Set(documenten?.map((d: DocumentBase) => d.klantNaam).filter(Boolean) ?? [])];

  // Client-side filtering
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

  // Flat list for keyboard nav
  const flatDocs = grouped.flatMap((g) => (collapsedGroups.has(g.type) ? [] : g.docs));

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (previewOpen) return;
      if (!flatDocs.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const currentIdx = focusedDocId ? flatDocs.findIndex((d) => d.notionId === focusedDocId) : -1;
        const next = flatDocs[Math.min(currentIdx + 1, flatDocs.length - 1)];
        if (next) setFocusedDocId(next.notionId);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx = focusedDocId ? flatDocs.findIndex((d) => d.notionId === focusedDocId) : 0;
        const prev = flatDocs[Math.max(currentIdx - 1, 0)];
        if (prev) setFocusedDocId(prev.notionId);
      } else if (e.key === "Enter" && focusedDocId) {
        const doc = flatDocs.find((d) => d.notionId === focusedDocId);
        if (doc) openPreview(doc);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [flatDocs, focusedDocId, previewOpen]);

  function toggleGroup(type: DocumentType) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
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

  function handleNextPage() {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, cursor ?? ""]);
      setCursor(data.nextCursor);
    }
  }

  function handlePrevPage() {
    const prev = cursorHistory.slice(0, -1);
    const prevCursor = cursorHistory[cursorHistory.length - 1];
    setCursorHistory(prev);
    setCursor(prevCursor || undefined);
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

  const TYPE_FILTER_ORDER: (DocumentType | "alle")[] = ["alle", ...GROUP_ORDER];

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
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {recent.map((r) => {
              const rConfig = DOCUMENT_TYPE_CONFIG[r.type as DocumentType];
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    const found = documenten?.find((d: DocumentBase) => d.notionId === r.id);
                    if (found) openPreview(found);
                  }}
                  className="flex-shrink-0 rounded-xl bg-autronis-card border border-autronis-border hover:border-autronis-accent/50 transition-colors text-left min-w-[160px] overflow-hidden"
                >
                  {/* Colored top strip */}
                  <div className="h-0.5 w-full" style={{ backgroundColor: rConfig?.color ?? "#666" }} />
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-medium truncate" style={{ color: rConfig?.color ?? "#666" }}>{rConfig?.label ?? r.type}</span>
                    </div>
                    <p className="text-sm text-autronis-text-primary truncate">{r.titel}</p>
                    <p className="text-xs text-autronis-text-secondary mt-0.5">{timeAgo(r.timestamp)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* View + archived toggle */}
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center rounded-lg border border-autronis-border overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-autronis-accent/10 text-autronis-accent" : "text-autronis-text-secondary hover:text-autronis-text-primary"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={`p-1.5 transition-colors ${viewMode === "kanban" ? "bg-autronis-accent/10 text-autronis-accent" : "text-autronis-text-secondary hover:text-autronis-text-primary"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showArchived ? "bg-autronis-accent/10 text-autronis-accent" : "text-autronis-text-secondary hover:text-autronis-text-primary"}`}
        >
          <Archive className="w-3.5 h-3.5" />
          {showArchived ? "Toon actief" : "Gearchiveerd"}
        </button>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTER_ORDER.map((type) => {
          const isActive = filterType === type;
          const cfg = type !== "alle" ? DOCUMENT_TYPE_CONFIG[type] : null;
          const count = type === "alle"
            ? (gefilterd?.length ?? 0)
            : (gefilterd?.filter((d: DocumentBase) => d.type === type).length ?? 0);
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                isActive
                  ? type === "alle"
                    ? "bg-autronis-accent/15 border-autronis-accent/40 text-autronis-accent"
                    : `border-2`
                  : "border-autronis-border bg-autronis-card text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/30"
              )}
              style={
                isActive && cfg
                  ? { borderColor: cfg.color, color: cfg.color, backgroundColor: `${cfg.color}18` }
                  : {}
              }
            >
              {cfg && (
                <div
                  className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", !isActive && "bg-autronis-border")}
                  style={{ backgroundColor: isActive ? cfg.color : undefined }}
                />
              )}
              {type === "alle" ? "Alle" : cfg?.label}
              {count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  isActive ? "bg-white/20 text-inherit" : "bg-autronis-bg text-autronis-text-secondary"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + Sort row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary" />
          <input
            type="text"
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            placeholder="Zoek documenten..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-autronis-card border border-autronis-border text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
          />
        </div>
        <select
          value={filterKlant}
          onChange={(e) => setFilterKlant(e.target.value)}
          className="rounded-lg bg-autronis-card border border-autronis-border px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
        >
          <option value="">Alle klanten</option>
          {klantNamen.map((naam) => (
            <option key={naam} value={naam}>{naam}</option>
          ))}
        </select>
        <input
          type="month"
          value={filterDatum}
          onChange={(e) => setFilterDatum(e.target.value)}
          className="rounded-lg bg-autronis-card border border-autronis-border px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
        />
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-4 h-4 text-autronis-text-secondary flex-shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className="rounded-lg bg-autronis-card border border-autronis-border px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Saved filters as chips below search */}
      <SavedFilters
        currentFilters={{ type: filterType, klant: filterKlant, maand: filterDatum, zoekterm }}
        onApply={(f) => {
          setFilterType(f.type);
          setFilterKlant(f.klant);
          setFilterDatum(f.maand);
          setZoekterm(f.zoekterm);
        }}
      />

      {/* Document list / kanban */}
      {viewMode === "kanban" && gefilterd?.length ? (
        <DocumentKanban
          documenten={gefilterd}
          onSelect={openPreview}
          isPinned={isPinned}
          onTogglePin={togglePin}
        />
      ) : !gefilterd?.length ? (
        <div className="rounded-xl bg-autronis-card border border-autronis-border p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-autronis-text-secondary opacity-50" />
          <p className="text-autronis-text-secondary">
            {zoekterm || filterType !== "alle" ? "Geen documenten gevonden" : "Nog geen documenten. Maak je eerste document aan!"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ type, config, docs }) => {
            const isCollapsed = collapsedGroups.has(type);
            const Icon = TYPE_ICONS[type];
            return (
              <div key={type}>
                <button
                  onClick={() => toggleGroup(type)}
                  className="flex items-center gap-2 w-full mb-3 group/header"
                >
                  <div className="w-1 h-5 rounded-full" style={{ backgroundColor: config.color }} />
                  <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: config.color }}>
                    {Icon && <Icon className="w-4 h-4" />}
                    {config.label}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: `${config.color}20`, color: config.color }}
                  >
                    {docs.length}
                  </span>
                  <div className="flex-1 h-px ml-2" style={{ backgroundColor: `${config.color}20` }} />
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200`} style={{ color: config.color, opacity: 0.6, transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }} />
                </button>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 pb-1">
                        {docs.map((doc: DocumentBase) => {
                          const pinned = isPinned(doc.notionId);
                          const isFocused = focusedDocId === doc.notionId;
                          return (
                            <div
                              key={doc.notionId}
                              onClick={() => !doc.isOptimistic && openPreview(doc)}
                              onMouseEnter={() => setFocusedDocId(doc.notionId)}
                              className={cn(
                                "relative rounded-xl bg-autronis-card border p-4 transition-all group cursor-pointer",
                                pinned
                                  ? "border-amber-500/30 border-l-4 border-l-amber-400/70"
                                  : isFocused
                                  ? "border-autronis-accent/40"
                                  : "border-autronis-border",
                                doc.isOptimistic ? "opacity-60 pointer-events-none" : "hover:border-autronis-accent/40"
                              )}
                            >
                              <div className="flex items-start gap-4 pr-10">
                                <div className="w-1 self-stretch rounded-full opacity-60" style={{ backgroundColor: config.color }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm font-medium text-autronis-text-primary truncate">
                                      <HighlightText text={doc.titel} zoekterm={zoekterm} />
                                    </h3>
                                    {doc.isOptimistic && <Loader2 className="w-3.5 h-3.5 animate-spin text-autronis-text-secondary" />}
                                    {pinned && <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                                  </div>
                                  {doc.samenvatting && (
                                    <p className="text-xs text-autronis-text-secondary line-clamp-1 italic">{doc.samenvatting}</p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2 text-xs text-autronis-text-secondary">
                                    {doc.klantNaam && <span>{doc.klantNaam}</span>}
                                    {doc.aangemaaktOp && <span>{new Date(doc.aangemaaktOp).toLocaleDateString("nl-NL")}</span>}
                                    <span>{doc.aangemaaktDoor}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Hover inline actions */}
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-autronis-card border border-autronis-border rounded-lg p-0.5 shadow-sm">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openPreview(doc); }}
                                  className="p-1.5 rounded-md text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg transition-colors"
                                  title="Preview"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <a
                                  href={doc.notionUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded-md text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg transition-colors"
                                  title="Openen in Notion"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  onClick={(e) => { e.stopPropagation(); togglePin(doc.notionId); }}
                                  className={cn("p-1.5 rounded-md transition-colors hover:bg-autronis-bg", pinned ? "text-amber-400" : "text-autronis-text-secondary hover:text-amber-400")}
                                  title={pinned ? "Losmaken" : "Vastzetten"}
                                >
                                  <Pin className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDuplicate(doc); }}
                                  className="p-1.5 rounded-md text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg transition-colors"
                                  title="Dupliceren"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleArchive(doc); }}
                                  className="p-1.5 rounded-md text-autronis-text-secondary hover:text-red-400 hover:bg-autronis-bg transition-colors"
                                  title="Archiveren"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
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
          <button
            onClick={handlePrevPage}
            disabled={cursorHistory.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
            Vorige
          </button>
          <span className="text-xs text-autronis-text-secondary">
            Pagina {cursorHistory.length + 1}
          </span>
          <button
            onClick={handleNextPage}
            disabled={!data?.hasMore}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            Volgende
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Preview panel */}
      <DocumentPreview
        document={previewDoc}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onDuplicate={handleDuplicate}
        onArchive={handleArchive}
      />

      {/* Duplicate modal */}
      {duplicateDoc && (
        <DocumentModal
          open={!!duplicateDoc}
          onClose={() => setDuplicateDoc(null)}
          initialValues={{
            titel: `${duplicateDoc.titel} — kopie`,
            type: duplicateDoc.type,
          }}
        />
      )}
    </div>
  );
}
