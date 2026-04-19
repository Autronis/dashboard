"use client";

import Link from "next/link";
import { Flame, AlertCircle, Clock, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface ActieLead {
  id: number;
  bedrijfsnaam: string;
  status: string;
  actie: string | null;
  datum: string | null;
  waarde: number | null;
}

interface StilLead {
  id: number;
  bedrijfsnaam: string;
  status: string;
  sinds: string | null;
  waarde: number | null;
}

interface HotProspects {
  actieVereist: ActieLead[];
  stilleOffertes: StilLead[];
  stilleContacten: StilLead[];
}

async function fetchHotProspects(): Promise<HotProspects> {
  const res = await fetch("/api/dashboard/hot-prospects");
  if (!res.ok) throw new Error("Hot prospects fetch mislukte");
  return res.json();
}

function dagenGeleden(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (d < 1) return "vandaag";
  if (d === 1) return "gisteren";
  return `${d}d stil`;
}

/**
 * ProspectRadarWidget — vervangt EfficiencyWidget.
 * Toont drie urgentie-buckets: actie-vereist (volgendeActie gepland),
 * stille offertes (>7d stil), stille contacten (>14d stil). Elke rij
 * is een link naar de lead zelf, zodat klik → doe de follow-up.
 */
export function ProspectRadarWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "hot-prospects"],
    queryFn: fetchHotProspects,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const geenData =
    !isLoading &&
    data &&
    data.actieVereist.length === 0 &&
    data.stilleOffertes.length === 0 &&
    data.stilleContacten.length === 0;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          Prospect radar
        </h3>
        <Link
          href="/leads"
          className="text-xs text-autronis-accent hover:text-autronis-accent-hover font-medium inline-flex items-center gap-1"
        >
          Alle leads <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}

      {geenData && (
        <div className="text-xs text-autronis-text-secondary py-6 text-center">
          Geen hete prospects — rustig op de radar.
          <br />
          <Link href="/sales-engine" className="text-autronis-accent hover:underline mt-2 inline-block">
            → Nieuwe scan starten
          </Link>
        </div>
      )}

      {data && !geenData && (
        <div className="space-y-3">
          {data.actieVereist.length > 0 && (
            <Bucket
              icon={<AlertCircle className="w-3 h-3 text-red-400" />}
              titel="Actie vandaag"
              kleur="text-red-400"
            >
              {data.actieVereist.slice(0, 3).map((l) => (
                <LeadRow
                  key={l.id}
                  leadId={l.id}
                  bedrijfsnaam={l.bedrijfsnaam}
                  detail={l.actie || "Follow-up gepland"}
                />
              ))}
            </Bucket>
          )}

          {data.stilleOffertes.length > 0 && (
            <Bucket
              icon={<Clock className="w-3 h-3 text-amber-400" />}
              titel="Offerte stil"
              kleur="text-amber-400"
            >
              {data.stilleOffertes.slice(0, 2).map((l) => (
                <LeadRow
                  key={l.id}
                  leadId={l.id}
                  bedrijfsnaam={l.bedrijfsnaam}
                  detail={dagenGeleden(l.sinds)}
                />
              ))}
            </Bucket>
          )}

          {data.stilleContacten.length > 0 && (
            <Bucket
              icon={<Clock className="w-3 h-3 text-sky-400" />}
              titel="Contact verwaarloosd"
              kleur="text-sky-400"
            >
              {data.stilleContacten.slice(0, 2).map((l) => (
                <LeadRow
                  key={l.id}
                  leadId={l.id}
                  bedrijfsnaam={l.bedrijfsnaam}
                  detail={dagenGeleden(l.sinds)}
                />
              ))}
            </Bucket>
          )}
        </div>
      )}
    </div>
  );
}

function Bucket({
  icon,
  titel,
  kleur,
  children,
}: {
  icon: React.ReactNode;
  titel: string;
  kleur: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1.5 ${kleur}`}>
        {icon}
        {titel}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function LeadRow({
  leadId,
  bedrijfsnaam,
  detail,
}: {
  leadId: number;
  bedrijfsnaam: string;
  detail: string;
}) {
  return (
    <Link
      href={`/leads#lead-${leadId}`}
      className="flex items-center justify-between gap-2 px-2 py-1.5 -mx-2 rounded-md hover:bg-autronis-bg/60 transition-colors group"
    >
      <span className="text-xs text-autronis-text-primary truncate flex-1 min-w-0 group-hover:text-autronis-accent transition-colors">
        {bedrijfsnaam}
      </span>
      <span className="text-[10px] text-autronis-text-secondary italic flex-shrink-0">
        {detail}
      </span>
    </Link>
  );
}
