"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Klant {
  id: number;
  bedrijfsnaam: string;
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

export default function FactuurBewerkenPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const id = Number(params.id);

  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [projecten, setProjecten] = useState<Project[]>([]);
  const [laden, setLaden] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [klantId, setKlantId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [factuurdatum, setFactuurdatum] = useState("");
  const [betalingstermijn, setBetalingstermijn] = useState(30);
  const [notities, setNotities] = useState("");
  const [regels, setRegels] = useState<Regel[]>([]);
  const [factuurnummer, setFactuurnummer] = useState("");

  const loadFactuur = useCallback(async () => {
    try {
      const [factuurRes, klantenRes, projectenRes] = await Promise.all([
        fetch(`/api/facturen/${id}`),
        fetch("/api/klanten"),
        fetch("/api/projecten"),
      ]);

      if (factuurRes.status === 404) {
        addToast("Factuur niet gevonden", "fout");
        router.push("/financien");
        return;
      }

      const factuurData = await factuurRes.json();
      const klantenData = await klantenRes.json();
      const projectenData = await projectenRes.json();

      const f = factuurData.factuur;

      if (f.status !== "concept") {
        addToast("Alleen conceptfacturen kunnen bewerkt worden", "fout");
        router.push(`/financien/${id}`);
        return;
      }

      setKlanten(klantenData.klanten || []);
      setProjecten(projectenData.projecten || []);
      setKlantId(String(f.klantId));
      setProjectId(f.projectId ? String(f.projectId) : "");
      setFactuurdatum(f.factuurdatum || new Date().toISOString().slice(0, 10));
      setFactuurnummer(f.factuurnummer);
      setNotities(f.notities || "");

      // Calculate betalingstermijn from factuurdatum and vervaldatum
      if (f.factuurdatum && f.vervaldatum) {
        const fd = new Date(f.factuurdatum);
        const vd = new Date(f.vervaldatum);
        const diffDays = Math.round((vd.getTime() - fd.getTime()) / (1000 * 60 * 60 * 24));
        setBetalingstermijn(diffDays > 0 ? diffDays : 30);
      }

      // Map regels
      const regelData: Regel[] = factuurData.regels.map((r: { omschrijving: string; aantal: number | null; eenheidsprijs: number | null; btwPercentage: number | null }) => ({
        omschrijving: r.omschrijving,
        aantal: r.aantal || 1,
        eenheidsprijs: r.eenheidsprijs || 0,
        btwPercentage: r.btwPercentage ?? 21,
      }));

      setRegels(regelData.length > 0 ? regelData : [{ omschrijving: "", aantal: 1, eenheidsprijs: 0, btwPercentage: 21 }]);
    } catch {
      addToast("Kon factuur niet laden", "fout");
    } finally {
      setInitialLoading(false);
    }
  }, [id, addToast, router]);

  useEffect(() => {
    loadFactuur();
  }, [loadFactuur]);

  const gefilterdeProjecten = klantId
    ? projecten.filter((p) => p.klantNaam === klanten.find((k) => k.id === Number(klantId))?.bedrijfsnaam)
    : projecten;

  const subtotaal = regels.reduce((sum, r) => sum + r.aantal * r.eenheidsprijs, 0);
  const btwBedrag = regels.reduce((sum, r) => sum + r.aantal * r.eenheidsprijs * (r.btwPercentage / 100), 0);
  const totaal = subtotaal + btwBedrag;

  const vervaldatum = (() => {
    if (!factuurdatum) return "";
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
      const res = await fetch(`/api/facturen/${id}`, {
        method: "PUT",
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

      addToast("Factuur bijgewerkt", "succes");
      router.push(`/financien/${id}`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon factuur niet bijwerken", "fout");
    } finally {
      setLaden(false);
    }
  }

  const formatBedragLocal = (n: number) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-2 border-autronis-accent/30 border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/financien/${id}`}
          className="inline-flex items-center gap-2 text-base text-autronis-text-secondary hover:text-autronis-text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Terug naar factuur
        </Link>
        <h1 className="text-3xl font-bold text-autronis-text-primary">
          Factuur {factuurnummer} bewerken
        </h1>
      </div>

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
          href={`/financien/${id}`}
          className="px-5 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
        >
          Annuleren
        </Link>
        <button
          onClick={handleOpslaan}
          disabled={laden}
          className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
        >
          {laden ? "Opslaan..." : "Wijzigingen opslaan"}
        </button>
      </div>
    </div>
  );
}
