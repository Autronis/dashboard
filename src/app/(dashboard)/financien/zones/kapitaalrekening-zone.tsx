"use client";

import { useKapitaalrekening, type PartnerSaldo } from "@/hooks/queries/use-kapitaalrekening";
import { ArrowRight, Wallet, AlertCircle } from "lucide-react";
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

function PartnerCard({
  naam,
  kleur,
  saldo,
}: {
  naam: string;
  kleur: "emerald" | "blue";
  saldo: PartnerSaldo;
}) {
  const positief = saldo.saldo >= 0;
  const initiaal = naam[0].toUpperCase();
  const ringClass = kleur === "emerald" ? "ring-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "ring-blue-500/30 bg-blue-500/10 text-blue-400";

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold ring-2", ringClass)}>
          {initiaal}
        </div>
        <h3 className="text-base font-semibold text-autronis-text-primary">{naam}</h3>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-autronis-text-secondary">Ingelegd</span>
          <span className="font-semibold text-emerald-400 tabular-nums">{formatEuro(saldo.ingelegd)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-autronis-text-secondary">Eigen uitgaven</span>
          <span className="font-semibold text-rose-400 tabular-nums">−{formatEuro(saldo.eigenUitgaven)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-autronis-text-secondary">Aandeel team-uitgaven</span>
          <span className="font-semibold text-rose-400 tabular-nums">−{formatEuro(saldo.aandeelTeam)}</span>
        </div>
      </div>

      <div className="pt-3 border-t border-autronis-border/50">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-autronis-text-secondary">Saldo</span>
          <span className={cn("text-xl font-bold tabular-nums", positief ? "text-emerald-400" : "text-orange-400")}>
            {positief ? "+" : ""}{formatEuro(saldo.saldo)}
          </span>
        </div>
        <p className="text-[10px] text-autronis-text-secondary/70 mt-1">
          {positief
            ? "Bedrijf is jou nog dit bedrag schuldig"
            : "Jij moet bedrijf nog dit bedrag inleggen"}
        </p>
      </div>
    </div>
  );
}

export function KapitaalrekeningZone() {
  const jaar = new Date().getFullYear();
  const { data, isLoading } = useKapitaalrekening(jaar);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-autronis-text-primary">Kapitaalrekening {jaar}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-autronis-card border border-autronis-border rounded-2xl animate-pulse" />
          <div className="h-48 bg-autronis-card border border-autronis-border rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const { sem, syb, verrekening, teamUitgaven, ongetagdEigen } = data;
  const heeftVerrekening = verrekening.bedrag > 0.01;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-autronis-accent" />
          <h2 className="text-lg font-semibold text-autronis-text-primary">Kapitaalrekening {jaar}</h2>
          <span className="text-[10px] uppercase tracking-wide bg-autronis-bg border border-autronis-border rounded-full px-2 py-0.5 text-autronis-text-secondary">
            Revolut Business
          </span>
        </div>
        <span className="text-xs text-autronis-text-secondary">Team-uitgaven: <span className="text-autronis-text-primary font-semibold tabular-nums">{formatEuro(teamUitgaven)}</span> · 50/50 verdeeld</span>
      </div>

      <UitlegBlock
        id="kapitaalrekening-uitleg"
        titel="Hoe werkt de kapitaalrekening?"
        subtitel="Wie heeft wat ingelegd en wie moet wie nog betalen?"
        accent="accent"
      >
        <div className="text-xs text-autronis-text-secondary leading-relaxed space-y-2">
          <p>
            In een VOF heeft elke partner zijn eigen <strong className="text-autronis-text-primary">kapitaalrekening</strong>:
            een lopende stand van wat hij in de zaak heeft gestoken (stortingen) minus wat de zaak voor hem heeft betaald
            (eigen uitgaven + zijn aandeel in de teamkosten).
          </p>
          <ul className="space-y-1 pl-4 list-disc">
            <li><strong className="text-emerald-400">Ingelegd</strong> = vermogensstortingen vanuit privé naar zakelijke rekening</li>
            <li><strong className="text-rose-400">Eigen uitgaven</strong> = uitgaven die alleen voor jou zijn (privé-aankoop op zakelijke rekening)</li>
            <li><strong className="text-rose-400">Aandeel team</strong> = jouw helft van alle uitgaven die als &quot;team&quot; gelabeld zijn</li>
            <li><strong className="text-autronis-accent">Saldo</strong> = ingelegd − beide uitgaven. Positief = bedrijf is jou geld schuldig. Negatief = jij moet bedrijf nog inleggen.</li>
          </ul>
          <p>
            Onderaan zie je wie wie nog moet betalen om gelijk te staan. Label uitgaven in
            <code className="text-autronis-text-primary px-1">/financien</code> als &quot;Sem&quot;, &quot;Syb&quot; of &quot;Team&quot;
            via het zijpaneel als je op een transactie klikt.
          </p>
          <p className="text-[11px] text-autronis-text-secondary/70 italic">
            Telt alleen mee: transacties op je <strong className="text-autronis-text-primary">huidige Revolut Business</strong> rekening.
            Oude ING / inhaal-imports horen niet in deze partner-tracking thuis (die data is van vóór de kapitaalrekening feature).
          </p>
        </div>
      </UitlegBlock>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PartnerCard naam="Sem" kleur="emerald" saldo={sem} />
        <PartnerCard naam="Syb" kleur="blue" saldo={syb} />
      </div>

      {heeftVerrekening && (
        <div className="bg-gradient-to-br from-autronis-accent/10 via-autronis-card to-autronis-card border border-autronis-accent/30 rounded-2xl p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-autronis-text-primary capitalize">{verrekening.van}</span>
              <ArrowRight className="w-4 h-4 text-autronis-accent" />
              <span className="text-sm font-semibold text-autronis-text-primary capitalize">{verrekening.naar}</span>
            </div>
            <div className="flex-1" />
            <div className="text-right">
              <p className="text-xs text-autronis-text-secondary">Te verrekenen</p>
              <p className="text-xl font-bold text-autronis-accent tabular-nums">{formatEuro(verrekening.bedrag)}</p>
            </div>
          </div>
          <p className="text-[11px] text-autronis-text-secondary/80 mt-2">
            Als <span className="capitalize">{verrekening.van}</span> dit bedrag aan <span className="capitalize">{verrekening.naar}</span> overmaakt, hebben beide partners hetzelfde kapitaalsaldo.
          </p>
        </div>
      )}

      {ongetagdEigen > 0 && (
        <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-autronis-text-secondary">
            <span className="font-semibold text-amber-400">{formatEuro(ongetagdEigen)}</span> aan uitgaven heeft nog geen eigenaar.
            Standaard worden ze als team-uitgaven (50/50) behandeld. Klik op een transactie in /financien om 'm aan Sem of Syb toe te wijzen.
          </p>
        </div>
      )}
    </div>
  );
}
