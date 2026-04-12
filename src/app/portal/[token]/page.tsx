"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePortal } from "./layout";
import { FolderKanban, FileText, MessageCircle, CheckCircle2, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalProject {
  id: number;
  naam: string;
  status: string;
  voortgangPercentage: number;
  deadline: string | null;
  takenTotaal: number;
  takenAfgerond: number;
}

interface PortalFactuur {
  id: number;
  factuurnummer: string;
  status: string;
  bedragInclBtw: number;
  factuurdatum: string;
  vervaldatum: string | null;
}

export default function PortalOverzicht() {
  const { klant, token } = usePortal();
  const [projecten, setProjecten] = useState<PortalProject[]>([]);
  const [facturen, setFacturen] = useState<PortalFactuur[]>([]);
  const [ongelezenBerichten, setOngelezenBerichten] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/${token}`);
        if (res.ok) {
          const data = await res.json();
          setProjecten(data.projecten || []);
          setFacturen(data.facturen || []);
          setOngelezenBerichten(data.ongelezenBerichten || 0);
        }
      } catch { /* ignore */ }
    }
    load();
  }, [token]);

  if (!klant) return null;

  const actieveProjecten = projecten.filter((p) => p.status === "actief");
  const openFacturen = facturen.filter((f) => f.status === "verstuurd");

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          Welkom, {klant.contactpersoon?.split(" ")[0] || klant.bedrijfsnaam}
        </h1>
        <p className="text-sm text-[#8A9BA0] mt-1">
          Hier vind je een overzicht van je projecten bij Autronis.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickStat
          icon={FolderKanban}
          label="Actieve projecten"
          value={actieveProjecten.length}
          color="text-[#17B8A5]"
        />
        <QuickStat
          icon={CheckCircle2}
          label="Taken afgerond"
          value={projecten.reduce((s, p) => s + p.takenAfgerond, 0)}
          color="text-emerald-400"
        />
        <QuickStat
          icon={FileText}
          label="Open facturen"
          value={openFacturen.length}
          color="text-blue-400"
        />
        <QuickStat
          icon={MessageCircle}
          label="Ongelezen berichten"
          value={ongelezenBerichten}
          color="text-purple-400"
        />
      </div>

      {/* Projects */}
      {actieveProjecten.length > 0 && (
        <div className="bg-[#192225] border border-[#2A3538] rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-[#17B8A5]" />
              Projecten
            </h2>
            <Link href={`/portal/${token}/projecten`} className="text-xs text-[#17B8A5] hover:underline flex items-center gap-1">
              Alle bekijken <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {actieveProjecten.map((p) => (
              <Link
                key={p.id}
                href={`/portal/${token}/projecten`}
                className="block bg-[#0E1719] border border-[#2A3538] rounded-xl p-4 hover:border-[#17B8A5]/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">{p.naam}</span>
                  <span className="text-xs text-[#17B8A5] font-semibold tabular-nums">{p.voortgangPercentage}%</span>
                </div>
                <div className="w-full h-2 bg-[#2A3538] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#17B8A5] rounded-full transition-all"
                    style={{ width: `${p.voortgangPercentage}%` }}
                  />
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-[#8A9BA0]">
                  <span>{p.takenAfgerond}/{p.takenTotaal} taken</span>
                  {p.deadline && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(p.deadline).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Open facturen */}
      {openFacturen.length > 0 && (
        <div className="bg-[#192225] border border-[#2A3538] rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Openstaande facturen
            </h2>
            <Link href={`/portal/${token}/facturen`} className="text-xs text-[#17B8A5] hover:underline flex items-center gap-1">
              Alle bekijken <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {openFacturen.map((f) => (
              <div key={f.id} className="flex items-center justify-between bg-[#0E1719] border border-[#2A3538] rounded-xl px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-white">{f.factuurnummer}</span>
                  <span className="text-xs text-[#8A9BA0] ml-2">
                    {new Date(f.factuurdatum).toLocaleDateString("nl-NL")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-white tabular-nums">
                    € {(f.bedragInclBtw || 0).toFixed(2).replace(".", ",")}
                  </span>
                  {f.vervaldatum && new Date(f.vervaldatum) < new Date() && (
                    <span className="block text-[10px] text-red-400 flex items-center gap-1 justify-end">
                      <AlertTriangle className="w-3 h-3" /> Verlopen
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages CTA */}
      <Link
        href={`/portal/${token}/berichten`}
        className="block bg-[#192225] border border-[#2A3538] rounded-2xl p-5 sm:p-6 hover:border-[#17B8A5]/40 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">Berichten</h3>
            <p className="text-sm text-[#8A9BA0]">
              {ongelezenBerichten > 0
                ? `Je hebt ${ongelezenBerichten} ongelezen bericht${ongelezenBerichten !== 1 ? "en" : ""}`
                : "Stel een vraag of laat een bericht achter"}
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-[#8A9BA0]" />
        </div>
      </Link>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, color }: { icon: typeof FolderKanban; label: string; value: number; color: string }) {
  return (
    <div className="bg-[#192225] border border-[#2A3538] rounded-xl p-4">
      <Icon className={cn("w-5 h-5 mb-2", color)} />
      <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
      <p className="text-xs text-[#8A9BA0] mt-0.5">{label}</p>
    </div>
  );
}
