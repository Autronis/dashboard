"use client";

import { useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { StatusZone } from "./zones/status-zone";
import { TransactiesZone } from "./zones/transacties-zone";
import { BtwKwartaalZone } from "./zones/btw-kwartaal-zone";
import { KapitaalrekeningZone } from "./zones/kapitaalrekening-zone";
import { BorgenZone } from "./zones/borgen-zone";
import { ArchiefZone } from "./zones/archief-zone";
import { RevolutSyncIndicator } from "./zones/revolut-sync-indicator";

export default function FinancienPage() {
  const [transactieType, setTransactieType] = useState<"af" | "bij">("af");

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 pb-32 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">Financiën</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-base text-autronis-text-secondary">
              Inkomsten, uitgaven en BTW overzicht
            </p>
            <RevolutSyncIndicator />
          </div>
        </div>

        <StatusZone onTypeSelect={setTransactieType} />

        <div id="transacties">
          <TransactiesZone type={transactieType} onTypeChange={setTransactieType} />
        </div>

        <BtwKwartaalZone />

        <KapitaalrekeningZone />

        <BorgenZone />

        <ArchiefZone />
      </div>
    </PageTransition>
  );
}
