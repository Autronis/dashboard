"use client";

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  filters?: ReactNode;
  actions?: ReactNode;
  activeCount?: number;
  onClear?: () => void;
  className?: string;
}

/**
 * Uniform filter bar for list pages. Use above any data list.
 *
 * @example
 * <FilterBar
 *   search={{ value: zoek, onChange: setZoek, placeholder: "Zoek klanten..." }}
 *   filters={<>
 *     <select>...</select>
 *     <select>...</select>
 *   </>}
 *   actions={<button>Nieuwe klant</button>}
 *   activeCount={2}
 *   onClear={() => resetFilters()}
 * />
 */
export function FilterBar({
  search,
  filters,
  actions,
  activeCount = 0,
  onClear,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Search */}
      {search && (
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-autronis-text-secondary/50 pointer-events-none" />
          <input
            type="text"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? "Zoeken..."}
            className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-9 pr-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
          />
        </div>
      )}

      {/* Filter slots */}
      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}

      {/* Clear */}
      {activeCount > 0 && onClear && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-xl transition-colors whitespace-nowrap"
        >
          <X className="w-3.5 h-3.5" />
          Wis filters
          {activeCount > 1 && (
            <span className="ml-1 px-1.5 py-0.5 bg-red-500/20 rounded-md text-[10px]">{activeCount}</span>
          )}
        </button>
      )}

      {/* Actions (right aligned) */}
      {actions && <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>}
    </div>
  );
}
