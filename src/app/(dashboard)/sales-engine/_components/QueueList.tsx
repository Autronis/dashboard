"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Rocket, Trash2, ExternalLink, Zap, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ScanQueueItem } from "../../leads/_components/use-bulk-scan";
import { itemKey } from "./use-scan-queue";

interface QueueListProps {
  items: ScanQueueItem[];
  onRemove: (key: string) => void;
  onClear: () => void;
}

type RowStatus = "idle" | "pending" | "completed" | "failed";

export function QueueList({ items, onRemove, onClear }: QueueListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [isBulkScanning, setIsBulkScanning] = useState(false);

  if (items.length === 0) return null;

  async function scanOne(item: ScanQueueItem): Promise<boolean> {
    const key = itemKey(item);
    setRowStatus((prev) => ({ ...prev, [key]: "pending" }));
    try {
      const res = await fetch("/api/sales-engine/handmatig", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bedrijfsnaam: item.bedrijfsnaam,
          websiteUrl: item.website,
          ...(item.email ? { email: item.email } : {}),
          ...(item.supabaseLeadId ? { supabaseLeadId: item.supabaseLeadId } : {}),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRowStatus((prev) => ({ ...prev, [key]: "completed" }));
      void queryClient.invalidateQueries({ queryKey: ["sales-engine-scans"] });
      // Remove from queue after a short delay so the user sees the green flash
      setTimeout(() => onRemove(key), 400);
      return true;
    } catch {
      setRowStatus((prev) => ({ ...prev, [key]: "failed" }));
      return false;
    }
  }

  async function scanAll() {
    setIsBulkScanning(true);
    let ok = 0;
    let fail = 0;
    for (const item of items) {
      const key = itemKey(item);
      if (rowStatus[key] === "completed") continue;
      const success = await scanOne(item);
      if (success) ok++;
      else fail++;
    }
    setIsBulkScanning(false);
    addToast(
      `${ok} scans gestart${fail > 0 ? `, ${fail} mislukt` : ""}`,
      ok > 0 ? "succes" : "fout",
    );
  }

  function hostnameOf(url: string): string {
    try {
      return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    } catch {
      return url;
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--card)] rounded-xl border border-autronis-accent/30 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-autronis-border bg-autronis-accent/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Rocket className="w-4 h-4 text-autronis-accent flex-shrink-0" />
          <h3 className="text-sm font-semibold text-autronis-text-primary">
            Klaar om te scannen
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-autronis-accent text-autronis-bg tabular-nums">
            {items.length}
          </span>
          <span className="text-xs text-autronis-text-secondary hidden sm:inline">
            &middot; toegevoegd uit leads, contacten, website-leads, klanten
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={scanAll}
            disabled={isBulkScanning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
          >
            {isBulkScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Alle {items.length} scannen
          </button>
          <button
            onClick={onClear}
            disabled={isBulkScanning}
            title="Queue leegmaken"
            className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="divide-y divide-autronis-border/50 max-h-[420px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const key = itemKey(item);
            const status: RowStatus = rowStatus[key] ?? "idle";
            const isPending = status === "pending";
            const isDone = status === "completed";
            const isFail = status === "failed";

            return (
              <motion.div
                key={key}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 transition-colors",
                  isDone && "bg-emerald-500/5",
                  isFail && "bg-red-500/5",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-autronis-text-primary truncate">
                    {item.bedrijfsnaam}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-autronis-text-secondary">
                    <span className="flex items-center gap-1 truncate">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      {hostnameOf(item.website)}
                    </span>
                    {item.email && <span className="truncate hidden md:inline">{item.email}</span>}
                  </div>
                </div>
                {isPending && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Bezig
                  </span>
                )}
                {isDone && (
                  <span className="text-xs text-emerald-400 font-medium">Gestart</span>
                )}
                {isFail && (
                  <span className="text-xs text-red-400 font-medium">Mislukt</span>
                )}
                {!isPending && !isDone && (
                  <>
                    <button
                      onClick={() => void scanOne(item)}
                      disabled={isBulkScanning}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-autronis-accent/10 border border-autronis-accent/30 text-autronis-accent text-xs font-medium hover:bg-autronis-accent/20 transition-colors disabled:opacity-40"
                    >
                      <Zap className="w-3 h-3" />
                      Scan
                    </button>
                    <button
                      onClick={() => onRemove(key)}
                      disabled={isBulkScanning}
                      title="Uit queue verwijderen"
                      className="p-1 rounded-lg text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
