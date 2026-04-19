"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderChipProps {
  folder: string | null | undefined;
  /** If true, renders as a Link to /leads/folders/[folder] */
  asLink?: boolean;
  /** Optional count suffix shown as subtle number */
  count?: number;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export function FolderChip({ folder, asLink = true, count, className, onClick, title }: FolderChipProps) {
  if (!folder) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-autronis-border/30 text-autronis-text-secondary/60",
          className
        )}
      >
        <FolderOpen className="w-3 h-3" />
        geen
      </span>
    );
  }

  const inner = (
    <>
      <FolderOpen className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">{folder}</span>
      {typeof count === "number" && (
        <span className="ml-0.5 tabular-nums text-autronis-accent/70">{count}</span>
      )}
    </>
  );

  const classes = cn(
    "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-autronis-accent/10 text-autronis-accent hover:bg-autronis-accent/20 transition-colors max-w-[180px]",
    className
  );

  if (asLink) {
    return (
      <Link
        href={`/leads/folders/${encodeURIComponent(folder)}`}
        onClick={onClick}
        className={classes}
        title={title ?? folder}
      >
        {inner}
      </Link>
    );
  }

  return (
    <span className={classes} title={title ?? folder}>
      {inner}
    </span>
  );
}
