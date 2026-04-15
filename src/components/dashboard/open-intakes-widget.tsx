"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowRight, Lightbulb, FileText, Briefcase, Users, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Intake {
  id: number;
  projectId: number | null;
  stap: "concept" | "invalshoeken" | "project" | "scope" | "klant" | "klaar";
  klantConcept: string | null;
  bron: "chat" | "dashboard" | "sales-engine";
  scopeStatus: "niet_gestart" | "bezig" | "klaar" | "overgeslagen";
  aangemaaktOp: string;
}

const STAP_INFO: Record<Intake["stap"], { label: string; icon: typeof Sparkles; color: string }> = {
  concept: { label: "Concept", icon: Lightbulb, color: "text-amber-400" },
  invalshoeken: { label: "Invalshoeken", icon: Sparkles, color: "text-purple-400" },
  project: { label: "Project", icon: Briefcase, color: "text-blue-400" },
  scope: { label: "Scope", icon: FileText, color: "text-autronis-accent" },
  klant: { label: "Klant", icon: Users, color: "text-emerald-400" },
  klaar: { label: "Klaar", icon: CheckCircle2, color: "text-emerald-400" },
};

function tijdGeleden(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const dagen = Math.floor(diff / 86_400_000);
  if (dagen === 0) return "vandaag";
  if (dagen === 1) return "gisteren";
  if (dagen < 7) return `${dagen}d geleden`;
  if (dagen < 30) return `${Math.floor(dagen / 7)}w geleden`;
  return `${Math.floor(dagen / 30)}mnd geleden`;
}

export function OpenIntakesWidget() {
  const { data, isLoading } = useQuery<{ intakes: Intake[] }>({
    queryKey: ["open-intakes"],
    queryFn: async () => {
      const res = await fetch("/api/projecten/intake");
      if (!res.ok) throw new Error("Kon intakes niet laden");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Sparkles className="w-4 h-4 text-autronis-accent" />
          <h2 className="text-sm font-semibold text-autronis-text-primary">Open intakes</h2>
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const intakes = (data?.intakes ?? []).filter((i) => i.stap !== "klaar");
  const top = intakes.slice(0, 4);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-autronis-accent" />
          <h2 className="text-sm font-semibold text-autronis-text-primary">Open intakes</h2>
          {intakes.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-autronis-accent/15 text-autronis-accent font-semibold tabular-nums">
              {intakes.length}
            </span>
          )}
        </div>
        <Link
          href="/projecten"
          className="text-[11px] text-autronis-text-secondary hover:text-autronis-accent transition-colors flex items-center gap-1"
        >
          Alle <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {intakes.length === 0 ? (
        <div className="text-center py-6">
          <Lightbulb className="w-7 h-7 text-autronis-text-secondary/30 mx-auto mb-2" />
          <p className="text-xs text-autronis-text-secondary">Geen lopende intakes</p>
          <p className="text-[10px] text-autronis-text-secondary/60 mt-1">
            Start een nieuw project via /projecten of vraag Claude
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {top.map((intake) => {
            const stap = STAP_INFO[intake.stap];
            const Icon = stap.icon;
            const concept = (intake.klantConcept ?? "").slice(0, 60);
            const href = intake.projectId
              ? `/projecten/${intake.projectId}`
              : `/projecten?intake=${intake.id}`;
            return (
              <Link
                key={intake.id}
                href={href}
                className="flex items-start gap-3 p-3 rounded-xl bg-autronis-bg/30 border border-autronis-border/50 hover:border-autronis-accent/40 transition-colors group"
              >
                <div className={cn("p-1.5 rounded-lg flex-shrink-0", "bg-autronis-bg")}>
                  <Icon className={cn("w-3.5 h-3.5", stap.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wide", stap.color)}>
                      {stap.label}
                    </span>
                    <span className="text-[10px] text-autronis-text-secondary/60">
                      · {tijdGeleden(intake.aangemaaktOp)}
                    </span>
                    {intake.bron === "chat" && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium">
                        chat
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-autronis-text-primary mt-0.5 truncate">
                    {concept || <span className="italic text-autronis-text-secondary">Geen concept</span>}
                    {concept.length === 60 && "…"}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-autronis-text-secondary/40 group-hover:text-autronis-accent transition-colors flex-shrink-0 mt-0.5" />
              </Link>
            );
          })}
          {intakes.length > 4 && (
            <Link
              href="/projecten"
              className="block text-center py-1.5 text-[11px] text-autronis-text-secondary hover:text-autronis-accent transition-colors"
            >
              + {intakes.length - 4} meer
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
