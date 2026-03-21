"use client";

import { Building2 } from "lucide-react";

export function OfficeViewSyb() {
  return (
    <div className="w-full rounded-2xl border border-autronis-border bg-[#0d1520] overflow-hidden">
      <div className="flex flex-col items-center justify-center py-20 px-8">
        <Building2 className="w-12 h-12 text-autronis-text-tertiary mb-4" />
        <h3 className="text-lg font-bold text-autronis-text-primary mb-2">
          Team Syb — Verdieping 2
        </h3>
        <p className="text-sm text-autronis-text-secondary text-center max-w-md">
          Dit kantoor wordt door Syb ingericht. Start een chat in Syb&apos;s werkruimte om zijn team en kantoor op te zetten.
        </p>
        <div className="mt-6 px-4 py-2 rounded-lg bg-autronis-border/20 text-xs text-autronis-text-tertiary">
          office-view-syb.tsx — klaar voor customisatie
        </div>
      </div>
    </div>
  );
}
