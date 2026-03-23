"use client";

import { useState, useCallback } from "react";
import { Send, Loader2, AlertCircle, Square } from "lucide-react";
import { useOrchestrator } from "./orchestrator-store";

export function CommandInput() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { submitCommand, isProcessing, executingTaskId, killExecution } = useOrchestrator();

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || isProcessing) return;
    setValue("");
    setError(null);
    try {
      await submitCommand(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opdracht mislukt");
    }
  }, [value, isProcessing, submitCommand]);

  return (
    <div className="relative flex items-center gap-2">
      <div className="flex-1 relative">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Geef een opdracht aan het team..."
          disabled={isProcessing}
          className="w-full px-4 py-2.5 rounded-xl bg-autronis-card border border-autronis-border/50 text-sm text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 disabled:opacity-50 transition-colors"
        />
        {isProcessing && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-autronis-accent">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-[10px] font-medium">Theo maakt plan...</span>
          </div>
        )}
      </div>
      {executingTaskId ? (
        <button
          onClick={() => killExecution()}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
          title="Stop uitvoering"
        >
          <Square className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isProcessing}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      )}
      {error && (
        <div className="absolute -bottom-8 left-0 flex items-center gap-1 text-red-400 text-[11px]">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}
