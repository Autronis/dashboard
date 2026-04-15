"use client";

import { PageTransition } from "@/components/ui/page-transition";
import { StatusZone } from "./zones/status-zone";
import { TransactiesZone } from "./zones/transacties-zone";
import { BtwKwartaalZone } from "./zones/btw-kwartaal-zone";
import { KapitaalrekeningZone } from "./zones/kapitaalrekening-zone";
import { BorgenZone } from "./zones/borgen-zone";
import { ArchiefZone } from "./zones/archief-zone";

export default function FinancienPage() {
  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">Financiën</h1>
          <p className="text-base text-autronis-text-secondary mt-1">
            Inkomsten, uitgaven en BTW overzicht
          </p>
        </div>

        {/* Zone 1: Status KPIs (5 cards met sparklines) */}
        <StatusZone />

        {/* Zone 2: Transacties (toggle + list + donut) */}
        <TransactiesZone />

        {/* Zone 3: BTW kwartaal */}
        <BtwKwartaalZone />

        {/* Zone 4: Kapitaalrekening — wie heeft hoeveel ingelegd / saldo */}
        <KapitaalrekeningZone />

        {/* Zone 5: Borgen — vorderingen + schulden, geen P&L */}
        <BorgenZone />

        {/* Zone 6: Archief (collapsed) */}
        <ArchiefZone />
      </div>
    </PageTransition>
  );
}
