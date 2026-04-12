"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}

/**
 * Uniform page header component. Use on every dashboard page for consistent spacing.
 * - title: required, shown as h1
 * - description: optional subtitle (subtle, max 1 line)
 * - actions: optional right-aligned buttons
 * - compact: smaller spacing (default false)
 */
export function PageHeader({ title, description, actions, compact = false, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        compact ? "mb-4" : "mb-6",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            "font-bold text-autronis-text-primary tracking-tight",
            compact ? "text-2xl" : "text-3xl"
          )}
        >
          {title}
        </h1>
        {description && (
          <p className={cn("text-autronis-text-secondary mt-1 truncate", compact ? "text-xs" : "text-sm")}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
