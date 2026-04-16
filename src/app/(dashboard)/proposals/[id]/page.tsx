"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Download,
  Link2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { DeckEditor } from "@/components/proposal-deck/DeckEditor";
import { Slide } from "@/components/proposal-deck/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Regel = {
  id: number;
  omschrijving: string;
  aantal: number;
  eenheidsprijs: number;
  totaal?: number | null;
};

let localRegelId = -1;
const newRegel = (): Regel => ({
  id: localRegelId--,
  omschrijving: "",
  aantal: 1,
  eenheidsprijs: 0,
});

export default function ProposalEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("concept");
  const [token, setToken] = useState<string | null>(null);
  const [klantNaam, setKlantNaam] = useState("");
  const [titel, setTitel] = useState("");
  const [geldigTot, setGeldigTot] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [regels, setRegels] = useState<Regel[]>([]);
  const [accepteerOpen, setAccepteerOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/proposals/${params.id}`);
        if (!res.ok) {
          addToast("Proposal niet gevonden", "fout");
          router.push("/proposals");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setStatus(data.proposal.status);
        setToken(data.proposal.token);
        setKlantNaam(data.proposal.klantNaam);
        setTitel(data.proposal.titel);
        setGeldigTot(data.proposal.geldigTot ?? "");
        setSlides(data.proposal.secties as Slide[]);
        setRegels(data.regels as Regel[]);
      } catch {
        if (!cancelled) addToast("Kon proposal niet laden", "fout");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router, addToast]);

  // beforeunload dirty guard
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/proposals/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel: titel.trim(),
          secties: slides,
          geldigTot: geldigTot || null,
          regels: regels.map((r) => ({
            omschrijving: r.omschrijving,
            aantal: r.aantal,
            eenheidsprijs: r.eenheidsprijs,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Opslaan mislukt");
      addToast("Opgeslagen", "succes");
      setDirty(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Opslaan mislukt", "fout");
    } finally {
      setSaving(false);
    }
  };

  const accepteer = async (naam: string) => {
    const res = await fetch(`/api/proposals/${params.id}/accepteren`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam }),
    });
    if (res.ok) {
      addToast("Gemarkeerd als geaccepteerd", "succes");
      setStatus("ondertekend");
      setAccepteerOpen(false);
    } else {
      addToast("Actie mislukt", "fout");
    }
  };

  const copyLink = () => {
    if (!token) return;
    navigator.clipboard.writeText(`${window.location.origin}/proposal/${token}`);
    addToast("Link gekopieerd", "succes");
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-autronis-text-secondary">Laden...</div>
    );
  }

  const isConcept = status === "concept";
  const totaal = regels.reduce(
    (sum, r) => sum + (Number(r.aantal) || 0) * (Number(r.eenheidsprijs) || 0),
    0,
  );

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
        <Link
          href="/proposals"
          className="inline-flex items-center gap-2 text-sm text-autronis-text-secondary hover:text-autronis-accent"
        >
          <ArrowLeft className="w-4 h-4" /> Terug naar proposals
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-autronis-text-secondary">{klantNaam}</div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">
              {titel || "(geen titel)"}
            </h1>
            <div className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">
              Status: {status}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-autronis-border text-sm text-autronis-text-primary hover:bg-autronis-card"
            >
              <Link2 className="w-4 h-4" /> Kopieer link
            </button>
            {token && (
              <a
                href={`/proposal/${token}?preview=1`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-autronis-border text-sm text-autronis-text-primary hover:bg-autronis-card"
              >
                <ExternalLink className="w-4 h-4" /> Preview
              </a>
            )}
            <a
              href={`/api/proposals/${params.id}/pdf`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-autronis-border text-sm text-autronis-text-primary hover:bg-autronis-card"
            >
              <Download className="w-4 h-4" /> PDF
            </a>
            {(status === "verzonden" || status === "bekeken") && (
              <button
                onClick={() => setAccepteerOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25"
              >
                <CheckCircle2 className="w-4 h-4" /> Markeer als geaccepteerd
              </button>
            )}
          </div>
        </div>

        {/* Metadata (editable only in concept) */}
        {isConcept ? (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
                Titel
              </label>
              <input
                type="text"
                value={titel}
                onChange={(e) => {
                  setTitel(e.target.value);
                  setDirty(true);
                }}
                className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
                Geldig tot
              </label>
              <input
                type="date"
                value={geldigTot}
                onChange={(e) => {
                  setGeldigTot(e.target.value);
                  setDirty(true);
                }}
                className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
              />
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-sm text-yellow-400">
            Deze proposal is niet meer in concept. Alleen status-acties zijn beschikbaar.
          </div>
        )}

        {/* Slides */}
        {isConcept && (
          <div>
            <h2 className="text-xl font-bold text-autronis-text-primary mb-4">Slides</h2>
            <DeckEditor
              slides={slides}
              onChange={(s) => {
                setSlides(s);
                setDirty(true);
              }}
            />
          </div>
        )}

        {/* Prijsregels */}
        {isConcept && (
          <div>
            <h2 className="text-xl font-bold text-autronis-text-primary mb-4">Prijsregels</h2>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-3">
              {regels.map((r, idx) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_80px_120px_120px_auto] gap-2 items-center"
                >
                  <input
                    type="text"
                    placeholder="Omschrijving"
                    value={r.omschrijving}
                    onChange={(e) => {
                      const next = [...regels];
                      next[idx] = { ...r, omschrijving: e.target.value };
                      setRegels(next);
                      setDirty(true);
                    }}
                    className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
                  />
                  <input
                    type="number"
                    value={r.aantal}
                    onChange={(e) => {
                      const next = [...regels];
                      next[idx] = { ...r, aantal: Number(e.target.value) };
                      setRegels(next);
                      setDirty(true);
                    }}
                    className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary tabular-nums"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={r.eenheidsprijs}
                    onChange={(e) => {
                      const next = [...regels];
                      next[idx] = { ...r, eenheidsprijs: Number(e.target.value) };
                      setRegels(next);
                      setDirty(true);
                    }}
                    className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary tabular-nums"
                  />
                  <div className="text-right tabular-nums font-semibold text-autronis-text-primary">
                    € {((Number(r.aantal) || 0) * (Number(r.eenheidsprijs) || 0)).toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRegels(regels.filter((x) => x.id !== r.id));
                      setDirty(true);
                    }}
                    className="px-2 text-autronis-text-secondary hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setRegels([...regels, newRegel()]);
                  setDirty(true);
                }}
                className="text-sm text-autronis-accent hover:underline"
              >
                + regel toevoegen
              </button>
              <div className="pt-4 border-t border-autronis-border text-right">
                <span className="text-xs uppercase text-autronis-text-secondary mr-3">Totaal</span>
                <span className="text-2xl font-bold text-autronis-accent tabular-nums">
                  € {totaal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {isConcept && (
          <div className="flex items-center gap-3 justify-end sticky bottom-4 bg-autronis-bg/80 backdrop-blur p-3 rounded-2xl border border-autronis-border">
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={save}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent text-autronis-bg font-semibold disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        )}

        <ConfirmDialog
          open={accepteerOpen}
          onClose={() => setAccepteerOpen(false)}
          onBevestig={() => accepteer("Handmatig geaccepteerd via dashboard")}
          titel="Markeer als geaccepteerd?"
          bericht="Dit zet de status op 'ondertekend'. Gebruik deze actie nadat de klant via call of mail akkoord heeft gegeven."
          bevestigTekst="Markeer geaccepteerd"
          variant="warning"
        />
      </div>
    </PageTransition>
  );
}
