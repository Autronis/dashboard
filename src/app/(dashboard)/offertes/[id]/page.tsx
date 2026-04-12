"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download,
  Mail,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  ArrowRightLeft,
} from "lucide-react";
import { cn, formatBedrag, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageTransition } from "@/components/ui/page-transition";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentPreview } from "@/components/shared/document-preview";

interface OfferteDetail {
  id: number;
  klantId: number;
  projectId: number | null;
  offertenummer: string;
  titel: string | null;
  status: string;
  datum: string | null;
  geldigTot: string | null;
  bedragExclBtw: number | null;
  btwPercentage: number | null;
  btwBedrag: number | null;
  bedragInclBtw: number | null;
  notities: string | null;
  klantNaam: string;
  klantContactpersoon: string | null;
  klantEmail: string | null;
  klantAdres: string | null;
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
  geaccepteerd: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Geaccepteerd" },
  verlopen: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Verlopen" },
  afgewezen: { bg: "bg-red-500/15", text: "text-red-400", label: "Afgewezen" },
};

function OfferteDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
      <Skeleton className="h-4 w-48" />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-44 rounded-xl" />
        </div>
      </div>
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

export default function OfferteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const id = Number(params.id);

  const [offerte, setOfferte] = useState<OfferteDetail | null>(null);
  const [regels, setRegels] = useState<Regel[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [verstuurLaden, setVerstuurLaden] = useState(false);
  const [converteerLaden, setConverteerLaden] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/offertes/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      setOfferte(json.offerte);
      setRegels(json.regels);
    } catch {
      addToast("Kon offerte niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVerstuur = async () => {
    setVerstuurLaden(true);
    try {
      const res = await fetch(`/api/offertes/${id}/verstuur`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Onbekende fout");
      addToast("Offerte verstuurd per e-mail", "succes");
      fetchData();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon offerte niet versturen", "fout");
    } finally {
      setVerstuurLaden(false);
    }
  };

  const handleStatusUpdate = async (nieuweStatus: string) => {
    try {
      const res = await fetch(`/api/offertes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nieuweStatus }),
      });
      if (!res.ok) throw new Error();
      addToast(
        nieuweStatus === "geaccepteerd"
          ? "Offerte gemarkeerd als geaccepteerd"
          : "Offerte gemarkeerd als afgewezen",
        "succes"
      );
      fetchData();
    } catch {
      addToast("Kon status niet bijwerken", "fout");
    }
  };

  const handleConverteer = async () => {
    setConverteerLaden(true);
    try {
      const res = await fetch(`/api/offertes/${id}/converteer`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Onbekende fout");
      addToast(`Factuur ${data.factuurnummer} aangemaakt`, "succes");
      router.push(`/financien/${data.factuurId}`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon offerte niet converteren", "fout");
    } finally {
      setConverteerLaden(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/offertes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Offerte verwijderd");
      router.push("/offertes");
    } catch {
      addToast("Kon offerte niet verwijderen", "fout");
    }
  };

  if (loading) {
    return <OfferteDetailSkeleton />;
  }

  if (notFound || !offerte) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-autronis-text-secondary text-lg">Offerte niet gevonden</p>
        <Link href="/offertes" className="flex items-center gap-2 text-autronis-accent hover:underline text-base">
          Terug naar offertes
        </Link>
      </div>
    );
  }

  const sc = statusConfig[offerte.status] || statusConfig.concept;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Offertes", href: "/offertes" },
            { label: offerte.offertenummer },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-autronis-text-primary">
                {offerte.offertenummer}
              </h1>
              <span className={cn("text-xs px-3 py-1.5 rounded-full font-semibold", sc.bg, sc.text)}>
                {sc.label}
              </span>
            </div>
            <p className="text-base text-autronis-text-secondary">
              {offerte.klantNaam}
              {offerte.titel && <span className="ml-2 text-autronis-text-secondary/70">- {offerte.titel}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={`/api/offertes/${id}/pdf`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card hover:bg-autronis-card/80 border border-autronis-border text-autronis-text-primary rounded-xl text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </a>
            {(offerte.status === "concept" || offerte.status === "verzonden") && (
              <button
                onClick={handleVerstuur}
                disabled={verstuurLaden}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                {verstuurLaden ? "Versturen..." : "Verstuur per e-mail"}
              </button>
            )}
            {offerte.status === "verzonden" && (
              <>
                <button
                  onClick={() => handleStatusUpdate("geaccepteerd")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Geaccepteerd
                </button>
                <button
                  onClick={() => handleStatusUpdate("afgewezen")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Afgewezen
                </button>
              </>
            )}
            {offerte.status === "geaccepteerd" && (
              <button
                onClick={handleConverteer}
                disabled={converteerLaden}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
              >
                <ArrowRightLeft className="w-4 h-4" />
                {converteerLaden ? "Converteren..." : "Converteer naar factuur"}
              </button>
            )}
            {offerte.status === "concept" && (
              <>
                <Link
                  href={`/offertes/${id}/bewerken`}
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

        {/* Offerte preview */}
        <DocumentPreview
          type="OFFERTE"
          klant={{
            bedrijfsnaam: offerte.klantNaam,
            contactpersoon: offerte.klantContactpersoon,
            adres: offerte.klantAdres,
            email: offerte.klantEmail,
          }}
          nummer={offerte.offertenummer}
          titel={offerte.titel || undefined}
          datum={offerte.datum || ""}
          geldigTot={offerte.geldigTot || undefined}
          btwPercentage={offerte.btwPercentage || 21}
          regels={regels.map((r) => ({
            omschrijving: r.omschrijving,
            aantal: r.aantal || 1,
            eenheidsprijs: r.eenheidsprijs || 0,
            btwPercentage: r.btwPercentage ?? 21,
            totaal: r.totaal || 0,
          }))}
          subtotaal={offerte.bedragExclBtw || 0}
          btwBedrag={offerte.btwBedrag || 0}
          totaal={offerte.bedragInclBtw || 0}
          notities={offerte.notities}
        />

        {/* Delete dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onBevestig={handleDelete}
          titel="Offerte verwijderen?"
          bericht={`Weet je zeker dat je offerte ${offerte.offertenummer} wilt verwijderen?`}
          bevestigTekst="Verwijderen"
          variant="danger"
        />
      </div>
    </PageTransition>
  );
}
