"use client";

import { useState, useEffect } from "react";
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
}

const typeConfig: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  tekst: { icon: FileText, label: "Tekst", color: "text-blue-400" },
  url: { icon: Link2, label: "URL", color: "text-purple-400" },
  afbeelding: { icon: ImageIcon, label: "Afbeelding", color: "text-green-400" },
  pdf: { icon: FileDown, label: "PDF", color: "text-red-400" },
  code: { icon: Code, label: "Code", color: "text-yellow-400" },
};

export function DetailModal({ item, onClose, onUpdate }: DetailModalProps) {
  const { addToast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [nieuwTag, setNieuwTag] = useState("");

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

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const tag = nieuwTag.trim();
    if (!tag || parsedTags.includes(tag)) return;
    updateMutation.mutate(
      { id: item.id, aiTags: [...parsedTags, tag] },
      {
        onSuccess: () => {
          addToast("Tag toegevoegd", "succes");
          setNieuwTag("");
          onUpdate();
        },
      }
    );
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
              <pre className="bg-black/30 rounded-xl p-4 overflow-x-auto font-mono text-sm text-autronis-text-primary">
                {item.inhoud}
              </pre>
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
              <input
                type="text"
                value={nieuwTag}
                onChange={(e) => setNieuwTag(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="+ tag toevoegen"
                className="bg-transparent text-autronis-text-secondary text-xs outline-none placeholder:text-autronis-text-secondary/50 min-w-[120px]"
              />
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
