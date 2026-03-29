"use client";

import { useState, useCallback, useRef, useEffect, useMemo, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  FileText,
  Link2,
  Image as ImageIcon,
  FileDown,
  Code,
  TrendingUp,
  Paperclip,
  Send,
  Star,
  BookOpen,
  ArrowUpDown,
  Upload,
  CheckSquare,
  PenTool,
  Archive,
  Terminal,
  Camera,
  Clipboard,
  Loader2,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useSecondBrain,
  useCreateSecondBrainItem,
  useVerwerkenSecondBrain,
  useUpdateSecondBrainItem,
  useDeleteSecondBrainItem,
  type SecondBrainItem,
} from "@/hooks/queries/use-second-brain";
import { useQueryClient } from "@tanstack/react-query";
import { AiZoekenTab } from "./ai-zoeken-tab";
import { DetailModal } from "./detail-modal";
import { VideoTab } from "./video-tab";

const typeConfig = {
  tekst: { icon: FileText, label: "Tekst", color: "text-slate-400", bg: "bg-slate-500/15", border: "border-slate-500/20", accent: "#94a3b8" },
  url: { icon: Link2, label: "URL", color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/20", accent: "#60a5fa" },
  afbeelding: { icon: Camera, label: "Afbeelding", color: "text-purple-400", bg: "bg-purple-500/15", border: "border-purple-500/20", accent: "#c084fc" },
  pdf: { icon: FileDown, label: "PDF", color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/20", accent: "#f87171" },
  code: { icon: Terminal, label: "Code", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/20", accent: "#34d399" },
} as const;

// Tag category coloring
const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  technologie: { bg: "bg-autronis-accent/10", text: "text-autronis-accent" },
  tool: { bg: "bg-autronis-accent/10", text: "text-autronis-accent" },
  proces: { bg: "bg-autronis-accent/10", text: "text-autronis-accent" },
  klant: { bg: "bg-amber-500/10", text: "text-amber-400" },
  referentie: { bg: "bg-amber-500/10", text: "text-amber-400" },
  idee: { bg: "bg-purple-500/10", text: "text-purple-400" },
  inspiratie: { bg: "bg-purple-500/10", text: "text-purple-400" },
  "geleerde-les": { bg: "bg-orange-500/10", text: "text-orange-400" },
};
function tagKleur(tag: string): { bg: string; text: string } {
  const lower = tag.toLowerCase();
  for (const [key, val] of Object.entries(TAG_COLORS)) {
    if (lower === key || lower.includes(key)) return val;
  }
  return { bg: "bg-autronis-accent/10", text: "text-autronis-accent" };
}

// Optimistic item type
interface OptimisticItem extends SecondBrainItem {
  _optimistic?: true;
}

type TypeKey = keyof typeof typeConfig;
type SortMode = "nieuwste" | "meest-gebruikt" | "favorieten";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export default function SecondBrainPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"feed" | "zoeken" | "video">("feed");
  const [typeFilter, setTypeFilter] = useState("alle");
  const [tagFilter, setTagFilter] = useState("");
  const [zoek, setZoek] = useState("");
  const [favoriet, setFavoriet] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OptimisticItem | null>(null);
  const [nieuwInput, setNieuwInput] = useState("");
  const [detectedType, setDetectedType] = useState<TypeKey | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("nieuwste");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [needsRefetch, setNeedsRefetch] = useState(false);
  const [optimisticItems, setOptimisticItems] = useState<OptimisticItem[]>([]);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<Record<string, "pending" | "done" | "fout">>({});
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);

  const { data, isLoading } = useSecondBrain(typeFilter, tagFilter, zoek, favoriet, needsRefetch ? 3000 : false);
  const createMutation = useCreateSecondBrainItem();
  const verwerkenMutation = useVerwerkenSecondBrain();
  const updateMutation = useUpdateSecondBrainItem();
  const deleteMutation = useDeleteSecondBrainItem();

  const serverItems = data?.items ?? [];
  const kpis = data?.kpis;

  // Merge optimistic items (remove once they appear in server data)
  const items = useMemo(() => {
    const serverIds = new Set(serverItems.map((i) => i.id));
    const stillOptimistic = optimisticItems.filter((o) => !serverIds.has(o.id));
    return [...stillOptimistic, ...serverItems] as OptimisticItem[];
  }, [serverItems, optimisticItems]);

  // Stop polling when all visible items have AI tags
  useEffect(() => {
    if (needsRefetch && serverItems.length > 0 && serverItems.every((item) => item.aiTags !== null)) {
      setNeedsRefetch(false);
    }
  }, [needsRefetch, serverItems]);

  // Remove optimistic items when they appear in server data
  useEffect(() => {
    const serverIds = new Set(serverItems.map((i) => i.id));
    setOptimisticItems((prev) => prev.filter((o) => !serverIds.has(o.id)));
  }, [serverItems]);

  // Keep selectedItem in sync with query data
  useEffect(() => {
    if (selectedItem) {
      const updated = items.find((i) => i.id === selectedItem.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedItem)) {
        setSelectedItem(updated);
      }
    }
  }, [items, selectedItem]);

  // Clipboard URL detection
  useEffect(() => {
    async function detectClipboardUrl() {
      try {
        const text = await navigator.clipboard.readText();
        if (/^https?:\/\//.test(text.trim()) && text.trim() !== clipboardUrl) {
          setClipboardUrl(text.trim());
        } else if (clipboardUrl && !/^https?:\/\//.test(text.trim())) {
          setClipboardUrl(null);
        }
      } catch {
        // Clipboard access not granted
      }
    }
    const interval = setInterval(detectClipboardUrl, 2000);
    return () => clearInterval(interval);
  }, [clipboardUrl]);

  // Auto-detect type from input
  useEffect(() => {
    const input = nieuwInput.trim();
    if (/^https?:\/\//.test(input)) {
      setDetectedType("url");
    } else if (input.startsWith("```")) {
      setDetectedType("code");
    } else {
      setDetectedType(null);
    }
  }, [nieuwInput]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text/plain").trim();
    if (/^https?:\/\//.test(text)) {
      setDetectedType("url");
    } else if (text.startsWith("```")) {
      setDetectedType("code");
    }
  }, []);

  const addOptimisticItem = useCallback((type: TypeKey, input: string) => {
    const fakeId = -(Date.now());
    const optimistic: OptimisticItem = {
      id: fakeId,
      gebruikerId: 0,
      type,
      titel: input.slice(0, 60) || "Opslaan...",
      inhoud: type !== "url" ? input : null,
      aiSamenvatting: null,
      aiTags: null,
      bronUrl: type === "url" ? input : null,
      bestandPad: null,
      taal: null,
      isFavoriet: 0,
      isGearchiveerd: 0,
      aangemaaktOp: new Date().toISOString(),
      bijgewerktOp: new Date().toISOString(),
      _optimistic: true,
    };
    setOptimisticItems((prev) => [optimistic, ...prev]);
    return fakeId;
  }, []);

  const handleSubmit = useCallback(async () => {
    const input = nieuwInput.trim();
    if (!input) return;

    const isUrl = /^https?:\/\//.test(input);
    const isCode = input.startsWith("```");
    const type: TypeKey = isUrl ? "url" : isCode ? "code" : "tekst";
    const resolvedLabel = typeConfig[type].label;

    addOptimisticItem(type, input);
    setNieuwInput("");
    setDetectedType(null);

    const onSuccess = () => {
      addToast(`${resolvedLabel} opgeslagen · AI verwerkt...`, "succes");
      setNeedsRefetch(true);
    };
    const onError = () => addToast("Kon item niet opslaan", "fout");

    if (isUrl) {
      verwerkenMutation.mutate({ bronUrl: input }, { onSuccess, onError });
    } else if (isCode) {
      createMutation.mutate({ type: "code", inhoud: input }, { onSuccess, onError });
    } else {
      createMutation.mutate({ type: "tekst", inhoud: input }, { onSuccess, onError });
    }
  }, [nieuwInput, verwerkenMutation, createMutation, addToast, addOptimisticItem]);

  const handleFileUpload = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      const initial: Record<string, "pending" | "done" | "fout"> = {};
      files.forEach((f) => { initial[f.name] = "pending"; });
      setBatchProgress(initial);

      files.forEach((file) => {
        const formData = new FormData();
        formData.append("file", file);
        if (file.type.startsWith("image/")) {
          formData.append("type", "afbeelding");
        } else if (file.type === "application/pdf") {
          formData.append("type", "pdf");
        } else {
          formData.append("type", "tekst");
        }
        verwerkenMutation.mutate(formData, {
          onSuccess: () => {
            setBatchProgress((prev) => ({ ...prev, [file.name]: "done" }));
            setNeedsRefetch(true);
          },
          onError: () => {
            setBatchProgress((prev) => ({ ...prev, [file.name]: "fout" }));
            addToast(`Uploaden mislukt: ${file.name}`, "fout");
          },
        });
      });

      setTimeout(() => setBatchProgress({}), 4000);
    },
    [verwerkenMutation, addToast]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;
      handleFileUpload(files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files);
      }
    },
    [handleFileUpload]
  );

  const toggleFavoriet = useCallback(
    (item: SecondBrainItem) => {
      updateMutation.mutate({ id: item.id, isFavoriet: item.isFavoriet ? 0 : 1 });
    },
    [updateMutation]
  );

  // Collect unique tags with frequency from all items
  const tagFrequency = useMemo(() => {
    const freq = new Map<string, number>();
    items.forEach((item) => {
      if (!item.aiTags) return;
      try {
        const tags = JSON.parse(item.aiTags) as string[];
        tags.forEach((tag) => freq.set(tag, (freq.get(tag) ?? 0) + 1));
      } catch {
        // skip
      }
    });
    return freq;
  }, [items]);

  const allTags = useMemo(
    () => Array.from(tagFrequency.entries()).sort((a, b) => b[1] - a[1]),
    [tagFrequency]
  );

  const maxTagFreq = allTags.length > 0 ? allTags[0][1] : 1;

  // Sort items
  const sortedItems = useMemo(() => {
    const copy = [...items];
    switch (sortMode) {
      case "favorieten":
        copy.sort((a, b) => b.isFavoriet - a.isFavoriet || new Date(b.aangemaaktOp).getTime() - new Date(a.aangemaaktOp).getTime());
        break;
      case "meest-gebruikt":
        // Sort by number of tags (proxy for "most processed/used")
        copy.sort((a, b) => {
          const tagsA = a.aiTags ? (JSON.parse(a.aiTags) as string[]).length : 0;
          const tagsB = b.aiTags ? (JSON.parse(b.aiTags) as string[]).length : 0;
          return tagsB - tagsA || new Date(b.aangemaaktOp).getTime() - new Date(a.aangemaaktOp).getTime();
        });
        break;
      default:
        // nieuwste eerst — already sorted from API
        break;
    }
    return copy;
  }, [items, sortMode]);

  // Daily review stats
  const dailyReview = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const gisteren = items.filter(
      (i) => i.aangemaaktOp.split("T")[0] === yesterdayStr
    ).length;

    const dezeWeekItems = items.filter(
      (i) => new Date(i.aangemaaktOp) >= weekAgo
    );

    // Find top tag this week
    const weekTags = new Map<string, number>();
    dezeWeekItems.forEach((item) => {
      if (!item.aiTags) return;
      try {
        const tags = JSON.parse(item.aiTags) as string[];
        tags.forEach((t) => weekTags.set(t, (weekTags.get(t) ?? 0) + 1));
      } catch {
        // skip
      }
    });
    const topTag = weekTags.size > 0
      ? Array.from(weekTags.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    return { gisteren, dezeWeek: dezeWeekItems.length, topTag };
  }, [items]);

  // Most used type
  const meestGebruiktType =
    kpis?.perType
      ? (Object.entries(kpis.perType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—")
      : "—";

  const meestGebruiktLabel =
    meestGebruiktType !== "—" && meestGebruiktType in typeConfig
      ? typeConfig[meestGebruiktType as TypeKey].label
      : meestGebruiktType;

  return (
    <PageTransition>
      <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-autronis-accent/10">
            <Brain className="w-6 h-6 text-autronis-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary">Second Brain</h1>
            <p className="text-sm text-autronis-text-secondary">Jouw persoonlijke kennisbank</p>
          </div>
        </div>

        {/* Daily Review Strip */}
        {(dailyReview.gisteren > 0 || dailyReview.dezeWeek > 0) && (
          <div className="bg-autronis-accent/5 border border-autronis-accent/15 rounded-2xl p-4 flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-autronis-accent shrink-0" />
            <div className="text-sm text-autronis-text-secondary">
              {dailyReview.gisteren > 0 && (
                <span>
                  Gisteren heb je <span className="text-autronis-text-primary font-medium">{dailyReview.gisteren} {dailyReview.gisteren === 1 ? "item" : "items"}</span> opgeslagen.{" "}
                </span>
              )}
              {dailyReview.dezeWeek > 0 && (
                <span>
                  Deze week: <span className="text-autronis-text-primary font-medium">{dailyReview.dezeWeek} nieuwe {dailyReview.dezeWeek === 1 ? "item" : "items"}</span>
                  {dailyReview.topTag && (
                    <> over <span className="text-autronis-accent font-medium">{dailyReview.topTag}</span></>
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {/* KPI strip */}
        <motion.div
          className="grid grid-cols-3 gap-3"
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          initial="hidden"
          animate="visible"
        >
          {[
            { icon: Brain, label: "Totaal items", value: kpis?.totaal ?? "—", color: "text-autronis-text-primary" },
            { icon: TrendingUp, label: "Deze week", value: kpis?.dezeWeek ?? "—", color: "text-autronis-accent" },
            { icon: FileText, label: "Meest gebruikt", value: meestGebruiktLabel, color: "text-purple-400" },
          ].map(({ icon: Icon, label, value, color }) => (
            <motion.div
              key={label}
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.22 } } }}
              className="bg-autronis-card border border-autronis-border rounded-xl p-3.5 card-glow"
            >
              <p className="text-[11px] text-autronis-text-secondary mb-1 flex items-center gap-1.5">
                <Icon className="w-3 h-3" />
                {label}
              </p>
              <p className={cn("text-xl font-bold tabular-nums", color)}>{value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Quick-add bar — larger & more prominent */}
        <div
          className={cn(
            "bg-autronis-card border rounded-2xl p-5 space-y-3 relative transition-colors duration-200",
            isDragging ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.12)]" : "border-autronis-border"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <AnimatePresence>
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rounded-2xl bg-emerald-500/6 border-2 border-dashed border-emerald-400/60 flex items-center justify-center z-10 pointer-events-none"
              >
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <Upload className="w-5 h-5" />
                  Loslaten om op te slaan
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Clipboard URL banner */}
          <AnimatePresence>
            {clipboardUrl && !nieuwInput.trim() && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3 py-2"
              >
                <Clipboard className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-sm text-blue-300 truncate flex-1">
                  URL gedetecteerd: <span className="opacity-60">{extractDomain(clipboardUrl)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => { setNieuwInput(clipboardUrl); setClipboardUrl(null); }}
                  className="text-xs font-medium text-blue-400 hover:text-blue-200 transition-colors shrink-0 underline underline-offset-2"
                >
                  Opslaan?
                </button>
                <button
                  type="button"
                  onClick={() => setClipboardUrl(null)}
                  className="text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors shrink-0 ml-1"
                >
                  ×
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1.5">
              <textarea
                className="w-full bg-transparent text-lg text-autronis-text-primary placeholder:text-autronis-text-secondary/50 outline-none resize-none min-h-[52px]"
                placeholder="Plak tekst, URL, of code snippet..."
                rows={2}
                value={nieuwInput}
                onChange={(e) => setNieuwInput(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || !e.shiftKey)) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              {nieuwInput.trim() && (
                <p className="text-[11px] text-autronis-text-secondary/40">Ctrl+Enter of Enter om op te slaan · Shift+Enter voor nieuwe regel</p>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              {detectedType && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
                    typeConfig[detectedType].bg,
                    typeConfig[detectedType].color,
                    typeConfig[detectedType].border,
                  )}
                >
                  {(() => { const Icon = typeConfig[detectedType].icon; return <Icon className="w-3 h-3" />; })()}
                  {typeConfig[detectedType].label}
                </span>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                type="button"
                aria-label="Bestand uploaden"
              >
                <Paperclip className="w-5 h-5 text-autronis-text-secondary hover:text-autronis-accent transition-colors" />
              </button>
              <button
                onClick={handleSubmit}
                disabled={!nieuwInput.trim()}
                type="button"
                aria-label="Opslaan"
                className="disabled:opacity-40 transition-opacity"
              >
                <Send className="w-5 h-5 text-autronis-accent" />
              </button>
            </div>
          </div>

          {/* Batch progress indicator */}
          {Object.keys(batchProgress).length > 0 && (
            <div className="space-y-1.5">
              {Object.entries(batchProgress).map(([name, status]) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    status === "pending" ? "bg-autronis-accent animate-pulse" :
                    status === "done" ? "bg-emerald-400" : "bg-red-400"
                  )} />
                  <span className="text-autronis-text-secondary truncate flex-1">{name}</span>
                  <span className={cn(
                    status === "pending" ? "text-autronis-text-secondary" :
                    status === "done" ? "text-emerald-400" : "text-red-400"
                  )}>
                    {status === "pending" ? "Verwerken..." : status === "done" ? "Klaar" : "Mislukt"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Upload hint */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-autronis-text-secondary/50 hover:text-autronis-text-secondary transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Sleep bestanden hierheen of klik om te uploaden
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>

        {/* Tab buttons */}
        <div className="flex gap-2 border-b border-autronis-border pb-0">
          <button
            onClick={() => setActiveTab("feed")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === "feed"
                ? "text-autronis-accent border-autronis-accent"
                : "text-autronis-text-secondary border-transparent hover:text-autronis-text-primary"
            )}
          >
            Feed
            {items.length > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums",
                activeTab === "feed" ? "bg-autronis-accent/20 text-autronis-accent" : "bg-autronis-border text-autronis-text-secondary"
              )}>
                {items.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("zoeken")}
            className={cn(
              "px-4 py-2.5 rounded-t-xl text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === "zoeken"
                ? "text-autronis-accent border-autronis-accent"
                : "text-autronis-text-secondary border-transparent hover:text-autronis-text-primary"
            )}
          >
            AI Zoeken
          </button>
          <button
            onClick={() => setActiveTab("video")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === "video"
                ? "text-autronis-accent border-autronis-accent"
                : "text-autronis-text-secondary border-transparent hover:text-autronis-text-primary"
            )}
          >
            Video&apos;s
          </button>
        </div>

        {/* Feed tab */}
        {activeTab === "feed" && (
          <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary pointer-events-none" />
              <input
                type="text"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder="Zoek in je kennisbank..."
                className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-9 pr-9 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
              />
              {zoek && (
                <button onClick={() => setZoek("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors" />
                </button>
              )}
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Type filters with icons */}
              <button
                onClick={() => setTypeFilter("alle")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  typeFilter === "alle"
                    ? "bg-autronis-accent text-white"
                    : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                Alle
              </button>
              {(Object.entries(typeConfig) as [TypeKey, (typeof typeConfig)[TypeKey]][]).map(
                ([key, cfg]) => {
                  const Icon = cfg.icon;
                  const isActive = typeFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setTypeFilter(key)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        isActive
                          ? "bg-autronis-accent text-white"
                          : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </button>
                  );
                }
              )}

              {/* Favoriet toggle */}
              <button
                onClick={() => setFavoriet((prev) => !prev)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5",
                  favoriet
                    ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/30"
                    : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                <Star className="w-3 h-3" />
                Favorieten
              </button>

              {/* Sort chips */}
              <div className="ml-auto flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-autronis-text-secondary shrink-0" />
                {(["nieuwste", "meest-gebruikt", "favorieten"] as SortMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs transition-colors",
                      sortMode === mode
                        ? "bg-autronis-accent/20 text-autronis-accent font-medium"
                        : "text-autronis-text-secondary hover:text-autronis-text-primary"
                    )}
                  >
                    {mode === "nieuwste" ? "Nieuwst" : mode === "meest-gebruikt" ? "Gebruik" : "Favoriet"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag cloud */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                {tagFilter && (
                  <button
                    onClick={() => setTagFilter("")}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    {tagFilter}
                  </button>
                )}
                {allTags.map(([tag, freq]) => {
                  const isTop = freq === maxTagFreq;
                  const isActive = tagFilter === tag;
                  // Scale font size by frequency: min 0.7rem, max 0.95rem
                  const scale = 0.7 + (freq / maxTagFreq) * 0.25;
                  return (
                    <button
                      key={tag}
                      onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                      style={{ fontSize: `${scale}rem` }}
                      className={cn(
                        "px-2.5 py-0.5 rounded-full transition-colors font-medium",
                        isActive
                          ? "bg-autronis-accent text-white"
                          : isTop
                            ? "bg-autronis-accent/20 text-autronis-accent hover:bg-autronis-accent/30"
                            : "bg-autronis-accent/10 text-autronis-accent hover:bg-autronis-accent/20"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Loading skeletons */}
            {isLoading && (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-autronis-card border border-autronis-border rounded-2xl p-5 animate-pulse"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded bg-autronis-border mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-autronis-border rounded w-1/2" />
                        <div className="h-3 bg-autronis-border rounded w-3/4" />
                        <div className="h-3 bg-autronis-border rounded w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && items.length === 0 && (
              <EmptyState
                icoon={<Brain className="w-7 h-7 text-autronis-text-secondary" />}
                titel="Nog niets opgeslagen"
                beschrijving="Typ een notitie, plak een URL of upload een bestand om te beginnen."
              />
            )}

            {/* Feed items — type-specific previews */}
            {!isLoading && sortedItems.length > 0 && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.045 } } }}
                className="space-y-3"
              >
                {sortedItems.map((item) => {
                  const cfg = typeConfig[item.type as TypeKey] ?? typeConfig.tekst;
                  const TypeIcon = cfg.icon;
                  let tags: string[] = [];
                  if (item.aiTags) {
                    try {
                      tags = JSON.parse(item.aiTags) as string[];
                    } catch {
                      tags = [];
                    }
                  }

                  return (
                    <motion.div
                      key={item.id}
                      variants={{
                        hidden: { opacity: 0, y: 10 },
                        visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
                      }}
                      layout
                      className="relative group"
                      onHoverStart={() => !item._optimistic && setHoveredItemId(item.id)}
                      onHoverEnd={() => setHoveredItemId(null)}
                    >
                      {/* Card */}
                      <div
                        className={cn(
                          "bg-autronis-card border rounded-2xl p-5 transition-colors card-glow overflow-hidden relative pl-6",
                          item._optimistic
                            ? "border-autronis-accent/20 opacity-55 pointer-events-none"
                            : "border-autronis-border hover:border-autronis-accent/30 cursor-pointer"
                        )}
                        style={{ borderLeft: `3px solid ${cfg.accent}40` }}
                        onClick={() => !item._optimistic && setSelectedItem(item)}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ backgroundColor: cfg.accent }} />
                        <div className="flex items-start gap-3">
                          {/* Type badge */}
                          <div className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-lg shrink-0 border mt-0.5",
                            cfg.bg, cfg.border
                          )}>
                            <TypeIcon className={cn("w-3.5 h-3.5", cfg.color)} />
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Type-specific preview */}
                            {item.type === "url" && (
                              <>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-autronis-text-primary font-medium truncate">
                                    {item.titel ?? "Zonder titel"}
                                  </h3>
                                  {item.bronUrl && (
                                    <span className="text-xs text-blue-400/60 shrink-0">
                                      {extractDomain(item.bronUrl)}
                                    </span>
                                  )}
                                </div>
                                {item.aiSamenvatting && (
                                  <p className="text-autronis-text-secondary text-sm mt-1 line-clamp-2">
                                    {item.aiSamenvatting}
                                  </p>
                                )}
                              </>
                            )}

                            {item.type === "code" && (
                              <>
                                <h3 className="text-autronis-text-primary font-medium truncate">
                                  {item.titel ?? "Code snippet"}
                                </h3>
                                {item.inhoud && (
                                  <pre className="bg-slate-900 rounded-lg p-2.5 mt-1.5 overflow-hidden font-mono text-xs text-emerald-300/70 line-clamp-3">
                                    {item.inhoud.replace(/^```\w*\n?/, "").replace(/```$/, "").slice(0, 300)}
                                  </pre>
                                )}
                              </>
                            )}

                            {item.type === "tekst" && (
                              <>
                                <h3 className="text-autronis-text-primary font-medium truncate">
                                  {item.titel ?? "Zonder titel"}
                                </h3>
                                {item.inhoud && (
                                  <p className="text-autronis-text-secondary text-sm mt-1 line-clamp-2">
                                    {item.inhoud.slice(0, 200)}
                                  </p>
                                )}
                              </>
                            )}

                            {item.type === "afbeelding" && (
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-autronis-text-primary font-medium truncate">
                                    {item.titel ?? "Afbeelding"}
                                  </h3>
                                  {item.aiSamenvatting && (
                                    <p className="text-autronis-text-secondary text-sm mt-1 line-clamp-2">
                                      {item.aiSamenvatting}
                                    </p>
                                  )}
                                </div>
                                {item.bestandPad && (
                                  <img
                                    src={item.bestandPad}
                                    alt={item.titel ?? "Afbeelding"}
                                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                                  />
                                )}
                              </div>
                            )}

                            {item.type === "pdf" && (
                              <>
                                <h3 className="text-autronis-text-primary font-medium truncate">
                                  {item.titel ?? "PDF document"}
                                </h3>
                                {item.aiSamenvatting && (
                                  <p className="text-autronis-text-secondary text-sm mt-1 line-clamp-2">
                                    {item.aiSamenvatting}
                                  </p>
                                )}
                              </>
                            )}

                            {/* Tags row */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {tags.length > 0 ? (
                                tags.map((tag) => {
                                  const kleur = tagKleur(tag);
                                  return (
                                    <motion.span
                                      key={tag}
                                      initial={{ opacity: 0, scale: 0.85 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ duration: 0.18 }}
                                      className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", kleur.bg, kleur.text)}
                                    >
                                      {tag}
                                    </motion.span>
                                  );
                                })
                              ) : (
                                <span className="flex items-center gap-1.5 bg-autronis-border/50 rounded-full px-2.5 py-0.5 text-xs text-autronis-text-secondary">
                                  <motion.span
                                    animate={{ opacity: [1, 0.35, 1] }}
                                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                                    className="flex items-center"
                                  >
                                    <Brain className="w-3 h-3" />
                                  </motion.span>
                                  AI verwerkt...
                                </span>
                              )}
                              <span className="text-autronis-text-secondary text-xs ml-auto tabular-nums">
                                {formatDatum(item.aangemaaktOp)}
                              </span>
                            </div>
                          </div>

                          {/* Favorite star */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleFavoriet(item); }}
                            className="text-autronis-text-secondary hover:text-yellow-400 transition-colors shrink-0"
                            aria-label={item.isFavoriet ? "Verwijder uit favorieten" : "Voeg toe aan favorieten"}
                          >
                            {item.isFavoriet ? (
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            ) : (
                              <Star className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Quick-action hover strip */}
                      <AnimatePresence>
                        {hoveredItemId === item.id && (
                          <motion.div
                            initial={{ opacity: 0, y: -2, scaleX: 0.96 }}
                            animate={{ opacity: 1, y: 0, scaleX: 1 }}
                            exit={{ opacity: 0, y: -2, scaleX: 0.96 }}
                            transition={{ duration: 0.15 }}
                            className="flex justify-center mt-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-0.5 bg-autronis-bg border border-autronis-border rounded-xl px-2 py-1 shadow-lg">
                              <button
                                type="button"
                                onClick={() => toggleFavoriet(item)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-autronis-text-secondary hover:text-yellow-400 hover:bg-yellow-400/8 transition-colors"
                              >
                                <Star className="w-3.5 h-3.5" />
                                <span>Favoriet</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateMutation.mutate({ id: item.id, isGearchiveerd: 1 });
                                  addToast("Gearchiveerd", "succes");
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/8 transition-colors"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>Archiveer</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => { window.location.href = `/taken?nieuw=1&bron=second-brain&id=${item.id}`; }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/8 transition-colors"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span>Taak</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => { window.location.href = `/content?bron=second-brain&id=${item.id}`; }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-autronis-text-secondary hover:text-purple-400 hover:bg-purple-400/8 transition-colors"
                              >
                                <PenTool className="w-3.5 h-3.5" />
                                <span>Content</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteMutation.mutate(item.id, {
                                    onSuccess: () => addToast("Verwijderd", "succes"),
                                    onError: () => addToast("Verwijderen mislukt", "fout"),
                                  });
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-autronis-text-secondary hover:text-red-400 hover:bg-red-400/8 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>
        )}

        {/* AI Zoeken tab */}
        {activeTab === "zoeken" && (
          <AiZoekenTab onSelectItem={(item) => setSelectedItem(item)} />
        )}

        {activeTab === "video" && <VideoTab />}

        {/* Detail modal */}
        {selectedItem && (
          <DetailModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ["second-brain"] })}
            allItems={serverItems}
            allTags={allTags.map(([tag]) => tag)}
          />
        )}
      </div>
    </PageTransition>
  );
}
