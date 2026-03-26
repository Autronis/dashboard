"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Eye, PenLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { DocumentPreview } from "@/components/shared/document-preview";
import { formatBedrag, formatDatum } from "@/lib/utils";

interface Klant {
  id: number;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  email: string | null;
  adres: string | null;
  taal?: "nl" | "en" | null;
}

interface Project {
  id: number;
  naam: string;
  klantNaam: string;
}

interface Regel {
  omschrijving: string;
  aantal: number;
  eenheidsprijs: number;
  btwPercentage: number;
}

function FactuurPreview({
  klant,
  factuurdatum,
  vervaldatum,
  regels,
  subtotaal,
  btwBedrag,
  totaal,
  notities,
  betalingstermijn,
}: {
  klant: Klant | null;
  factuurdatum: string;
  vervaldatum: string;
  regels: Regel[];
  subtotaal: number;
  btwBedrag: number;
  totaal: number;
  notities: string;
  betalingstermijn: number;
}) {
  return (
    <DocumentPreview
      type="FACTUUR"
      klant={klant}
      datum={factuurdatum}
      vervaldatum={vervaldatum}
      betalingstermijn={betalingstermijn}
      regels={regels}
      subtotaal={subtotaal}
      btwBedrag={btwBedrag}
      totaal={totaal}
      notities={notities}
      taal={klant?.taal === "en" ? "en" : "nl"}
      sticky
    />
  );
}

export default function NieuweFactuurPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [projecten, setProjecten] = useState<Project[]>([]);
  const [laden, setLaden] = useState(false);
  const [mobileView, setMobileView] = useState<"formulier" | "preview">("formulier");

  const [klantId, setKlantId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [factuurdatum, setFactuurdatum] = useState(new Date().toISOString().slice(0, 10));
  const [betalingstermijn, setBetalingstermijn] = useState(30);
  const [notities, setNotities] = useState("");
  const [regels, setRegels] = useState<Regel[]>([
    { omschrijving: "", aantal: 1, eenheidsprijs: 0, btwPercentage: 21 },
  ]);

  useEffect(() => {
    fetch("/api/klanten").then((r) => r.json()).then((d) => setKlanten(d.klanten || []));
    fetch("/api/projecten").then((r) => r.json()).then((d) => setProjecten(d.projecten || []));
  }, []);

  const gefilterdeProjecten = klantId
    ? projecten.filter((p) => p.klantNaam === klanten.find((k) => k.id === Number(klantId))?.bedrijfsnaam)
    : projecten;

  const selectedKlant = klantId ? klanten.find((k) => k.id === Number(klantId)) || null : null;

  const subtotaal = regels.reduce((sum, r) => sum + r.aantal * r.eenheidsprijs, 0);
  const btwBedrag = regels.reduce((sum, r) => sum + r.aantal * r.eenheidsprijs * (r.btwPercentage / 100), 0);
  const totaal = subtotaal + btwBedrag;

  const vervaldatum = (() => {
    const d = new Date(factuurdatum);
    d.setDate(d.getDate() + betalingstermijn);
    return d.toISOString().slice(0, 10);
  })();

  function updateRegel(index: number, veld: keyof Regel, waarde: string | number) {
    setRegels((prev) => prev.map((r, i) => (i === index ? { ...r, [veld]: waarde } : r)));
  }

  function voegRegelToe() {
    setRegels((prev) => [...prev, { omschrijving: "", aantal: 1, eenheidsprijs: 0, btwPercentage: 21 }]);
  }

  function verwijderRegel(index: number) {
    if (regels.length <= 1) return;
    setRegels((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleOpslaan() {
    if (!klantId) {
      addToast("Selecteer een klant", "fout");
      return;
    }
    if (regels.some((r) => !r.omschrijving.trim())) {
      addToast("Vul de omschrijving in voor elke regel", "fout");
      return;
    }
    if (regels.some((r) => r.eenheidsprijs <= 0)) {
      addToast("Eenheidsprijs moet groter dan 0 zijn", "fout");
      return;
    }

    setLaden(true);
    try {
      const res = await fetch("/api/facturen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId: Number(klantId),
          projectId: projectId ? Number(projectId) : null,
          factuurdatum,
          vervaldatum,
          notities: notities.trim() || null,
          regels: regels.map((r) => ({
            omschrijving: r.omschrijving.trim(),
            aantal: r.aantal,
            eenheidsprijs: r.eenheidsprijs,
            btwPercentage: r.btwPercentage,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Onbekende fout");
      }

      const { factuur } = await res.json();
      addToast("Factuur aangemaakt", "succes");
      router.push(`/financien/${factuur.id}`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon factuur niet aanmaken", "fout");
    } finally {
      setLaden(false);
    }
  }

  const formatBedragLocal = (n: number) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

  const formContent = (
    <div className="space-y-8">
      {/* Klant & Project */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
        <h2 className="text-lg font-semibold text-autronis-text-primary mb-5">Klant & Project</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">
              Klant <span className="text-red-400 ml-1">*</span>
            </label>
            <select
              value={klantId}
              onChange={(e) => { setKlantId(e.target.value); setProjectId(""); }}
              className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
            >
              <option value="">Selecteer klant...</option>
              {klanten.map((k) => (
                <option key={k.id} value={k.id}>{k.bedrijfsnaam}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
            >
              <option value="">Geen project</option>
              {gefilterdeProjecten.map((p) => (
                <option key={p.id} value={p.id}>{p.naam}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Datum & Termijn */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
        <h2 className="text-lg font-semibold text-autronis-text-primary mb-5">Datum & Termijn</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Factuurdatum</label>
            <input
              type="date"
              value={factuurdatum}
              onChange={(e) => setFactuurdatum(e.target.value)}
              className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Betalingstermijn (dagen)</label>
            <input
              type="number"
              value={betalingstermijn}
              onChange={(e) => setBetalingstermijn(Number(e.target.value))}
              min={1}
              className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Vervaldatum</label>
            <input
              type="date"
              value={vervaldatum}
              readOnly
              className="w-full bg-autronis-bg/50 border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-secondary cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Factuurregels */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-autronis-text-primary">Factuurregels</h2>
          <button
            onClick={voegRegelToe}
            className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Regel
          </button>
        </div>

        <div className="space-y-4">
          {regels.map((regel, i) => (
            <div key={i} className="bg-autronis-bg/50 rounded-xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_120px_80px_auto] gap-3 items-end">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-autronis-text-secondary">Omschrijving *</label>
                  <input
                    type="text"
                    value={regel.omschrijving}
                    onChange={(e) => updateRegel(i, "omschrijving", e.target.value)}
                    placeholder="Bijv. Website ontwikkeling"
                    className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-autronis-text-secondary">Aantal</label>
                  <input
                    type="number"
                    value={regel.aantal}
                    onChange={(e) => updateRegel(i, "aantal", Number(e.target.value))}
                    min={1}
                    className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-autronis-text-secondary">Prijs (€)</label>
                  <input
                    type="number"
                    value={regel.eenheidsprijs || ""}
                    onChange={(e) => updateRegel(i, "eenheidsprijs", Number(e.target.value))}
                    min={0}
                    step={0.01}
                    placeholder="0,00"
                    className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-autronis-text-secondary">BTW %</label>
                  <input
                    type="number"
                    value={regel.btwPercentage}
                    onChange={(e) => updateRegel(i, "btwPercentage", Number(e.target.value))}
                    min={0}
                    className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                  />
                </div>
                <div className="flex items-end gap-3">
                  <p className="text-base font-semibold text-autronis-text-primary whitespace-nowrap py-2.5">
                    {formatBedragLocal(regel.aantal * regel.eenheidsprijs)}
                  </p>
                  {regels.length > 1 && (
                    <button
                      onClick={() => verwijderRegel(i)}
                      className="p-2.5 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totalen */}
        <div className="mt-6 flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-autronis-text-secondary">Subtotaal</span>
              <span className="text-autronis-text-primary tabular-nums">{formatBedragLocal(subtotaal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-autronis-text-secondary">BTW</span>
              <span className="text-autronis-text-primary tabular-nums">{formatBedragLocal(btwBedrag)}</span>
            </div>
            <div className="border-t border-autronis-border pt-2 flex justify-between">
              <span className="text-lg font-bold text-autronis-text-primary">Totaal</span>
              <span className="text-lg font-bold text-autronis-accent tabular-nums">{formatBedragLocal(totaal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notities */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
        <h2 className="text-lg font-semibold text-autronis-text-primary mb-5">Opmerkingen</h2>
        <textarea
          value={notities}
          onChange={(e) => setNotities(e.target.value)}
          placeholder="Optionele opmerkingen die onderaan de factuur verschijnen..."
          rows={3}
          className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none"
        />
      </div>

      {/* Acties */}
      <div className="flex items-center justify-end gap-4">
        <Link
          href="/financien"
          className="px-5 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
        >
          Annuleren
        </Link>
        <button
          onClick={handleOpslaan}
          disabled={laden}
          className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
        >
          {laden ? "Opslaan..." : "Opslaan als concept"}
        </button>
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Facturen", href: "/facturen" },
            { label: "Nieuwe factuur" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-autronis-text-primary">Nieuwe factuur</h1>

          {/* Mobile toggle */}
          <div className="flex items-center gap-1 lg:hidden bg-autronis-card border border-autronis-border rounded-xl p-1">
            <button
              onClick={() => setMobileView("formulier")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mobileView === "formulier"
                  ? "bg-autronis-accent text-autronis-bg"
                  : "text-autronis-text-secondary hover:text-autronis-text-primary"
              }`}
            >
              <PenLine className="w-3.5 h-3.5" />
              Formulier
            </button>
            <button
              onClick={() => setMobileView("preview")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mobileView === "preview"
                  ? "bg-autronis-accent text-autronis-bg"
                  : "text-autronis-text-secondary hover:text-autronis-text-primary"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>
        </div>

        {/* Desktop: 2-column layout */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_420px] lg:gap-8 lg:items-start">
          {formContent}
          <FactuurPreview
            klant={selectedKlant}
            factuurdatum={factuurdatum}
            vervaldatum={vervaldatum}
            betalingstermijn={betalingstermijn}
            regels={regels}
            subtotaal={subtotaal}
            btwBedrag={btwBedrag}
            totaal={totaal}
            notities={notities}
          />
        </div>

        {/* Mobile: toggle between form and preview */}
        <div className="lg:hidden">
          {mobileView === "formulier" ? (
            formContent
          ) : (
            <FactuurPreview
              klant={selectedKlant}
              factuurdatum={factuurdatum}
              vervaldatum={vervaldatum}
              betalingstermijn={betalingstermijn}
              regels={regels}
              subtotaal={subtotaal}
              btwBedrag={btwBedrag}
              totaal={totaal}
              notities={notities}
            />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
