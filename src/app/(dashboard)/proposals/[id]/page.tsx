"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download,
  Mail,
  Pencil,
  Trash2,
  Link2,
  CheckCircle2,
  ExternalLink,
  Copy,
} from "lucide-react";
import { cn, formatBedrag, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageTransition } from "@/components/ui/page-transition";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

interface Sectie {
  id: string;
  titel: string;
  inhoud: string;
  actief: boolean;
}

interface ProposalDetail {
  id: number;
  klantId: number;
  klantNaam: string;
  klantEmail: string | null;
  klantContactpersoon: string | null;
  klantAdres: string | null;
  titel: string;
  status: string;
  secties: string;
  totaalBedrag: number | null;
  geldigTot: string | null;
  token: string | null;
  ondertekendOp: string | null;
  ondertekendDoor: string | null;
  ondertekening: string | null;
  aangemaaktDoor: number | null;
  aangemaaktOp: string | null;
  bijgewerktOp: string | null;
}

interface Regel {
  id: number;
  omschrijving: string;
  aantal: number | null;
  eenheidsprijs: number | null;
  totaal: number | null;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  concept: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Concept" },
  verzonden: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verzonden" },
  bekeken: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Bekeken" },
  ondertekend: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Ondertekend" },
  afgewezen: { bg: "bg-red-500/15", text: "text-red-400", label: "Afgewezen" },
};

function ProposalDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
      <Skeleton className="h-4 w-48" />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-44 rounded-xl" />
        </div>
      </div>
      <div className="bg-white rounded-2xl p-8 shadow-lg space-y-8">
        <Skeleton className="h-7 w-48 !bg-gray-200" />
        <Skeleton className="h-4 w-full !bg-gray-100" />
        <Skeleton className="h-4 w-3/4 !bg-gray-100" />
      </div>
    </div>
  );
}

export default function ProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const id = Number(params.id);

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [regels, setRegels] = useState<Regel[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [verstuurLaden, setVerstuurLaden] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/proposals/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      setProposal(json.proposal);
      setRegels(json.regels);
    } catch {
      addToast("Kon proposal niet laden", "fout");
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
      const res = await fetch(`/api/proposals/${id}/verstuur`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Onbekende fout");
      addToast("Proposal verstuurd per e-mail", "succes");
      fetchData();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon niet versturen", "fout");
    } finally {
      setVerstuurLaden(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Proposal verwijderd");
      router.push("/proposals");
    } catch {
      addToast("Kon proposal niet verwijderen", "fout");
    }
  };

  const handleCopyLink = () => {
    if (!proposal?.token) return;
    const url = `${window.location.origin}/proposal/${proposal.token}`;
    navigator.clipboard.writeText(url);
    addToast("Link gekopieerd", "succes");
  };

  if (loading) return <ProposalDetailSkeleton />;

  if (notFound || !proposal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-autronis-text-secondary text-lg">Proposal niet gevonden</p>
        <Link href="/proposals" className="text-autronis-accent hover:underline text-base">
          Terug naar proposals
        </Link>
      </div>
    );
  }

  const sc = statusConfig[proposal.status] || statusConfig.concept;
  const secties: Sectie[] = JSON.parse(proposal.secties || "[]");
  const actieveSecties = secties.filter((s) => s.actief);

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Proposals", href: "/proposals" },
            { label: proposal.titel },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-autronis-text-primary">
                {proposal.titel}
              </h1>
              <span className={cn("text-xs px-3 py-1.5 rounded-full font-semibold", sc.bg, sc.text)}>
                {sc.label}
              </span>
            </div>
            <p className="text-base text-autronis-text-secondary">
              {proposal.klantNaam}
              {proposal.aangemaaktOp && (
                <> &middot; {formatDatum(proposal.aangemaaktOp)}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card hover:bg-autronis-card/80 border border-autronis-border text-autronis-text-primary rounded-xl text-sm font-semibold transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Kopieer link
            </button>
            <a
              href={`/api/proposals/${id}/pdf`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card hover:bg-autronis-card/80 border border-autronis-border text-autronis-text-primary rounded-xl text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF
            </a>
            {(proposal.status === "concept" || proposal.status === "verzonden") && (
              <button
                onClick={handleVerstuur}
                disabled={verstuurLaden}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                {verstuurLaden ? "Versturen..." : "Verstuur"}
              </button>
            )}
            {proposal.status === "concept" && (
              <>
                <Link
                  href={`/proposals/${id}/bewerken`}
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

        {/* Public link */}
        {proposal.token && (
          <div className="flex items-center gap-3 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3">
            <ExternalLink className="w-4 h-4 text-autronis-text-secondary flex-shrink-0" />
            <code className="text-sm text-autronis-text-secondary flex-1 truncate">
              {typeof window !== "undefined"
                ? `${window.location.origin}/proposal/${proposal.token}`
                : `/proposal/${proposal.token}`}
            </code>
            <button
              onClick={handleCopyLink}
              className="p-1.5 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors flex-shrink-0"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Ondertekend info */}
        {proposal.status === "ondertekend" && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-400">
                Ondertekend door {proposal.ondertekendDoor}
              </p>
              {proposal.ondertekendOp && (
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  {formatDatum(proposal.ondertekendOp)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="bg-white rounded-2xl p-8 lg:p-10 shadow-lg space-y-10">
          {/* Cover */}
          <div className="text-center py-8 border-b border-gray-100">
            <p className="text-sm text-[#128C7E] font-semibold uppercase tracking-widest mb-3">
              Voorstel
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{proposal.titel}</h2>
            <p className="text-lg text-gray-500">
              Voor {proposal.klantContactpersoon || proposal.klantNaam}
            </p>
          </div>

          {/* Sections */}
          {actieveSecties.map((sectie) => (
            <div key={sectie.id} className="pb-8 border-b border-gray-100 last:border-0">
              <h3 className="text-xl font-bold text-gray-900 mb-4">{sectie.titel}</h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                {sectie.inhoud}
              </p>
            </div>
          ))}

          {/* Pricing */}
          {regels.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-6">Investering</h3>
              <table className="w-full mb-6">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Omschrijving
                    </th>
                    <th className="text-center py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">
                      Aantal
                    </th>
                    <th className="text-right py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">
                      Prijs
                    </th>
                    <th className="text-right py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">
                      Totaal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {regels.map((regel) => (
                    <tr key={regel.id} className="border-b border-gray-100">
                      <td className="py-3 text-sm text-gray-800">{regel.omschrijving}</td>
                      <td className="py-3 text-sm text-gray-800 text-center tabular-nums">
                        {regel.aantal || 1}
                      </td>
                      <td className="py-3 text-sm text-gray-800 text-right tabular-nums">
                        {formatBedrag(regel.eenheidsprijs || 0)}
                      </td>
                      <td className="py-3 text-sm text-gray-800 text-right tabular-nums">
                        {formatBedrag(regel.totaal || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="border-t-2 border-gray-200 pt-3">
                  <div className="flex items-center gap-8">
                    <span className="text-lg font-bold text-gray-800">Totaal</span>
                    <span className="text-lg font-bold text-[#128C7E] tabular-nums">
                      {formatBedrag(proposal.totaalBedrag || 0)}
                    </span>
                  </div>
                </div>
              </div>
              {proposal.geldigTot && (
                <p className="text-sm text-gray-400 mt-4 italic">
                  Geldig tot {formatDatum(proposal.geldigTot)}
                </p>
              )}
            </div>
          )}

          {/* Signature display */}
          {proposal.ondertekening && (
            <div className="border-t border-gray-200 pt-6">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                Ondertekening
              </p>
              {(() => {
                const sig: { type: string; data: string; naam: string } = JSON.parse(
                  proposal.ondertekening
                );
                return (
                  <div>
                    {sig.type === "tekening" ? (
                      <img
                        src={sig.data}
                        alt="Handtekening"
                        className="h-20 border border-gray-200 rounded-lg p-2"
                      />
                    ) : (
                      <p className="text-2xl text-gray-800" style={{ fontFamily: "cursive" }}>
                        {sig.naam}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-2">{sig.naam}</p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Delete dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onBevestig={handleDelete}
          titel="Proposal verwijderen?"
          bericht={`Weet je zeker dat je "${proposal.titel}" wilt verwijderen?`}
          bevestigTekst="Verwijderen"
          variant="danger"
        />
      </div>
    </PageTransition>
  );
}
