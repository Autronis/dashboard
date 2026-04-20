"use client";

import { cn } from "@/lib/utils";

export interface AgendaBlokProps {
  id: number;
  titel: string;
  omschrijving?: string | null;
  type: "afspraak" | "deadline" | "belasting" | "herinnering" | "taak" | "claude";
  startDatum: string;
  eindDatum?: string | null;
  eigenaar: "sem" | "syb" | "team" | "vrij";
  gemaaktDoor?: string;
  projectNaam?: string | null;
  projectKleur?: string | null;
  onClick?: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  claude: "CLAUDE",
  taak: "TAAK",
  afspraak: "MEETING",
  deadline: "DEADLINE",
  belasting: "BELASTING",
  herinnering: "HERINNERING",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function durationMinutes(start: string, end?: string | null): number {
  if (!end) return 30;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(15, Math.round((e - s) / 60000));
}

function durationLabel(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}u` : `${h}u${m}m`;
}

export function AgendaBlok({
  titel,
  omschrijving,
  type,
  startDatum,
  eindDatum,
  eigenaar,
  projectNaam,
  projectKleur,
  onClick,
}: AgendaBlokProps) {
  const mins = durationMinutes(startDatum, eindDatum);
  // 1 minute = 1.6px height baseline (30m -> 48px, 60m -> 96px, 90m -> 144px)
  const heightPx = Math.max(32, Math.round(mins * 1.6));
  const accentColor = projectKleur || "#2A3538";

  // Compacte layout voor blokken <= 45 min. Anders verdwijnt de titel onder
  // padding+metadata en kan je niet eens zien wat het blok is. Compact skipt
  // project-tag + duur-label en maakt tekst fijner zodat minimum-info zichtbaar
  // blijft bij 30 min hoogte.
  const isCompact = mins <= 45;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full text-left rounded-md border border-[var(--border)] bg-[var(--card)]/60 hover:bg-[var(--card)]/90 transition-colors overflow-hidden",
        isCompact ? "pl-2 pr-1.5 pt-3.5 pb-1.5" : "pl-3 pr-2 pt-5 pb-4",
        eigenaar === "team" && "ring-1 ring-purple-500/40"
      )}
      style={{ height: `${heightPx}px`, borderLeft: `4px solid ${accentColor}` }}
      data-testid="agenda-blok"
      data-eigenaar={eigenaar}
      data-type={type}
    >
      <span
        className={cn(
          "absolute top-0.5 left-1.5 tabular-nums text-[var(--text-secondary)]",
          isCompact ? "text-[9px]" : "text-[10px]"
        )}
      >
        {formatTime(startDatum)}
      </span>
      <span
        className={cn(
          "absolute top-0.5 right-1.5 tabular-nums text-[var(--text-secondary)]",
          isCompact ? "text-[9px]" : "text-[10px]"
        )}
      >
        {durationLabel(mins)}
      </span>

      {projectNaam && !isCompact && (
        <div
          className="text-[11px] uppercase tracking-wider font-semibold truncate leading-tight"
          style={{ color: accentColor }}
        >
          {projectNaam}
        </div>
      )}

      <div
        className={cn(
          "font-medium text-[var(--text)] leading-snug",
          isCompact ? "text-[11px] line-clamp-1" : "text-sm line-clamp-2"
        )}
      >
        {isCompact && projectNaam && (
          <span className="uppercase tracking-wider mr-1.5 text-[9px] font-semibold" style={{ color: accentColor }}>
            {projectNaam} ·
          </span>
        )}
        {titel}
      </div>

      {omschrijving && mins >= 60 && (
        <div className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-0.5">
          {omschrijving}
        </div>
      )}

      {!isCompact && (
        <span className="absolute bottom-1 right-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-1.5 py-0.5 rounded bg-[var(--bg)]/60">
          {TYPE_LABEL[type] || type}
        </span>
      )}
    </button>
  );
}
