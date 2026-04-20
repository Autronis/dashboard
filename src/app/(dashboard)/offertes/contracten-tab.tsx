"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, Download, Trash2, Eye, Sparkles, Loader2,
  FileSignature, Shield, Handshake, X,
} from "lucide-react";
import { cn, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { contractTemplates, type ContractType } from "@/lib/contract-templates";

interface Contract {
  id: number;
  klantId: number | null;
  klantNaam: string | null;
  titel: string;
  type: string;
  status: string;
  aangemaaktOp: string | null;
  bijgewerktOp: string | null;
}

interface Klant {
  id: number;
  bedrijfsnaam: string;
  contactpersoon: string | null;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  concept: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Concept" },
  verzonden: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verzonden" },
  ondertekend: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Ondertekend" },
  verlopen: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Verlopen" },
};

const typeIcons: Record<string, typeof Handshake> = {
  samenwerkingsovereenkomst: Handshake,
  sla: Shield,
  nda: FileSignature,
};

const typeLabels: Record<string, string> = {
  samenwerkingsovereenkomst: "Samenwerking",
  sla: "SLA",
  nda: "NDA",
};

export function ContractenTab() {
  const { addToast } = useToast();

  const [contracten, setContracten] = useState<Contract[]>([]);
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [viewInhoud, setViewInhoud] = useState("");

  // New contract form
  const [formKlantId, setFormKlantId] = useState("");
  const [formType, setFormType] = useState<ContractType>("samenwerkingsovereenkomst");
  const [formTitel, setFormTitel] = useState("");
  const [formDetails, setFormDetails] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatedInhoud, setGeneratedInhoud] = useState("");
  const [editMode, setEditMode] = useState(false);

  const fetchContracten = useCallback(async () => {
    try {
      const res = await fetch("/api/contracten");
      const data = await res.json();
      setContracten(data.contracten || []);
    } catch {
      addToast("Kon contracten niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchContracten();
    fetch("/api/klanten").then((r) => r.json()).then((d) => setKlanten(d.klanten || []));
  }, [fetchContracten]);

  async function handleGenereer() {
    if (!formKlantId) {
      addToast("Selecteer een klant", "fout");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/contracten/genereer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId: Number(formKlantId),
          type: formType,
          details: formDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Genereren mislukt");
      setGeneratedInhoud(data.inhoud);
      setEditMode(true);
      addToast("Contract tekst gegenereerd", "succes");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Genereren mislukt", "fout");
    } finally {
      setGenerating(false);
    }
  }

  async function handleOpslaan() {
    if (!formKlantId || !formTitel.trim()) {
      addToast("Vul klant en titel in", "fout");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/contracten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId: Number(formKlantId),
          titel: formTitel.trim(),
          type: formType,
          inhoud: generatedInhoud,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Opslaan mislukt");
      }
      addToast("Contract opgeslagen", "succes");
      setShowModal(false);
      resetForm();
      fetchContracten();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Opslaan mislukt", "fout");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/contracten/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Contract verwijderd", "succes");
      setDeleteId(null);
      fetchContracten();
    } catch {
      addToast("Kon contract niet verwijderen", "fout");
    } finally {
      setDeleting(false);
    }
  }

  async function handleBekijk(contract: Contract) {
    try {
      const res = await fetch(`/api/contracten/${contract.id}`);
      const data = await res.json();
      setViewContract(contract);
      setViewInhoud(data.contract?.inhoud || "");
    } catch {
      addToast("Kon contract niet laden", "fout");
    }
  }

  function resetForm() {
    setFormKlantId("");
    setFormType("samenwerkingsovereenkomst");
    setFormTitel("");
    setFormDetails("");
    setGeneratedInhoud("");
    setEditMode(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-autronis-accent/30 border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-base text-autronis-text-secondary">
          {contracten.length} contract{contracten.length !== 1 ? "en" : ""}
        </p>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
        >
          <Plus className="w-4 h-4" />
          Nieuw contract
        </button>
      </div>

      {/* Lijst */}
      {contracten.length === 0 ? (
        <EmptyState
          titel="Nog geen contracten"
          beschrijving="Maak je eerste contract aan met AI-gegenereerde tekst."
          actieLabel="Nieuw contract"
          onActie={() => { resetForm(); setShowModal(true); }}
        />
      ) : (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-autronis-border">
                <th className="text-left py-3 px-5 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Titel</th>
                <th className="text-left py-3 px-5 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Klant</th>
                <th className="text-left py-3 px-5 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide max-sm:hidden">Type</th>
                <th className="text-left py-3 px-5 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide max-sm:hidden">Datum</th>
                <th className="text-center py-3 px-5 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Status</th>
                <th className="text-right py-3 px-5 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Acties</th>
              </tr>
            </thead>
            <tbody>
              {contracten.map((contract) => {
                const sc = statusConfig[contract.status] || statusConfig.concept;
                const Icon = typeIcons[contract.type] || FileText;
                return (
                  <tr key={contract.id} className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-autronis-accent/10 rounded-lg">
                          <Icon className="w-4 h-4 text-autronis-accent" />
                        </div>
                        <span className="font-medium text-autronis-text-primary">{contract.titel}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-sm text-autronis-text-primary">{contract.klantNaam || "\u2014"}</td>
                    <td className="py-4 px-5 text-sm text-autronis-text-secondary max-sm:hidden">
                      {typeLabels[contract.type] || contract.type}
                    </td>
                    <td className="py-4 px-5 text-sm text-autronis-text-secondary max-sm:hidden">
                      {contract.aangemaaktOp ? formatDatumKort(contract.aangemaaktOp) : "\u2014"}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", sc.bg, sc.text)}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleBekijk(contract)}
                          className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a
                          href={`/api/contracten/${contract.id}/pdf`}
                          className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => setDeleteId(contract.id)}
                          className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Nieuw contract modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-autronis-border">
              <h2 className="text-xl font-bold text-autronis-text-primary">Nieuw contract</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!editMode ? (
                <>
                  {/* Template selectie */}
                  <div>
                    <label className="block text-sm font-medium text-autronis-text-secondary mb-3">Type</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {contractTemplates.map((template) => {
                        const Icon = typeIcons[template.id] || FileText;
                        return (
                          <button
                            key={template.id}
                            onClick={() => {
                              setFormType(template.id);
                              setFormTitel(template.naam);
                            }}
                            className={cn(
                              "text-center p-4 rounded-xl border-2 transition-all",
                              formType === template.id
                                ? "border-autronis-accent bg-autronis-accent/10"
                                : "border-autronis-border hover:border-autronis-accent/50"
                            )}
                          >
                            <div className="flex justify-center mb-2">
                              <div className={cn(
                                "p-2.5 rounded-lg",
                                formType === template.id ? "bg-autronis-accent/20" : "bg-autronis-accent/10"
                              )}>
                                <Icon className="w-5 h-5 text-autronis-accent" />
                              </div>
                            </div>
                            <span className="font-semibold text-sm text-autronis-text-primary block mb-1">{template.naam}</span>
                            <p className="text-xs text-autronis-text-secondary leading-relaxed">{template.beschrijving}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Klant */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-autronis-text-secondary">
                        Klant <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={formKlantId}
                        onChange={(e) => setFormKlantId(e.target.value)}
                        className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 transition-colors"
                      >
                        <option value="">Selecteer klant...</option>
                        {klanten.map((k) => (
                          <option key={k.id} value={k.id}>{k.bedrijfsnaam}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-autronis-text-secondary">Titel</label>
                      <input
                        type="text"
                        value={formTitel}
                        onChange={(e) => setFormTitel(e.target.value)}
                        placeholder="Bijv. Samenwerkingsovereenkomst - ProjectX"
                        className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-autronis-text-secondary">
                      Aanvullende details (optioneel)
                    </label>
                    <textarea
                      value={formDetails}
                      onChange={(e) => setFormDetails(e.target.value)}
                      placeholder="Bijv. projectomvang, looptijd, specifieke voorwaarden..."
                      rows={3}
                      className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 transition-colors resize-none"
                    />
                  </div>

                  {/* Genereer button */}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="px-5 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={handleGenereer}
                      disabled={generating || !formKlantId}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Genereren...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Genereer met AI
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Edit generated content */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-autronis-text-secondary">Contract tekst</label>
                      <button
                        onClick={() => setEditMode(false)}
                        className="text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                      >
                        Terug naar instellingen
                      </button>
                    </div>
                    <textarea
                      value={generatedInhoud}
                      onChange={(e) => setGeneratedInhoud(e.target.value)}
                      rows={20}
                      className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-4 py-3 text-sm text-autronis-text-primary font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 transition-colors resize-y"
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleGenereer}
                      disabled={generating}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary border border-autronis-border rounded-xl transition-colors"
                    >
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Opnieuw genereren
                    </button>
                    <button
                      onClick={handleOpslaan}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {saving ? "Opslaan..." : "Opslaan als concept"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bekijk contract modal */}
      {viewContract && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-autronis-border">
              <div>
                <h2 className="text-xl font-bold text-autronis-text-primary">{viewContract.titel}</h2>
                <p className="text-sm text-autronis-text-secondary mt-1">
                  {viewContract.klantNaam} &middot; {typeLabels[viewContract.type] || viewContract.type}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/contracten/${viewContract.id}/pdf`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </a>
                <button
                  onClick={() => setViewContract(null)}
                  className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="prose prose-sm prose-invert max-w-none bg-autronis-bg rounded-xl p-6 whitespace-pre-wrap text-autronis-text-primary text-sm leading-relaxed font-mono">
                {viewInhoud || "Geen inhoud"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onBevestig={handleDelete}
        titel="Contract verwijderen?"
        bericht="Weet je zeker dat je dit contract wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
        bevestigTekst="Verwijderen"
        variant="danger"
      />
    </div>
  );
}
