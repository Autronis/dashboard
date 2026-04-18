"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Rocket, Trash2, ExternalLink, Zap, X, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ScanQueueItem } from "../../leads/_components/use-bulk-scan";
import { itemKey } from "./use-scan-queue";

interface QueueListProps {
  items: ScanQueueItem[];
  onRemove: (key: string) => void;
  onClear: () => void;
  onResetDismissed: () => void;
  autoFillLoading: boolean;
}

type RowStatus = "idle" | "pending" | "completed" | "failed";

export function QueueList({ items, onRemove, onClear, onResetDismissed, autoFillLoading }: QueueListProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [isBulkScanning, setIsBulkScanning] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const BULK_CONFIRM_THRESHOLD = 20;
  const ESTIMATED_COST_PER_SCAN_EUR = 0.05; // ruwe schatting Anthropic kosten per scan

  if (items.length === 0 && !autoFillLoading) {
    return (
      <div className="bg-[var(--card)] rounded-xl border border-autronis-border px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-sm text-autronis-text-secondary">
          <Rocket className="w-4 h-4 text-autronis-text-tertiary" />
          <span>Queue is leeg — alle leads met website zijn al gescand of verwijderd.</span>
        </div>
        <button
          onClick={onResetDismissed}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-bg border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
          title="Verwijderde items weer terugzetten"
        >
          <RotateCcw className="w-3 h-3" />
          Reset queue
        </button>
      </div>
    );
  }

  if (items.length === 0 && autoFillLoading) {
    return (
      <div className="bg-[var(--card)] rounded-xl border border-autronis-border px-5 py-6 flex items-center justify-center gap-2 text-sm text-autronis-text-secondary">
        <Loader2 className="w-4 h-4 animate-spin text-autronis-accent" />
        Queue wordt gevuld met alle leads met website &hellip;
      </div>
    );
  }

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

  async function handleScanAllClick() {
    if (items.length > BULK_CONFIRM_THRESHOLD) {
      setConfirmBulk(true);
      return;
    }
    await scanAll();
  }

  async function scanAll() {
    setConfirmBulk(false);
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
            onClick={() => void handleScanAllClick()}
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
      <AnimatePresence>
        {confirmBulk && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setConfirmBulk(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              className="bg-autronis-card rounded-2xl border border-autronis-border max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-autronis-text-primary">
                    {items.length} scans starten?
                  </h3>
                  <p className="text-sm text-autronis-text-secondary mt-1">
                    Dit kost ongeveer{" "}
                    <span className="font-semibold text-autronis-text-primary">
                      €{(items.length * ESTIMATED_COST_PER_SCAN_EUR).toFixed(2)}
                    </span>{" "}
                    aan Anthropic credits en duurt zo&apos;n{" "}
                    <span className="font-semibold text-autronis-text-primary">
                      {Math.ceil((items.length * 30) / 60)} minuten
                    </span>{" "}
                    om af te ronden. Scan eerst een batch van 10-20 om de output te valideren.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmBulk(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={() => void scanAll()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-autronis-accent text-autronis-bg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Ja, scan alle {items.length}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
