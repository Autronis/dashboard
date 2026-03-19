import { AppWindow, Globe, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScreenTimeCategorie, ScreenTimeRegel } from "@/types";

// ============ TYPES ============

export type Periode = "dag" | "week" | "maand";
export type TabId = "tijdlijn" | "registraties" | "team" | "regels";

// ============ CONSTANTS ============

export const CATEGORIE_KLEUREN: Record<string, string> = {
  development: "#17B8A5",
  communicatie: "#3B82F6",
  meeting: "#3B82F6",
  design: "#A855F7",
  administratie: "#F97316",
  finance: "#EAB308",
  afleiding: "#EF4444",
  overig: "#6B7280",
  inactief: "#4B5563",
};

export const CATEGORIE_LABELS: Record<string, string> = {
  development: "Development",
  communicatie: "Communicatie",
  meeting: "Meeting",
  design: "Design",
  administratie: "Administratie",
  finance: "Finance",
  afleiding: "Afleiding",
  overig: "Overig",
  inactief: "Inactief",
};

export const PRODUCTIEF_CATEGORIEEN: ScreenTimeCategorie[] = [
  "development",
  "design",
  "administratie",
];

// ============ HELPERS ============

export function formatTijd(seconden: number): string {
  const uren = Math.floor(seconden / 3600);
  const minuten = Math.round((seconden % 3600) / 60);
  if (uren === 0) return `${minuten}m`;
  if (minuten === 0) return `${uren}u`;
  return `${uren}u ${minuten}m`;
}

export function datumLabel(datum: Date, periode: Periode): string {
  const opties: Intl.DateTimeFormatOptions =
    periode === "dag"
      ? { weekday: "long", day: "numeric", month: "long" }
      : periode === "week"
        ? { day: "numeric", month: "short" }
        : { month: "long", year: "numeric" };
  if (periode === "week") {
    const einde = new Date(datum);
    einde.setDate(einde.getDate() + 6);
    return `${datum.toLocaleDateString("nl-NL", opties)} - ${einde.toLocaleDateString("nl-NL", opties)}`;
  }
  return datum.toLocaleDateString("nl-NL", opties);
}

// Format date as YYYY-MM-DD in LOCAL timezone (not UTC!)
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function berekenVanTot(
  datum: Date,
  periode: Periode,
): { van: string; tot: string } {
  const d = new Date(datum);
  let van: Date;
  let tot: Date;
  if (periode === "dag") {
    van = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    tot = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  } else if (periode === "week") {
    const dag = d.getDay();
    const maandag = d.getDate() - ((dag + 6) % 7);
    van = new Date(d.getFullYear(), d.getMonth(), maandag);
    tot = new Date(van.getFullYear(), van.getMonth(), van.getDate() + 7);
  } else {
    van = new Date(d.getFullYear(), d.getMonth(), 1);
    tot = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return {
    van: localDateStr(van),
    tot: localDateStr(tot),
  };
}

export function navigeerDatum(
  datum: Date,
  periode: Periode,
  richting: -1 | 1,
): Date {
  const d = new Date(datum);
  if (periode === "dag") d.setDate(d.getDate() + richting);
  else if (periode === "week") d.setDate(d.getDate() + richting * 7);
  else d.setMonth(d.getMonth() + richting);
  return d;
}

export interface ParsedTitel {
  type: "vscode" | "chrome" | "tradingview" | "discord" | "overig";
  label: string;
  project?: string;
  bestand?: string;
  website?: string;
  asset?: string;
  kanaal?: string;
  server?: string;
}

export function parseTitel(titel: string): ParsedTitel {
  // VS Code: "bestand.tsx — project — Visual Studio Code"
  const vsMatch = titel.match(/^(.+?)\s*[—-]\s*(.+?)\s*[—-]\s*Visual Studio Code$/);
  if (vsMatch) {
    return {
      type: "vscode",
      label: `${vsMatch[1].trim()} (${vsMatch[2].trim()})`,
      bestand: vsMatch[1].trim(),
      project: vsMatch[2].trim(),
    };
  }

  // TradingView: "BTCUSD — TradingView" of "Liquidation Heatmap | CoinAnk"
  const tvMatch = titel.match(/^(.+?)\s*[—-]\s*TradingView$/i);
  if (tvMatch) {
    return {
      type: "tradingview",
      label: `TradingView: ${tvMatch[1].trim()}`,
      asset: tvMatch[1].trim(),
    };
  }
  if (/coinank|coinglass|liquidation/i.test(titel)) {
    return {
      type: "tradingview",
      label: titel.split(/[—-]/)[0]?.trim() ?? titel,
      asset: titel.split(/[—-]/)[0]?.trim(),
    };
  }

  // Discord: "kanaal | server - Discord"
  const discordMatch = titel.match(/^(?:#\s*)?(.+?)\s*\|\s*(.+?)\s*[—-]\s*Discord$/i);
  if (discordMatch) {
    return {
      type: "discord",
      label: `Discord: #${discordMatch[1].trim()} (${discordMatch[2].trim()})`,
      kanaal: discordMatch[1].trim(),
      server: discordMatch[2].trim(),
    };
  }
  if (/discord/i.test(titel)) {
    const parts = titel.split(/[—-]/);
    return {
      type: "discord",
      label: `Discord: ${parts[0]?.trim() ?? titel}`,
      kanaal: parts[0]?.trim(),
    };
  }

  // Chrome / browser: "Paginatitel - Google Chrome"
  const chromeMatch = titel.match(/^(.+?)\s*[—-]\s*Google Chrome$/);
  if (chromeMatch) {
    return {
      type: "chrome",
      label: chromeMatch[1].trim(),
      website: chromeMatch[1].trim(),
    };
  }

  // Overig
  return {
    type: "overig",
    label: titel.split(/[—-]/)[0]?.trim() ?? titel,
  };
}

export function parseBestandenUitTitels(titels: string[]): ParsedTitel[] {
  const seen = new Set<string>();
  return titels
    .map(parseTitel)
    .filter((p) => {
      if (seen.has(p.label)) return false;
      seen.add(p.label);
      return true;
    });
}

export function formatTijdRange(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

export function gisterenDatum(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0] ?? "";
}

// ============ SUB-COMPONENTS ============

export function CategorieBadge({ categorie }: { categorie: string }) {
  return (
    <span
      className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium")}
      style={{
        backgroundColor: `${CATEGORIE_KLEUREN[categorie] ?? "#6B7280"}20`,
        color: CATEGORIE_KLEUREN[categorie] ?? "#6B7280",
      }}
    >
      {CATEGORIE_LABELS[categorie] ?? categorie}
    </span>
  );
}

export function TypeIcon({ type }: { type: ScreenTimeRegel["type"] }) {
  const Icon =
    type === "app" ? AppWindow : type === "url" ? Globe : LayoutGrid;
  return <Icon className="w-4 h-4 text-autronis-text-secondary" />;
}
