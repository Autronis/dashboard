"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  ParkingCircle,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";
import { marked } from "marked";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "./confidence-badge";
import { useToast } from "@/hooks/use-toast";
import {
  useUpdateIdee,
  useDeleteIdee,
  useStartProject,
  useConfidenceRecalc,
  useParkeerIdee,
  useProjectPreview,
} from "@/hooks/queries/use-ideeen";
import type { Idee } from "@/hooks/queries/use-ideeen";

// ============ TYPES ============

interface ConfidenceBreakdown {
  klantbehoefte: { score: number; bronnen: Array<{ type: string; id: number; titel: string }> };
  marktvalidatie: { score: number; bronnen: Array<{ type: string; id: number; titel: string }> };
  autronisFit: { score: number; uitleg: string };
  effortRoi: { score: number; geschatteUren: number | null; potentieleOmzet: number | null };
  totaal: number;
  samenvatting: string;
}

// ============ CONSTANTS ============

const categorieLabels: Record<string, string> = {
  dashboard: "Dashboard",
  klant_verkoop: "Klant & Verkoop",
  intern: "Intern",
  dev_tools: "Dev Tools",
  content_media: "Content & Media",
  geld_groei: "Geld & Groei",
  experimenteel: "Experimenteel",
  website: "Website",
  inzicht: "Inzicht",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  idee: { label: "Idee", color: "bg-blue-500/15 text-blue-400" },
  uitgewerkt: { label: "Uitgewerkt", color: "bg-amber-500/15 text-amber-400" },
  actief: { label: "Actief", color: "bg-autronis-accent/15 text-autronis-accent" },
  gebouwd: { label: "Gebouwd", color: "bg-emerald-500/15 text-emerald-400" },
};

// ============ PROPS ============

interface IdeeDetailPanelProps {
  idee: Idee;
  onClose: () => void;
  onDaanSpar?: () => void;
}

// ============ COMPONENT ============

export function IdeeDetailPanel({ idee, onClose, onDaanSpar }: IdeeDetailPanelProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editNaam, setEditNaam] = useState(idee.naam);
  const [editOmschrijving, setEditOmschrijving] = useState(idee.omschrijving || "");
  const [editCategorie, setEditCategorie] = useState(idee.categorie || "experimenteel");
  const [previewModus, setPreviewModus] = useState<"zelf" | "team">("zelf");

  const { addToast } = useToast();
  const updateMutation = useUpdateIdee();
  const deleteMutation = useDeleteIdee();
  const startProjectMutation = useStartProject();
  const confidenceRecalc = useConfidenceRecalc();
  const parkeerMutation = useParkeerIdee();
  const { data: preview, isLoading: previewLoading } = useProjectPreview(
    showPreview ? idee.id : null
  );

  // Parse confidence breakdown from JSON string
  const breakdown: ConfidenceBreakdown | null = idee.confidenceBreakdown
    ? (() => {
        try {
          return JSON.parse(idee.confidenceBreakdown as string) as ConfidenceBreakdown;
        } catch {
          return null;
        }
      })()
    : null;

  // When preview loads, apply suggested modus
  const effectivePreviewModus =
    preview && !showPreview ? preview.suggestieModus : previewModus;
  void effectivePreviewModus; // used below in start button

  const statusInfo = statusLabels[idee.status] ?? { label: idee.status, color: "bg-autronis-border text-autronis-text-secondary" };
  const canStartProject = idee.status === "idee" || idee.status === "uitgewerkt";

  // ---- HANDLERS ----

  function handleSave() {
    updateMutation.mutate(
      {
        id: idee.id,
        body: {
          naam: editNaam,
          omschrijving: editOmschrijving,
          categorie: editCategorie,
        },
      },
      {
        onSuccess: () => {
          addToast("Idee opgeslagen", "succes");
          setEditing(false);
        },
        onError: (err) => {
          addToast(err instanceof Error ? err.message : "Opslaan mislukt", "fout");
        },
      }
    );
  }

  function handleDelete() {
    if (!confirm("Weet je zeker dat je dit idee wilt verwijderen?")) return;
    deleteMutation.mutate(idee.id, {
      onSuccess: () => {
        addToast("Idee verwijderd", "succes");
        onClose();
      },
      onError: (err) => {
        addToast(err instanceof Error ? err.message : "Verwijderen mislukt", "fout");
      },
    });
  }

  function handleParkeer() {
    const wordtGeparkeerd = !idee.geparkeerd;
    parkeerMutation.mutate(
      { id: idee.id, geparkeerd: wordtGeparkeerd },
      {
        onSuccess: () => {
          addToast(wordtGeparkeerd ? "Idee geparkeerd" : "Idee uit parkeerstand", "succes");
        },
        onError: (err) => {
          addToast(err instanceof Error ? err.message : "Parkeren mislukt", "fout");
        },
      }
    );
  }

  function handleHerbereken() {
    confidenceRecalc.mutate(idee.id, {
      onSuccess: () => {
        addToast("Confidence herberekend", "succes");
      },
      onError: (err) => {
        addToast(err instanceof Error ? err.message : "Herberekening mislukt", "fout");
      },
    });
  }

  function handleStartProject() {
    if (!showPreview) {
      setShowPreview(true);
      return;
    }
    startProjectMutation.mutate(
      { id: idee.id, modus: previewModus },
      {
        onSuccess: (data) => {
          addToast(`Project "${data.project.naam}" gestart!`, "succes");
          onClose();
        },
        onError: (err) => {
          addToast(err instanceof Error ? err.message : "Starten mislukt", "fout");
        },
      }
    );
  }

  // ---- RENDER ----

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="bg-autronis-card border border-autronis-border rounded-2xl p-6 overflow-y-auto max-h-[calc(100vh-8rem)] flex flex-col gap-5"
    >
      {/* === HEADER === */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            aria-label="Terug"
          >
            <ArrowLeft size={18} />
          </button>
          {editing ? (
            <input
              value={editNaam}
              onChange={(e) => setEditNaam(e.target.value)}
              className="flex-1 text-lg font-semibold bg-autronis-bg border border-autronis-border rounded-lg px-3 py-1 text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
            />
          ) : (
            <h2 className="flex-1 text-lg font-semibold text-autronis-text-primary leading-snug">
              {idee.naam}
            </h2>
          )}
          <ConfidenceBadge score={idee.aiScore} size="lg" />
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusInfo.color)}>
            {statusInfo.label}
          </span>
          {idee.categorie && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-autronis-border/60 text-autronis-text-secondary">
              {categorieLabels[idee.categorie] ?? idee.categorie}
            </span>
          )}
          {idee.bron && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-autronis-border/60 text-autronis-text-secondary">
              {idee.bron}
            </span>
          )}
          {idee.geparkeerd === 1 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              Geparkeerd
            </span>
          )}
        </div>
      </div>

      {/* === CONFIDENCE BREAKDOWN === */}
      {breakdown && (
        <div className="border border-autronis-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowBreakdown((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-autronis-border/20 transition-colors"
          >
            <span className="text-sm text-autronis-text-secondary leading-snug text-left flex-1 pr-2">
              {breakdown.samenvatting}
            </span>
            {showBreakdown ? (
              <ChevronUp size={16} className="text-autronis-text-secondary shrink-0" />
            ) : (
              <ChevronDown size={16} className="text-autronis-text-secondary shrink-0" />
            )}
          </button>

          {showBreakdown && (
            <div className="px-4 pb-4 flex flex-col gap-3">
              {/* Klantbehoefte 40% */}
              <BreakdownBar
                label="Klantbehoefte"
                score={breakdown.klantbehoefte.score}
                weight={40}
              />
              {/* Marktvalidatie 25% */}
              <BreakdownBar
                label="Marktvalidatie"
                score={breakdown.marktvalidatie.score}
                weight={25}
              />
              {/* Autronis Fit 20% */}
              <BreakdownBar
                label="Autronis Fit"
                score={breakdown.autronisFit.score}
                weight={20}
              />
              {/* Effort/ROI 15% */}
              <BreakdownBar
                label="Effort / ROI"
                score={breakdown.effortRoi.score}
                weight={15}
              />

              {breakdown.effortRoi.geschatteUren !== null && (
                <p className="text-xs text-autronis-text-secondary">
                  Geschatte uren: <span className="text-autronis-text-primary">{breakdown.effortRoi.geschatteUren}u</span>
                  {breakdown.effortRoi.potentieleOmzet !== null && (
                    <> &nbsp;·&nbsp; Potentieel: <span className="text-autronis-text-primary">€{breakdown.effortRoi.potentieleOmzet.toLocaleString("nl-NL")}</span></>
                  )}
                </p>
              )}

              <button
                onClick={handleHerbereken}
                disabled={confidenceRecalc.isPending}
                className="flex items-center gap-1.5 text-xs text-autronis-accent hover:text-autronis-accent/80 transition-colors self-start mt-1"
              >
                {confidenceRecalc.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                Herbereken
              </button>
            </div>
          )}
        </div>
      )}

      {/* === BRON TEKST === */}
      {idee.bronTekst && (
        <blockquote className="border-l-2 border-autronis-accent/50 pl-4 text-sm text-autronis-text-secondary italic leading-relaxed">
          {idee.bronTekst}
        </blockquote>
      )}

      {/* === OMSCHRIJVING === */}
      {(idee.omschrijving || editing) && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wide">
            Omschrijving
          </p>
          {editing ? (
            <textarea
              value={editOmschrijving}
              onChange={(e) => setEditOmschrijving(e.target.value)}
              rows={5}
              className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent resize-none"
            />
          ) : (
            <div
              className="prose prose-sm prose-invert max-w-none text-autronis-text-secondary [&>p]:leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: marked.parse(idee.omschrijving || "") as string,
              }}
            />
          )}
        </div>
      )}

      {/* === UITWERKING === */}
      {idee.uitwerking && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wide">
            Uitwerking
          </p>
          <div
            className="prose prose-sm prose-invert max-w-none text-autronis-text-secondary [&>p]:leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: marked.parse(idee.uitwerking) as string,
            }}
          />
        </div>
      )}

      {/* === EDIT CONTROLS === */}
      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wide">
              Categorie
            </label>
            <select
              value={editCategorie}
              onChange={(e) => setEditCategorie(e.target.value)}
              className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
            >
              {Object.entries(categorieLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-medium hover:bg-autronis-accent/90 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              Opslaan
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditNaam(idee.naam);
                setEditOmschrijving(idee.omschrijving || "");
                setEditCategorie(idee.categorie || "experimenteel");
              }}
              className="px-4 py-2 rounded-xl border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            >
              Annuleer
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="self-start text-sm text-autronis-accent hover:text-autronis-accent/80 transition-colors underline underline-offset-2"
        >
          Bewerken
        </button>
      )}

      {/* === START PROJECT === */}
      {canStartProject && (
        <div className="flex flex-col gap-3 border-t border-autronis-border pt-4">
          {!showPreview ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleStartProject}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-medium hover:bg-autronis-accent/90 transition-colors"
              >
                <Play size={14} />
                Start project
              </button>
              {onDaanSpar && (
                <button
                  onClick={onDaanSpar}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                >
                  <MessageSquare size={14} />
                  Eerst uitwerken
                </button>
              )}
              <button
                onClick={handleParkeer}
                disabled={parkeerMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors disabled:opacity-50"
              >
                {parkeerMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ParkingCircle size={14} />
                )}
                {idee.geparkeerd ? "Parkeerstand uit" : "Parkeer"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {previewLoading ? (
                <div className="flex items-center gap-2 text-sm text-autronis-text-secondary">
                  <Loader2 size={16} className="animate-spin" />
                  Preview laden…
                </div>
              ) : preview ? (
                <>
                  {/* Preview grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <PreviewStat label="Scope" value={`${preview.fases} fases`} />
                    <PreviewStat label="Doorlooptijd" value={preview.geschatteDoorlooptijd} />
                    <PreviewStat
                      label="Werkdruk"
                      value={`${preview.geschatteUren}u`}
                    />
                  </div>

                  {/* Eerste taken */}
                  {preview.eersteTaken.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wide">
                        Eerste taken
                      </p>
                      <ul className="flex flex-col gap-1">
                        {preview.eersteTaken.map((taak, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-autronis-text-secondary">
                            <span className="text-autronis-accent mt-0.5">•</span>
                            <span>{taak}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Vergelijkbaar project */}
                  {preview.vergelijkbaarProject && (
                    <p className="text-xs text-autronis-text-secondary">
                      Vergelijkbaar:{" "}
                      <span className="text-autronis-text-primary">{preview.vergelijkbaarProject}</span>
                    </p>
                  )}

                  {/* Actieve projecten waarschuwing */}
                  {preview.actieveProjecten > 0 && (
                    <p className="text-xs text-amber-400">
                      Let op: je hebt momenteel {preview.actieveProjecten} actieve project{preview.actieveProjecten !== 1 ? "en" : ""}
                    </p>
                  )}

                  {/* Zelf/Team toggle */}
                  <div className="flex items-center gap-1 p-1 bg-autronis-bg rounded-xl border border-autronis-border self-start">
                    {(["zelf", "team"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPreviewModus(m)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-sm font-medium transition-colors capitalize",
                          previewModus === m
                            ? "bg-autronis-accent text-autronis-bg"
                            : "text-autronis-text-secondary hover:text-autronis-text-primary"
                        )}
                      >
                        {m === "zelf" ? "Zelf" : "Team"}
                      </button>
                    ))}
                  </div>

                  {/* Acties */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleStartProject}
                      disabled={startProjectMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-medium hover:bg-autronis-accent/90 transition-colors disabled:opacity-50"
                    >
                      {startProjectMutation.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                      Start
                    </button>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="px-4 py-2 rounded-xl border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                    >
                      Annuleer
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-autronis-text-secondary">Preview niet beschikbaar.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* === DELETE === */}
      <div className="mt-auto pt-4 border-t border-autronis-border">
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
        >
          {deleteMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
          Verwijder idee
        </button>
      </div>
    </motion.div>
  );
}

// ============ SUB-COMPONENTS ============

function BreakdownBar({
  label,
  score,
  weight,
}: {
  label: string;
  score: number;
  weight: number;
}) {
  const barColor =
    score >= 60 ? "bg-emerald-400" : score >= 30 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-autronis-text-secondary">
          {label}{" "}
          <span className="text-autronis-text-secondary/60">({weight}%)</span>
        </span>
        <span className="text-autronis-text-primary font-medium tabular-nums">{score}</span>
      </div>
      <div className="h-1.5 bg-autronis-border rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-3 bg-autronis-bg rounded-xl border border-autronis-border">
      <p className="text-xs text-autronis-text-secondary">{label}</p>
      <p className="text-sm font-semibold text-autronis-text-primary">{value}</p>
    </div>
  );
}
