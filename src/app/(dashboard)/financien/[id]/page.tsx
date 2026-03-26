"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download,
  Mail,
  CheckCircle2,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";
import { cn, formatBedrag, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageTransition } from "@/components/ui/page-transition";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Confetti } from "@/components/ui/confetti-dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentPreview } from "@/components/shared/document-preview";

interface FactuurDetail {
  id: number;
  klantId: number;
  projectId: number | null;
  factuurnummer: string;
  status: string;
  bedragExclBtw: number;
  btwPercentage: number | null;
  btwBedrag: number | null;
  bedragInclBtw: number | null;
  factuurdatum: string | null;
  vervaldatum: string | null;
  betaaldOp: string | null;
  notities: string | null;
  klantNaam: string;
  klantContactpersoon: string | null;
  klantEmail: string | null;
  klantAdres: string | null;
  klantTaal: "nl" | "en" | null;
}

interface Regel {
  id: number;
  omschrijving: string;
  aantal: number | null;
  eenheidsprijs: number | null;
  btwPercentage: number | null;
  totaal: number | null;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  concept: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Concept" },
  verzonden: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verzonden" },
  betaald: { bg: "bg-green-500/15", text: "text-green-400", label: "Betaald" },
  te_laat: { bg: "bg-red-500/15", text: "text-red-400", label: "Te laat" },
};

function FactuurDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-48" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-44 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Preview card */}
      <div className="bg-white rounded-2xl p-8 lg:p-10 shadow-lg space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-7 w-32 mb-2 !bg-gray-200" />
            <Skeleton className="h-4 w-40 !bg-gray-100" />
          </div>
          <Skeleton className="h-9 w-32 !bg-gray-200" />
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 !bg-gray-100" />
            <Skeleton className="h-4 w-40 !bg-gray-200" />
            <Skeleton className="h-4 w-32 !bg-gray-100" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 !bg-gray-100" />
            <Skeleton className="h-4 w-36 !bg-gray-200" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full !bg-gray-100" />
          <Skeleton className="h-4 w-full !bg-gray-100" />
          <Skeleton className="h-4 w-3/4 !bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

export default function FactuurDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const id = Number(params.id);

  const [factuur, setFactuur] = useState<FactuurDetail | null>(null);
  const [regels, setRegels] = useState<Regel[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [verstuurLaden, setVerstuurLaden] = useState(false);
  const [verstuurModalOpen, setVerstuurModalOpen] = useState(false);
  const [emailAan, setEmailAan] = useState("");
  const [emailOnderwerp, setEmailOnderwerp] = useState("");
  const [emailBericht, setEmailBericht] = useState("");
  const [dupliceerLaden, setDupliceerLaden] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/facturen/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      setFactuur(json.factuur);
      setRegels(json.regels);
    } catch {
      addToast("Kon factuur niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBetaald = async () => {
    try {
      const res = await fetch(`/api/facturen/${id}/betaald`, { method: "PUT" });
      if (!res.ok) throw new Error();
      setShowConfetti(true);
      addToast("Factuur gemarkeerd als betaald", "succes");
      fetchData();
    } catch {
      addToast("Kon status niet bijwerken", "fout");
    }
  };

  const openVerstuurModal = () => {
    if (!factuur) return;
    const isEn = factuur.klantTaal === "en";
    const locale = isEn ? "en-GB" : "nl-NL";
    const bedrag = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(factuur.bedragInclBtw || 0);
    const naam = factuur.klantContactpersoon || factuur.klantNaam;
    setEmailAan(factuur.klantEmail || "");
    setEmailOnderwerp(isEn
      ? `Invoice ${factuur.factuurnummer} — Autronis`
      : `Factuur ${factuur.factuurnummer} — Autronis`);
    setEmailBericht(isEn
      ? `Dear ${naam},\n\nPlease find attached invoice ${factuur.factuurnummer} for the amount of ${bedrag}.\n\nKind regards,\nAutronis`
      : `Beste ${naam},\n\nIn de bijlage vindt u factuur ${factuur.factuurnummer} ter hoogte van ${bedrag}.\n\nMet vriendelijke groet,\nAutronis`
    );
    setVerstuurModalOpen(true);
  };

  const handleVerstuur = async () => {
    setVerstuurLaden(true);
    try {
      const res = await fetch(`/api/facturen/${id}/verstuur`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aan: emailAan, onderwerp: emailOnderwerp, bericht: emailBericht }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Onbekende fout");
      addToast("Factuur verstuurd per e-mail", "succes");
      setVerstuurModalOpen(false);
      fetchData();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon factuur niet versturen", "fout");
    } finally {
      setVerstuurLaden(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/facturen/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Factuur verwijderd");
      router.push("/financien");
    } catch {
      addToast("Kon factuur niet verwijderen", "fout");
    }
  };

  const handleDuplicate = async () => {
    if (!factuur) return;
    setDupliceerLaden(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const verval = new Date();
      verval.setDate(verval.getDate() + 30);
      const vervaldatum = verval.toISOString().slice(0, 10);

      const res = await fetch("/api/facturen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId: factuur.klantId,
          projectId: factuur.projectId,
          factuurdatum: today,
          vervaldatum,
          notities: factuur.notities || null,
          regels: regels.map((r) => ({
            omschrijving: r.omschrijving,
            aantal: r.aantal || 1,
            eenheidsprijs: r.eenheidsprijs || 0,
            btwPercentage: r.btwPercentage ?? 21,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Onbekende fout");
      }

      const { factuur: nieuw } = await res.json();
      addToast("Factuur gedupliceerd", "succes");
      router.push(`/financien/${nieuw.id}/bewerken`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon factuur niet dupliceren", "fout");
    } finally {
      setDupliceerLaden(false);
    }
  };

  if (loading) {
    return <FactuurDetailSkeleton />;
  }

  if (notFound || !factuur) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-autronis-text-secondary text-lg">Factuur niet gevonden</p>
        <Link href="/financien" className="flex items-center gap-2 text-autronis-accent hover:underline text-base">
          Terug naar financiën
        </Link>
      </div>
    );
  }

  const effectiveStatus = factuur.status === "verzonden" && factuur.vervaldatum && factuur.vervaldatum < new Date().toISOString().slice(0, 10)
    ? "te_laat"
    : factuur.status;
  const sc = statusConfig[effectiveStatus] || statusConfig.concept;

  const canDuplicate = factuur.status === "concept" || factuur.status === "betaald";

  return (
    <PageTransition>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Facturen", href: "/facturen" },
            { label: factuur.factuurnummer },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-autronis-text-primary">
                {factuur.factuurnummer}
              </h1>
              <span className={cn("text-xs px-3 py-1.5 rounded-full font-semibold", sc.bg, sc.text)}>
                {sc.label}
              </span>
            </div>
            <p className="text-base text-autronis-text-secondary">{factuur.klantNaam}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={`/api/facturen/${id}/pdf`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card hover:bg-autronis-card/80 border border-autronis-border text-autronis-text-primary rounded-xl text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </a>
            {(factuur.status === "concept" || factuur.status === "verzonden") && (
              <button
                onClick={openVerstuurModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
              >
                <Mail className="w-4 h-4" />
                Verstuur per e-mail
              </button>
            )}
            {factuur.status === "verzonden" && (
              <button
                onClick={handleBetaald}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Markeer als betaald
              </button>
            )}
            {canDuplicate && (
              <button
                onClick={handleDuplicate}
                disabled={dupliceerLaden}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card hover:bg-autronis-card/80 border border-autronis-border text-autronis-text-primary rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Copy className="w-4 h-4" />
                {dupliceerLaden ? "Dupliceren..." : "Dupliceren"}
              </button>
            )}
            {factuur.status === "concept" && (
              <>
                <Link
                  href={`/financien/${id}/bewerken`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card hover:bg-autronis-card/80 border border-autronis-border text-autronis-text-primary rounded-xl text-sm font-semibold transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Bewerken
                </Link>
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card hover:bg-autronis-card/80 border border-autronis-border text-autronis-text-secondary hover:text-red-400 rounded-xl text-sm font-semibold transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Factuur preview */}
        <DocumentPreview
          type="FACTUUR"
          klant={{
            bedrijfsnaam: factuur.klantNaam,
            contactpersoon: factuur.klantContactpersoon,
            adres: factuur.klantAdres,
            email: factuur.klantEmail,
          }}
          nummer={factuur.factuurnummer}
          datum={factuur.factuurdatum || ""}
          vervaldatum={factuur.vervaldatum || undefined}
          btwPercentage={factuur.btwPercentage || 21}
          regels={regels.map((r) => ({
            omschrijving: r.omschrijving,
            aantal: r.aantal || 1,
            eenheidsprijs: r.eenheidsprijs || 0,
            btwPercentage: r.btwPercentage ?? 21,
            totaal: r.totaal || 0,
          }))}
          subtotaal={factuur.bedragExclBtw}
          btwBedrag={factuur.btwBedrag || 0}
          totaal={factuur.bedragInclBtw || 0}
          notities={factuur.notities}
          betaaldOp={factuur.betaaldOp}
          taal={factuur.klantTaal === "en" ? "en" : "nl"}
        />

        {/* Delete dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onBevestig={handleDelete}
          titel="Factuur verwijderen?"
          bericht={`Weet je zeker dat je factuur ${factuur.factuurnummer} wilt verwijderen?`}
          bevestigTekst="Verwijderen"
          variant="danger"
        />

        {/* Verstuur e-mail modal */}
        {verstuurModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) setVerstuurModalOpen(false); }}>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-autronis-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-autronis-accent/10 rounded-xl">
                    <Mail className="w-5 h-5 text-autronis-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-autronis-text-primary">Factuur versturen</h3>
                    <p className="text-xs text-autronis-text-secondary">{factuur.factuurnummer} · PDF wordt bijgevoegd</p>
                  </div>
                </div>
                <button onClick={() => setVerstuurModalOpen(false)} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors">
                  <span className="text-lg">&times;</span>
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Aan</label>
                  <input
                    type="email"
                    value={emailAan}
                    onChange={(e) => setEmailAan(e.target.value)}
                    className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Onderwerp</label>
                  <input
                    type="text"
                    value={emailOnderwerp}
                    onChange={(e) => setEmailOnderwerp(e.target.value)}
                    className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Bericht</label>
                  <textarea
                    value={emailBericht}
                    onChange={(e) => setEmailBericht(e.target.value)}
                    rows={8}
                    className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none leading-relaxed"
                  />
                </div>
                <p className="text-xs text-autronis-text-secondary/60">De factuur-PDF wordt automatisch als bijlage meegestuurd.</p>
              </div>
              <div className="flex items-center justify-end gap-3 p-5 border-t border-autronis-border">
                <button onClick={() => setVerstuurModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
                  Annuleren
                </button>
                <button
                  onClick={handleVerstuur}
                  disabled={verstuurLaden || !emailAan}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  {verstuurLaden ? "Versturen..." : "Versturen"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
