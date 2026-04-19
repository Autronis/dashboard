"use client";

import {
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Eye,
  Sparkles,
  Loader2,
  Clock,
  Radio,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ComponentType, SVGProps } from "react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

type Variant = {
  label: string;
  icon: IconType;
  cls: string;
  spin?: boolean;
};

const VARIANTS: Record<string, Variant> = {
  // Email generation pipeline
  ready_for_generation: { label: "Klaar voor generatie", icon: Sparkles,    cls: "bg-purple-500/15 text-purple-300 ring-purple-500/25" },
  generating:           { label: "Genereren...",         icon: Loader2,     cls: "bg-blue-500/15 text-blue-300 ring-blue-500/25",       spin: true },
  generation_failed:    { label: "Generatie mislukt",    icon: XCircle,     cls: "bg-red-500/15 text-red-300 ring-red-500/25" },
  generated:            { label: "Te reviewen",          icon: Eye,         cls: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/25" },
  approved:             { label: "Goedgekeurd",          icon: CheckCircle, cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25" },
  sending:              { label: "Verzenden...",         icon: Loader2,     cls: "bg-blue-500/15 text-blue-300 ring-blue-500/25",       spin: true },
  sent:                 { label: "Verstuurd",            icon: CheckCircle2,cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25" },
  send_failed:          { label: "Verzendfout",          icon: AlertTriangle, cls: "bg-red-500/15 text-red-300 ring-red-500/25" },
  error:                { label: "Verzendfout",          icon: AlertTriangle, cls: "bg-red-500/15 text-red-300 ring-red-500/25" },
  failed:               { label: "Gefaald",              icon: XCircle,     cls: "bg-red-500/15 text-red-300 ring-red-500/25" },
  replied:              { label: "Beantwoord",           icon: MessageSquare, cls: "bg-blue-500/15 text-blue-300 ring-blue-500/25" },

  // Verification
  verification_pending: { label: "Verificatie pending",  icon: Loader2,     cls: "bg-amber-500/15 text-amber-300 ring-amber-500/25",    spin: true },
  verification_risky:   { label: "Risky",                icon: AlertTriangle, cls: "bg-orange-500/15 text-orange-300 ring-orange-500/25" },
  verification_failed:  { label: "Verificatie mislukt",  icon: XCircle,     cls: "bg-red-500/15 text-red-300 ring-red-500/25" },

  // Enrichment
  pending:              { label: "Pending",              icon: Clock,       cls: "bg-autronis-border/40 text-autronis-text-secondary ring-autronis-border" },
  running:              { label: "Bezig",                icon: Loader2,     cls: "bg-blue-500/15 text-blue-300 ring-blue-500/25",       spin: true },
  completed:            { label: "Voltooid",             icon: CheckCircle2,cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25" },
  webhook_sent:         { label: "Verzonden",            icon: Radio,       cls: "bg-amber-500/15 text-amber-300 ring-amber-500/25" },
  webhook_received:     { label: "Ontvangen",            icon: CheckCircle2,cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25" },

  // Outreach
  // (pending/sent/failed already covered above)

  // Website confidence (Website Leads tab)
  HIGH:                 { label: "Website gevonden",     icon: ShieldCheck,   cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25" },
  MEDIUM:               { label: "Mogelijk website",     icon: ShieldAlert,   cls: "bg-amber-500/15 text-amber-300 ring-amber-500/25" },
  LIKELY_UNVERIFIED:    { label: "Onzeker",              icon: ShieldQuestion,cls: "bg-orange-500/15 text-orange-300 ring-orange-500/25" },
  NONE:                 { label: "Geen website",         icon: AlertCircle,   cls: "bg-red-500/15 text-red-300 ring-red-500/25" },
};

interface LeadStatusBadgeProps {
  status: string | null | undefined;
  /** Optional label override */
  label?: string;
  compact?: boolean;
  className?: string;
}

export function LeadStatusBadge({ status, label, compact = false, className }: LeadStatusBadgeProps) {
  if (!status) return null;
  const v = VARIANTS[status] ?? {
    label: status,
    icon: AlertCircle,
    cls: "bg-autronis-border/40 text-autronis-text-secondary ring-autronis-border",
  };
  const Icon = v.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full ring-1 ring-inset whitespace-nowrap",
        compact ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        v.cls,
        className
      )}
    >
      <Icon className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5", v.spin && "animate-spin")} />
      {label ?? v.label}
    </span>
  );
}
