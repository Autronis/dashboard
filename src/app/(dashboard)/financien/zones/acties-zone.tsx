"use client";

import { useQuery } from "@tanstack/react-query";
import { ActieCard } from "./actie-card";
import { UitgavenTab } from "../uitgaven-tab";
import { NietGematchtTab } from "../niet-gematcht-tab";

interface CountResult {
  count: number;
  totaal?: number;
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function ActiesZone() {
  // Te categoriseren: bank transacties met status='onbekend'
  const { data: catData } = useQuery<CountResult>({
    queryKey: ["financien-actie-categoriseren"],
    queryFn: async () => {
      const res = await fetch("/api/bank/transacties?status=onbekend");
      if (!res.ok) return { count: 0 };
      const data = await res.json();
      return { count: (data.transacties ?? []).length };
    },
    refetchInterval: 60_000,
  });

  // Te matchen: inkomende facturen die nog geen bank match hebben
  const { data: matchData } = useQuery<CountResult>({
    queryKey: ["financien-actie-matchen"],
    queryFn: async () => {
      const res = await fetch("/api/administratie?type=inkomend");
      if (!res.ok) return { count: 0 };
      const data = await res.json();
      const documenten = data.documenten ?? [];
      // Count documents that don't have a bank link yet (status onbekoppeld or missing bank id)
      const ongematcht = documenten.filter((d: { status?: string; bankTransactieId?: number | null }) =>
        d.status === "onbekoppeld" || d.bankTransactieId == null
      );
      return { count: ongematcht.length };
    },
    refetchInterval: 60_000,
  });

  // Klant facturen openstaand/overdue
  const { data: klantData } = useQuery<CountResult>({
    queryKey: ["financien-actie-klanten"],
    queryFn: async () => {
      const res = await fetch("/api/facturen?status=verzonden");
      if (!res.ok) return { count: 0 };
      const data = await res.json();
      const facturen = data.facturen ?? [];
      const openstaand = facturen.filter((f: { status: string }) =>
        f.status === "verzonden" || f.status === "overdue"
      );
      const totaal = openstaand.reduce(
        (sum: number, f: { bedragInclBtw?: number }) => sum + (f.bedragInclBtw ?? 0),
        0
      );
      return { count: openstaand.length, totaal };
    },
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-autronis-text-primary">Te doen</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActieCard titel="Te categoriseren" count={catData?.count ?? 0}>
          <UitgavenTab />
        </ActieCard>

        <ActieCard titel="Te matchen" count={matchData?.count ?? 0}>
          <NietGematchtTab />
        </ActieCard>

        <ActieCard
          titel="Klant facturen"
          count={klantData?.count ?? 0}
          subtitel={klantData?.totaal ? formatEuro(klantData.totaal) : undefined}
        >
          <div className="text-sm text-autronis-text-secondary">
            <a href="/financien" className="text-autronis-accent hover:underline">
              Open openstaande facturen →
            </a>
          </div>
        </ActieCard>
      </div>
    </div>
  );
}
