"use client";

import { useBorgen } from "@/hooks/queries/use-borgen";
import { Lock, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { UitlegBlock } from "@/components/ui/uitleg-block";

function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

export function BorgenZone() {
  const { data, isLoading } = useBorgen();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-autronis-text-primary">Borgen</h2>
        <div className="h-40 bg-autronis-card border border-autronis-border rounded-2xl animate-pulse" />
      </div>
    );
  }

  const { totaalUitgegeven, totaalOntvangen, saldo, uitgegeven, ontvangen, arrangement } = data;
  const heeftTransacties = uitgegeven.length > 0 || ontvangen.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-autronis-text-primary">Borgen</h2>
        <span className="text-[10px] uppercase tracking-wide bg-purple-500/10 border border-purple-500/30 rounded-full px-2 py-0.5 text-purple-400">
          Balans-post
        </span>
      </div>

      <UitlegBlock
        id="borgen-uitleg"
        titel="Wat is een borg in de boekhouding?"
        subtitel="Geen kosten, geen omzet — gewoon je geld op een andere plek"
        accent="accent"
      >
        <div className="text-xs text-autronis-text-secondary leading-relaxed space-y-2">
          <p>
            Een <strong className="text-autronis-text-primary">borg / waarborgsom</strong> is geen uitgave en geen inkomst.
            Het is jouw geld dat tijdelijk bij iemand anders ligt (of andersom). Daarom telt 't NIET mee in je
            kosten, BTW-aangifte of winst — het is een <strong className="text-autronis-text-primary">balans-post</strong>.
          </p>
          <ul className="space-y-1 pl-4 list-disc">
            <li><strong className="text-rose-400">Uitgegeven borg</strong> = jullie geld dat bij verhuurder/leverancier ligt. Krijgen jullie terug aan einde contract.</li>
            <li><strong className="text-emerald-400">Ontvangen borg</strong> = bedrag dat huurders bij jullie hebben gestald. Moeten jullie terugbetalen.</li>
            <li><strong className="text-purple-400">Saldo</strong> = uitgegeven − ontvangen. Hoeveel borg-geld nog van jullie is op andere plekken.</li>
          </ul>
          <p>
            Mocht een nieuwe borg-betaling niet automatisch worden herkend, klik in /financien op de transactie
            en zet 'm via het zijpaneel handmatig op &quot;Borg&quot;.
          </p>
        </div>
      </UitlegBlock>

      {/* Drie KPI tegels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-autronis-text-secondary mb-2">
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            Uitgegeven
          </div>
          <p className="text-2xl font-bold text-rose-400 tabular-nums">{formatEuro(totaalUitgegeven)}</p>
          <p className="text-[11px] text-autronis-text-secondary mt-1">{uitgegeven.length} transacties — staat bij verhuurders</p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-autronis-text-secondary mb-2">
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Ontvangen
          </div>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{formatEuro(totaalOntvangen)}</p>
          <p className="text-[11px] text-autronis-text-secondary mt-1">{ontvangen.length} transacties — moet je terugbetalen</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 via-autronis-card to-autronis-card border border-purple-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-autronis-text-secondary mb-2">
            <Lock className="w-3.5 h-3.5" />
            Netto saldo
          </div>
          <p className={cn("text-2xl font-bold tabular-nums", saldo >= 0 ? "text-purple-400" : "text-orange-400")}>
            {saldo >= 0 ? "+" : ""}{formatEuro(saldo)}
          </p>
          <p className="text-[11px] text-autronis-text-secondary mt-1">
            {saldo >= 0 ? "Netto bij anderen geparkeerd" : "Netto bij jullie geparkeerd"}
          </p>
        </div>
      </div>

      {/* Edisonstraat arrangement — hardcoded vanuit BORG_CONFIG */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-autronis-text-primary">Kantoor: {arrangement.adres}</h3>
            <p className="text-[11px] text-autronis-text-secondary mt-0.5">
              Totale borg {formatEuro(arrangement.totaalBorg)} · {arrangement.huurders.length} huurders × {formatEuro(arrangement.borgPerHuurder)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-autronis-text-secondary uppercase tracking-wide">Maandhuur</p>
            <p className="text-sm font-semibold text-autronis-text-primary tabular-nums">
              {formatEuro(arrangement.huurPerHuurder)} <span className="text-[10px] text-autronis-text-secondary font-normal">/ huurder</span>
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          {arrangement.huurders.map((h) => (
            <div key={h.naam} className="flex items-center justify-between py-1.5 px-3 bg-autronis-bg/50 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-autronis-text-primary font-medium">{h.naam}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-autronis-text-secondary">{h.status}</span>
                <span className="font-semibold text-autronis-text-primary tabular-nums w-16 text-right">{formatEuro(h.borg)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recente borg-transacties */}
      {heeftTransacties && (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-autronis-text-primary mb-3">Recente borg-transacties</h3>
          <div className="space-y-1.5">
            {[...uitgegeven, ...ontvangen]
              .sort((a, b) => b.datum.localeCompare(a.datum))
              .slice(0, 8)
              .map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-1.5 px-3 bg-autronis-bg/30 rounded-lg text-xs">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {tx.type === "af" ? (
                      <ArrowUpFromLine className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    ) : (
                      <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    )}
                    <span className="text-autronis-text-primary truncate">{tx.merchantNaam ?? tx.omschrijving}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-autronis-text-secondary">{formatDatum(tx.datum)}</span>
                    <span className={cn("font-semibold tabular-nums w-20 text-right", tx.type === "af" ? "text-rose-400" : "text-emerald-400")}>
                      {tx.type === "af" ? "−" : "+"}{formatEuro(Math.abs(tx.bedrag))}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {!heeftTransacties && (
        <div className="bg-autronis-card border border-autronis-border border-dashed rounded-2xl p-6 text-center">
          <Circle className="w-8 h-8 text-autronis-text-secondary/40 mx-auto mb-2" />
          <p className="text-sm text-autronis-text-secondary">
            Nog geen borg-transacties op de huidige Revolut. Borgen worden automatisch herkend bij sync,
            anders kun je een transactie handmatig als &quot;Borg&quot; labelen via het zijpaneel.
          </p>
        </div>
      )}
    </div>
  );
}
