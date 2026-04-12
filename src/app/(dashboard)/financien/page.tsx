"use client";

import { PageTransition } from "@/components/ui/page-transition";
import { StatusZone } from "./zones/status-zone";
import { ActiesZone } from "./zones/acties-zone";
import { BtwKwartaalZone } from "./zones/btw-kwartaal-zone";
import { ArchiefZone } from "./zones/archief-zone";

export default function FinancienPage() {
  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">Financiën</h1>
          <p className="text-base text-autronis-text-secondary mt-1">
            Dagelijks overzicht: status, acties en BTW
          </p>
        </div>

        {/* Zone 1: Status KPIs */}
        <StatusZone />

        {/* Zone 2: Acties (te doen) */}
        <ActiesZone />

        {/* Zone 3: BTW kwartaal */}
        <BtwKwartaalZone />

        {/* Zone 4: Archief */}
        <ArchiefZone />
      </div>
    </PageTransition>
  );
}
