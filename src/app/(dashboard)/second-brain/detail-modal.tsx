"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Star,
  Trash2,
  ExternalLink,
  FileText,
  Link2,
  Image as ImageIcon,
  FileDown,
  Code,
  CheckSquare,
  PenTool,
  BookMarked,
  Copy,
  Check,
} from "lucide-react";
import {
  type SecondBrainItem,
  useUpdateSecondBrainItem,
  useDeleteSecondBrainItem,
} from "@/hooks/queries/use-second-brain";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, formatDatum } from "@/lib/utils";

interface DetailModalProps {
  item: SecondBrainItem;
  onClose: () => void;
  onUpdate: () => void;
  allItems?: SecondBrainItem[];
  allTags?: string[];
}

const typeConfig: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  tekst: { icon: FileText, label: "Tekst", color: "text-blue-400" },
  url: { icon: Link2, label: "URL", color: "text-purple-400" },
  afbeelding: { icon: ImageIcon, label: "Afbeelding", color: "text-green-400" },
  pdf: { icon: FileDown, label: "PDF", color: "text-red-400" },
  code: { icon: Code, label: "Code", color: "text-yellow-400" },
};

export function DetailModal({ item, onClose, onUpdate, allItems = [], allTags = [] }: DetailModalProps) {
  const { addToast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [nieuwTag, setNieuwTag] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useUpdateSecondBrainItem();
  const deleteMutation = useDeleteSecondBrainItem();

  const cfg = typeConfig[item.type] ?? typeConfig.tekst;
  const TypeIcon = cfg.icon;

  const parsedTags: string[] = (() => {
    if (!item.aiTags) return [];
    try {
      return JSON.parse(item.aiTags) as string[];
    } catch {
      return [];
    }
  })();

  // Detect code language from ``` fence
  const codeLanguage = useMemo(() => {
    if (item.type !== "code" || !item.inhoud) return null;
    const match = item.inhoud.match(/^```(\w+)/);
    return match ? match[1] : null;
  }, [item.type, item.inhoud]);

  const codeContent = useMemo(() => {
    if (!item.inhoud) return "";
    return item.inhoud.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }, [item.inhoud]);

  // Related items: share at least 1 tag with current item
  const relatedItems = useMemo(() => {
    if (!parsedTags.length || !allItems.length) return [];
    return allItems
      .filter((i) => {
        if (i.id === item.id) return false;
        if (!i.aiTags) return false;
        try {
          const tags = JSON.parse(i.aiTags) as string[];
          return tags.some((t) => parsedTags.includes(t));
        } catch {
          return false;
        }
      })
      .slice(0, 4);
  }, [allItems, item.id, parsedTags]);

  // Tag autocomplete suggestions
  const tagSuggestions = useMemo(() => {
    if (!nieuwTag.trim()) return [];
    const lower = nieuwTag.toLowerCase();
    return allTags.filter((t) => t.toLowerCase().includes(lower) && !parsedTags.includes(t)).slice(0, 6);
  }, [nieuwTag, allTags, parsedTags]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleToggleFavoriet = () => {
    updateMutation.mutate(
      { id: item.id, isFavoriet: item.isFavoriet ? 0 : 1 },
      {
        onSuccess: () => {
          addToast(item.isFavoriet ? "Verwijderd uit favorieten" : "Toegevoegd aan favorieten", "succes");
          onUpdate();
        },
      }
    );
  };

  const handleRemoveTag = (tag: string) => {
    const newTags = parsedTags.filter((t) => t !== tag);
    updateMutation.mutate(
      { id: item.id, aiTags: newTags },
      {
        onSuccess: () => {
          addToast("Tag verwijderd", "succes");
          onUpdate();
        },
      }
    );
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || parsedTags.includes(trimmed)) return;
    updateMutation.mutate(
      { id: item.id, aiTags: [...parsedTags, trimmed] },
      {
        onSuccess: () => {
          addToast("Tag toegevoegd", "succes");
          setNieuwTag("");
          setShowTagSuggestions(false);
          onUpdate();
        },
      }
    );
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") addTag(nieuwTag);
    else if (e.key === "Escape") setShowTagSuggestions(false);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      addToast("Kopiëren mislukt", "fout");
    }
  };

  const handleArchiveer = () => {
    deleteMutation.mutate(item.id, {
      onSuccess: () => {
        addToast("Item gearchiveerd", "succes");
        onUpdate();
        onClose();
      },
    });
  };

  const handleMaakTaak = async () => {
    try {
      const res = await fetch("/api/taken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel: item.titel ?? "Taak vanuit Second Brain",
          status: "open",
          prioriteit: "normaal",
        }),
      });
      if (!res.ok) throw new Error("Kon taak niet aanmaken");
      addToast("Taak aangemaakt", "succes");
    } catch {
      addToast("Kon taak niet aanmaken", "fout");
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-6">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-autronis-border/50",
                cfg.color
              )}
            >
              <TypeIcon className="w-3.5 h-3.5" />
              {cfg.label}
            </span>
            <h2 className="text-lg font-semibold text-autronis-text-primary flex-1 min-w-0">
              {item.titel ?? "Zonder titel"}
            </h2>
            <button
              type="button"
              onClick={handleToggleFavoriet}
              className="text-autronis-text-secondary hover:text-yellow-400 transition-colors shrink-0"
              aria-label={item.isFavoriet ? "Verwijder uit favorieten" : "Voeg toe aan favorieten"}
            >
              {item.isFavoriet ? (
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ) : (
                <Star className="w-5 h-5" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-autronis-text-secondary hover:text-autronis-text-primary transition-colors shrink-0"
              aria-label="Sluiten"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body — varies by type */}
          <div className="mb-5">
            {item.type === "afbeelding" && item.bestandPad && (
              <img
                src={item.bestandPad}
                alt={item.titel ?? "Afbeelding"}
                className="rounded-xl max-h-96 object-contain"
              />
            )}
            {item.type === "code" && item.inhoud && (
              <div className="relative">
                <div className="flex items-center justify-between bg-slate-900/80 rounded-t-xl px-4 py-2 border-b border-autronis-border">
                  <span className="text-xs text-autronis-text-secondary font-mono">
                    {codeLanguage ?? "code"}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                  >
                    {codeCopied ? (
                      <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Gekopieerd</span></>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /><span>Kopiëren</span></>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-900/80 rounded-b-xl p-4 overflow-x-auto font-mono text-sm text-emerald-300/80">
                  {codeContent}
                </pre>
              </div>
            )}
            {item.type === "url" && item.bronUrl && (
              <a
                href={item.bronUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-autronis-accent hover:underline flex items-center gap-1 break-all text-sm"
              >
                {item.bronUrl}
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            )}
            {(item.type === "tekst" || item.type === "pdf") && item.inhoud && (
              <p className="text-autronis-text-primary whitespace-pre-wrap text-sm">{item.inhoud}</p>
            )}
          </div>

          {/* AI samenvatting */}
          {item.aiSamenvatting && (
            <div className="bg-autronis-accent/5 border border-autronis-accent/20 rounded-xl p-4 mb-5">
              <p className="text-xs font-medium text-autronis-accent mb-1 uppercase tracking-wide">
                AI Samenvatting
              </p>
              <p className="text-sm text-autronis-text-secondary">{item.aiSamenvatting}</p>
            </div>
          )}

          {/* Tags */}
          <div className="mb-6">
            <p className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wide mb-2">
              Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {parsedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-autronis-accent/10 text-autronis-accent rounded-full px-2.5 py-0.5 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-white transition-colors"
                    aria-label={`Verwijder tag ${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <div className="relative">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={nieuwTag}
                  onChange={(e) => { setNieuwTag(e.target.value); setShowTagSuggestions(true); }}
                  onKeyDown={handleAddTag}
                  onFocus={() => setShowTagSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                  placeholder="+ tag toevoegen"
                  className="bg-transparent text-autronis-text-secondary text-xs outline-none placeholder:text-autronis-text-secondary/50 min-w-[120px]"
                />
                {showTagSuggestions && tagSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 bg-autronis-bg border border-autronis-border rounded-xl shadow-lg z-10 min-w-[160px]">
                    {tagSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={() => addTag(s)}
                        className="w-full text-left px-3 py-1.5 text-xs text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-card transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Integration action buttons */}
          <div className="mb-6">
            <p className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wide mb-2">
              Acties
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleMaakTaak}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/30 border border-autronis-border transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                Maak taak
              </button>
              <a
                href={`/content/posts?onderwerp=${encodeURIComponent(item.titel ?? "")}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/30 border border-autronis-border transition-colors"
              >
                <PenTool className="w-4 h-4" />
                Maak content
              </a>
              <a
                href={`/wiki?bron=second-brain&id=${item.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/30 border border-autronis-border transition-colors"
              >
                <BookMarked className="w-4 h-4" />
                Maak wiki artikel
              </a>
            </div>
          </div>

          {/* Related items */}
          {relatedItems.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wide mb-2">
                Gerelateerd
              </p>
              <div className="space-y-2">
                {relatedItems.map((related) => {
                  const relCfg = typeConfig[related.type] ?? typeConfig.tekst;
                  const RelIcon = relCfg.icon;
                  return (
                    <button
                      key={related.id}
                      type="button"
                      onClick={() => { onClose(); }}
                      className="w-full flex items-center gap-2.5 bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2 hover:border-autronis-accent/30 transition-colors text-left"
                    >
                      <RelIcon className={cn("w-3.5 h-3.5 shrink-0", relCfg.color)} />
                      <span className="text-sm text-autronis-text-secondary truncate flex-1">
                        {related.titel ?? "Zonder titel"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-autronis-border pt-4">
            <span className="text-xs text-autronis-text-secondary tabular-nums">
              {formatDatum(item.aangemaaktOp)}
            </span>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Archiveren
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onBevestig={handleArchiveer}
        titel="Item archiveren?"
        bericht="Dit item wordt gearchiveerd uit je Second Brain."
        bevestigTekst="Archiveren"
      />
    </>
  );
}
