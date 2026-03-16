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
  administratie: "#F59E0B",
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
    van: van.toISOString().split("T")[0] ?? "",
    tot: tot.toISOString().split("T")[0] ?? "",
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

export function parseBestandenUitTitels(titels: string[]): string[] {
  return [
    ...new Set(
      titels
        .map((t) => t.split(" \u2014 ")[0]?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  ];
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
