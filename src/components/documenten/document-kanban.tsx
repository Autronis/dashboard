"use client";

import { DocumentBase, DocumentType, DOCUMENT_TYPE_CONFIG } from "@/types/documenten";
import { FileText, ExternalLink, Pin } from "lucide-react";

interface KanbanColumn {
  id: string;
  label: string;
  docs: DocumentBase[];
}

interface DocumentKanbanProps {
  documenten: DocumentBase[];
  onSelect: (doc: DocumentBase) => void;
  isPinned: (id: string) => boolean;
  onTogglePin: (id: string) => void;
}

// Status columns per document type
const STATUS_COLUMNS: Partial<Record<DocumentType, { key: string; columns: { id: string; label: string }[] }>> = {
  contract: {
    key: "status",
    columns: [
      { id: "concept", label: "Concept" },
      { id: "actief", label: "Actief" },
      { id: "verlopen", label: "Verlopen" },
    ],
  },
  plan: {
    key: "status",
    columns: [
      { id: "concept", label: "Concept" },
      { id: "definitief", label: "Definitief" },
    ],
  },
};

// Default columns when no status mapping exists
const DEFAULT_COLUMNS = [
  { id: "alle", label: "Alle documenten" },
];

function groupByType(documenten: DocumentBase[]): Map<DocumentType, DocumentBase[]> {
  const groups = new Map<DocumentType, DocumentBase[]>();
  for (const doc of documenten) {
    const existing = groups.get(doc.type) ?? [];
    existing.push(doc);
    groups.set(doc.type, existing);
  }
  return groups;
}

export function DocumentKanban({ documenten, onSelect, isPinned, onTogglePin }: DocumentKanbanProps) {
  const grouped = groupByType(documenten);

  return (
    <div className="space-y-8">
      {Array.from(grouped.entries()).map(([type, docs]) => {
        const config = DOCUMENT_TYPE_CONFIG[type];
        const statusConfig = STATUS_COLUMNS[type];
        const columns: KanbanColumn[] = statusConfig
          ? statusConfig.columns.map((col) => ({
              ...col,
              docs: docs.filter(() => true), // All docs in each column for now (Notion doesn't return status in our current model)
            }))
          : DEFAULT_COLUMNS.map((col) => ({ ...col, docs }));

        // If no status mapping, show all docs in one column
        if (!statusConfig) {
          columns[0].docs = docs;
        }

        return (
          <div key={type}>
            {/* Type header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
              <h3 className="text-sm font-semibold text-autronis-text-primary">{config.label}</h3>
              <span className="text-xs text-autronis-text-secondary">({docs.length})</span>
            </div>

            {/* Columns */}
            <div className="flex gap-4 overflow-x-auto pb-2">
              {columns.map((col) => (
                <div key={col.id} className="flex-shrink-0 w-72">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wide">{col.label}</span>
                    <span className="text-xs text-autronis-text-secondary">{col.docs.length}</span>
                  </div>
                  <div className="space-y-2">
                    {col.docs.map((doc) => {
                      const pinned = isPinned(doc.notionId);
                      return (
                        <div
                          key={doc.notionId}
                          onClick={() => onSelect(doc)}
                          className={`rounded-xl bg-autronis-card border p-3 cursor-pointer transition-colors group card-glow hover:border-autronis-accent/50 ${pinned ? "border-amber-500/40" : "border-autronis-border"}`}
                        >
                          {/* Color bar top */}
                          <div className="w-full h-0.5 rounded-full mb-2 opacity-60" style={{ backgroundColor: config.color }} />
                          <h4 className="text-sm font-medium text-autronis-text-primary truncate">{doc.titel}</h4>
                          {doc.samenvatting && (
                            <p className="text-xs text-autronis-text-secondary line-clamp-2 mt-1">{doc.samenvatting}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2 text-xs text-autronis-text-secondary">
                              {doc.klantNaam && <span>{doc.klantNaam}</span>}
                              {doc.aangemaaktOp && <span>{new Date(doc.aangemaaktOp).toLocaleDateString("nl-NL")}</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); onTogglePin(doc.notionId); }}
                                className={`p-1 rounded transition-colors ${pinned ? "text-amber-400" : "text-autronis-text-secondary opacity-0 group-hover:opacity-100"}`}
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={doc.notionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded text-autronis-text-secondary opacity-0 group-hover:opacity-100 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {col.docs.length === 0 && (
                      <div className="rounded-xl border border-dashed border-autronis-border p-4 text-center">
                        <FileText className="w-6 h-6 mx-auto text-autronis-text-secondary opacity-30 mb-1" />
                        <p className="text-xs text-autronis-text-secondary">Geen documenten</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {documenten.length === 0 && (
        <div className="rounded-xl bg-autronis-card border border-autronis-border p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-autronis-text-secondary opacity-50" />
          <p className="text-autronis-text-secondary">Geen documenten gevonden</p>
        </div>
      )}
    </div>
  );
}
