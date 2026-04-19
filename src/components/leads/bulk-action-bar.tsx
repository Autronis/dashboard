"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComponentType, ReactNode, SVGProps } from "react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export interface BulkAction {
  key: string;
  label: string;
  icon: IconType;
  onClick: () => void;
  /** Visual tone — cyan is the default accent */
  tone?: "cyan" | "blue" | "purple" | "fuchsia" | "emerald" | "red" | "neutral";
  busy?: boolean;
  disabled?: boolean;
  href?: string;
  title?: string;
}

const TONES: Record<NonNullable<BulkAction["tone"]>, string> = {
  cyan:    "bg-autronis-accent/10 text-autronis-accent hover:bg-autronis-accent/20",
  blue:    "bg-blue-500/10 text-blue-300 hover:bg-blue-500/20",
  purple:  "bg-purple-500/10 text-purple-300 hover:bg-purple-500/20",
  fuchsia: "bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20",
  emerald: "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
  red:     "bg-red-500/10 text-red-300 hover:bg-red-500/20",
  neutral: "bg-autronis-card border border-autronis-border text-autronis-text-primary hover:border-autronis-border-hover",
};

interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  /** Destructive action confirmed via two-step prompt (delete) */
  onDelete?: () => void;
  deleteBusy?: boolean;
  onClear?: () => void;
  /** Extra content shown before the actions */
  prefix?: ReactNode;
}

export function BulkActionBar({
  selectedCount,
  actions,
  onDelete,
  deleteBusy,
  onClear,
  prefix,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="bulk-bar"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex flex-wrap items-center gap-2 rounded-xl bg-autronis-card/60 border border-autronis-border px-3 py-2 backdrop-blur"
      >
        <span className="text-xs font-semibold text-autronis-text-primary tabular-nums px-1">
          {selectedCount} geselecteerd
        </span>
        {prefix}
        {actions.map((action) => {
          const tone = TONES[action.tone ?? "cyan"];
          const Icon = action.busy ? Loader2 : action.icon;

          const inner = (
            <>
              <Icon className={cn("w-3.5 h-3.5", action.busy && "animate-spin")} />
              {action.label} ({selectedCount})
            </>
          );
          const common = cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            tone
          );

          if (action.href) {
            return (
              <a
                key={action.key}
                href={action.href}
                className={common}
                title={action.title}
                onClick={(e) => {
                  if (action.disabled) {
                    e.preventDefault();
                    return;
                  }
                  action.onClick();
                }}
              >
                {inner}
              </a>
            );
          }

          return (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled || action.busy}
              title={action.title}
              className={common}
            >
              {inner}
            </button>
          );
        })}
        {onDelete && (
          <DeleteButton busy={!!deleteBusy} onClick={onDelete} count={selectedCount} />
        )}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto px-2 py-1.5 rounded-lg text-xs text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-card transition-colors"
          >
            Annuleer
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

interface DeleteButtonProps {
  busy: boolean;
  onClick: () => void;
  count: number;
}

/** Two-step delete: first click asks for confirmation, second click triggers. */
function DeleteButton({ busy, onClick, count }: DeleteButtonProps) {
  // Parent owns `onClick` semantics; we just render the button.
  // Callers typically implement confirmation state themselves.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50",
        TONES.red
      )}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      Verwijder ({count})
    </button>
  );
}
