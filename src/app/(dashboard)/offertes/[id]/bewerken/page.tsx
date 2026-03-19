"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Eye, PenLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentPreview } from "@/components/shared/document-preview";
import { formatBedrag, formatDatum } from "@/lib/utils";

interface Klant {
  id: number;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  email: string | null;
  adres: string | null;
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

interface OfferteData {
  id: number;
  klantId: number;
  projectId: number | null;
  offertenummer: string;
  titel: string | null;
  status: string;
  datum: string | null;
  geldigTot: string | null;
  notities: string | null;
}

function OffertePreview({
  klant,
  titel,
  datum,
  geldigTot,
  regels,
  subtotaal,
  btwBedrag,
  totaal,
  notities,
  offertenummer,
}: {
  klant: Klant | null;
  titel: string;
  datum: string;
  geldigTot: string;
  regels: Regel[];
  subtotaal: number;
  btwBedrag: number;
  totaal: number;
  notities: string;
  offertenummer: string;
}) {
  return (
    <DocumentPreview
      type="OFFERTE"
      klant={klant}
      nummer={offertenummer}
      titel={titel}
      datum={datum}
      geldigTot={geldigTot}
      regels={regels}
      subtotaal={subtotaal}
      btwBedrag={btwBedrag}
      totaal={totaal}
      notities={notities}
      sticky
    />
  );
}

export default function OfferteBewerkenPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const id = Number(params.id);

  const [offerteData, setOfferteData] = useState<OfferteData | null>(null);
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [projecten, setProjecten] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [laden, setLaden] = useState(false);
  const [mobileView, setMobileView] = useState<"formulier" | "preview">("formulier");

  const [klantId, setKlantId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [titel, setTitel] = useState("");
  const [datum, setDatum] = useState("");
  const [geldigTot, setGeldigTot] = useState("");
  const [notities, setNotities] = useState("");
  const [regels, setRegels] = useState<Regel[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [offerteRes, klantenRes, projectenRes] = await Promise.all([
        fetch(`/api/offertes/${id}`),
        fetch("/api/klanten"),
        fetch("/api/projecten"),
      ]);

      if (offerteRes.status === 404) {
        addToast("Offerte niet gevonden", "fout");
        router.push("/offertes");
        return;
      }

      const offerteJson = await offerteRes.json();
      const klantenJson = await klantenRes.json();
      const projectenJson = await projectenRes.json();

      const offerte = offerteJson.offerte;
      const offerteRegels = offerteJson.regels;

      if (offerte.status !== "concept") {
        addToast("Alleen conceptoffertes kunnen bewerkt worden", "fout");
        router.push(`/offertes/${id}`);
        return;
      }

      setOfferteData(offerte);
      setKlanten(klantenJson.klanten || []);
      setProjecten(projectenJson.projecten || []);

      setKlantId(String(offerte.klantId));
      setProjectId(offerte.projectId ? String(offerte.projectId) : "");
      setTitel(offerte.titel || "");
      setDatum(offerte.datum || new Date().toISOString().slice(0, 10));
      setGeldigTot(offerte.geldigTot || "");
      setNotities(offerte.notities || "");
      setRegels(
        offerteRegels.map((r: { omschrijving: string; aantal: number | null; eenheidsprijs: number | null; btwPercentage: number | null }) => ({
          omschrijving: r.omschrijving,
          aantal: r.aantal || 1,
          eenheidsprijs: r.eenheidsprijs || 0,
          btwPercentage: r.btwPercentage ?? 21,
        }))
      );
    } catch {
      addToast("Kon offerte niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [id, addToast, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const gefilterdeProjecten = klantId
    ? projecten.filter((p) => p.klantNaam === klanten.find((k) => k.id === Number(klantId))?.bedrijfsnaam)
    : projecten;

  const selectedKlant = klantId ? klanten.find((k) => k.id === Number(klantId)) || null : null;

  const subtotaal = regels.reduce((sum, r) => sum + r.aantal * r.eenheidsprijs, 0);
  const btwBedrag = regels.reduce((sum, r) => sum + r.aantal * r.eenheidsprijs * (r.btwPercentage / 100), 0);
  const totaal = subtotaal + btwBedrag;

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
      const res = await fetch(`/api/offertes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId: Number(klantId),
          projectId: projectId ? Number(projectId) : null,
          titel: titel.trim() || null,
          datum,
          geldigTot: geldigTot || null,
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

      addToast("Offerte bijgewerkt", "succes");
      router.push(`/offertes/${id}`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon offerte niet bijwerken", "fout");
    } finally {
      setLaden(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-48" />
        <div className="grid lg:grid-cols-[1fr_420px] gap-8">
          <div className="space-y-8">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
          <Skeleton className="h-[500px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!offerteData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-autronis-text-secondary text-lg">Offerte niet gevonden</p>
        <Link href="/offertes" className="text-autronis-accent hover:underline">Terug naar offertes</Link>
      </div>
    );
  }

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

      {/* Titel & Datum */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
        <h2 className="text-lg font-semibold text-autronis-text-primary mb-5">Details</h2>
        <div className="grid grid-cols-1 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">Titel</label>
            <input
              type="text"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Bijv. Website ontwikkeling & onderhoud"
              className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">Offertedatum</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">Geldig tot</label>
              <input
                type="date"
                value={geldigTot}
                onChange={(e) => setGeldigTot(e.target.value)}
                className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Offerteregels */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-autronis-text-primary">Offerteregels</h2>
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
                  <label className="block text-xs font-medium text-autronis-text-secondary">Prijs</label>
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
                    {formatBedrag(regel.aantal * regel.eenheidsprijs)}
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

        <div className="mt-6 flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-autronis-text-secondary">Subtotaal</span>
              <span className="text-autronis-text-primary tabular-nums">{formatBedrag(subtotaal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-autronis-text-secondary">BTW</span>
              <span className="text-autronis-text-primary tabular-nums">{formatBedrag(btwBedrag)}</span>
            </div>
            <div className="border-t border-autronis-border pt-2 flex justify-between">
              <span className="text-lg font-bold text-autronis-text-primary">Totaal</span>
              <span className="text-lg font-bold text-autronis-accent tabular-nums">{formatBedrag(totaal)}</span>
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
          placeholder="Optionele opmerkingen die onderaan de offerte verschijnen..."
          rows={3}
          className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none"
        />
      </div>

      {/* Acties */}
      <div className="flex items-center justify-end gap-4">
        <Link
          href={`/offertes/${id}`}
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

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        <Breadcrumb
          items={[
            { label: "Offertes", href: "/offertes" },
            { label: offerteData.offertenummer, href: `/offertes/${id}` },
            { label: "Bewerken" },
          ]}
        />

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-autronis-text-primary">Offerte bewerken</h1>

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

        <div className="hidden lg:grid lg:grid-cols-[1fr_420px] lg:gap-8 lg:items-start">
          {formContent}
          <OffertePreview
            klant={selectedKlant}
            titel={titel}
            datum={datum}
            geldigTot={geldigTot}
            regels={regels}
            subtotaal={subtotaal}
            btwBedrag={btwBedrag}
            totaal={totaal}
            notities={notities}
            offertenummer={offerteData.offertenummer}
          />
        </div>

        <div className="lg:hidden">
          {mobileView === "formulier" ? (
            formContent
          ) : (
            <OffertePreview
              klant={selectedKlant}
              titel={titel}
              datum={datum}
              geldigTot={geldigTot}
              regels={regels}
              subtotaal={subtotaal}
              btwBedrag={btwBedrag}
              totaal={totaal}
              notities={notities}
              offertenummer={offerteData.offertenummer}
            />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
