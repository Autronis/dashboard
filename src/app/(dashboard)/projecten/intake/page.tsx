"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Target,
  FolderPlus,
  FileText,
  UserPlus,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ArrowLeft,
  Zap,
  Upload,
  SkipForward,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";

interface Invalshoek {
  naam: string;
  beschrijving: string;
  impact: string;
  aanpak: string;
}

interface Intake {
  id: number;
  projectId: number | null;
  scanId: number | null;
  stap: string;
  klantConcept: string | null;
  creatieveIdeeen: string | null;
  gekozenInvalshoek: string | null;
  scopeStatus: string;
  bron: string;
  aangemaaktOp: string | null;
}

const STAPPEN = [
  { key: "concept", label: "Concept", icon: Sparkles },
  { key: "invalshoeken", label: "Invalshoeken", icon: Target },
  { key: "project", label: "Project", icon: FolderPlus },
  { key: "scope", label: "Scope", icon: FileText },
  { key: "klant", label: "Klant", icon: UserPlus },
] as const;

type Eigenaar = "sem" | "syb" | "team" | "vrij";

const EIGENAAR_OPTIONS: Array<{ value: Eigenaar; label: string; subtitle: string }> = [
  { value: "sem", label: "Sem", subtitle: "alleen Sem ziet dit" },
  { value: "syb", label: "Syb", subtitle: "alleen Syb ziet dit" },
  { value: "team", label: "Team", subtitle: "beiden werken eraan" },
  { value: "vrij", label: "Vrij", subtitle: "open backlog" },
];

function IntakeWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const intakeIdParam = searchParams.get("id");
  const scanIdParam = searchParams.get("scanId");

  const [intake, setIntake] = useState<Intake | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Form state
  const [klantConcept, setKlantConcept] = useState("");
  const [invalshoeken, setInvalshoeken] = useState<Invalshoek[]>([]);
  const [gekozenInvalshoekIdx, setGekozenInvalshoekIdx] = useState<number | null>(null);
  const [projectNaam, setProjectNaam] = useState("");
  const [projectOmschrijving, setProjectOmschrijving] = useState("");
  const [projectEigenaar, setProjectEigenaar] = useState<Eigenaar | "">("");

  // Initialize intake: fetch existing or create new
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      try {
        if (intakeIdParam) {
          // Existing intake — load state
          const res = await fetch(`/api/projecten/intake/${intakeIdParam}`);
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.fout || "Intake niet geladen");
          }
          const data = await res.json();
          if (cancelled) return;
          const loadedIntake: Intake = data.intake;
          setIntake(loadedIntake);
          setKlantConcept(loadedIntake.klantConcept || "");
          if (loadedIntake.creatieveIdeeen) {
            try {
              const parsed = JSON.parse(loadedIntake.creatieveIdeeen);
              if (Array.isArray(parsed)) setInvalshoeken(parsed);
            } catch { /* ignore */ }
          }
        } else {
          // New intake — auto-create (with optional scanId pre-fill)
          const body: { scanId?: number } = {};
          if (scanIdParam) body.scanId = parseInt(scanIdParam, 10);
          const res = await fetch("/api/projecten/intake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.fout || "Intake aanmaken mislukt");
          }
          const data = await res.json();
          if (cancelled) return;
          const newIntake: Intake = data.intake;
          setIntake(newIntake);
          setKlantConcept(newIntake.klantConcept || "");
          // Replace URL so refresh doesn't create another intake
          router.replace(`/projecten/intake?id=${newIntake.id}`);
        }
      } catch (err) {
        if (!cancelled) {
          addToast(err instanceof Error ? err.message : "Fout bij laden", "fout");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeIdParam, scanIdParam]);

  const persistConcept = useCallback(async () => {
    if (!intake) return;
    if (klantConcept.trim().length < 20) {
      addToast("Beschrijf de klant/opdracht in minimaal 20 tekens", "fout");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/projecten/intake/${intake.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klantConcept, stap: "invalshoeken" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.fout || "Opslaan mislukt");
      }
      const data = await res.json();
      setIntake(data.intake);
      // Automatically trigger invalshoeken generation
      await generateInvalshoeken();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout bij opslaan", "fout");
    } finally {
      setBusy(false);
    }
  }, [intake, klantConcept, addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateInvalshoeken = useCallback(async () => {
    if (!intake) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projecten/intake/${intake.id}/invalshoeken`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.fout || "Invalshoeken genereren mislukt");
      }
      const data = await res.json();
      setIntake(data.intake);
      setInvalshoeken(data.invalshoeken);
      addToast(`${data.invalshoeken.length} invalshoeken gegenereerd`, "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "AI call mislukt", "fout");
    } finally {
      setBusy(false);
    }
  }, [intake, addToast]);

  const selectInvalshoek = useCallback(async (idx: number) => {
    if (!intake) return;
    setGekozenInvalshoekIdx(idx);
    const invalshoek = invalshoeken[idx];
    setBusy(true);
    try {
      const res = await fetch(`/api/projecten/intake/${intake.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gekozenInvalshoek: invalshoek.naam,
          stap: "project",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.fout || "Selectie opslaan mislukt");
      }
      const data = await res.json();
      setIntake(data.intake);
      // Pre-fill project naam from invalshoek if empty
      if (!projectNaam) setProjectNaam(invalshoek.naam);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout", "fout");
    } finally {
      setBusy(false);
    }
  }, [intake, invalshoeken, projectNaam, addToast]);

  const createProject = useCallback(async () => {
    if (!intake) return;
    if (!projectNaam.trim()) {
      addToast("Projectnaam is verplicht", "fout");
      return;
    }
    if (!projectEigenaar) {
      addToast("Kies een eigenaar", "fout");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/projecten/intake/${intake.id}/aanmaken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: projectNaam,
          eigenaar: projectEigenaar,
          omschrijving: projectOmschrijving || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.fout || "Project aanmaken mislukt");
      }
      const data = await res.json();
      setIntake(data.intake);
      addToast(`Project "${data.project.naam}" aangemaakt`, "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout", "fout");
    } finally {
      setBusy(false);
    }
  }, [intake, projectNaam, projectEigenaar, projectOmschrijving, addToast]);

  const skipScope = useCallback(async () => {
    if (!intake) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projecten/intake/${intake.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeStatus: "overgeslagen", stap: "klant" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.fout || "Opslaan mislukt");
      }
      const data = await res.json();
      setIntake(data.intake);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout", "fout");
    } finally {
      setBusy(false);
    }
  }, [intake, addToast]);

  const finishKlantStep = useCallback(async () => {
    if (!intake) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projecten/intake/${intake.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stap: "klaar" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.fout || "Opslaan mislukt");
      }
      addToast("Intake afgerond", "succes");
      if (intake.projectId) {
        router.push(`/projecten/${intake.projectId}`);
      } else {
        router.push("/projecten");
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout", "fout");
    } finally {
      setBusy(false);
    }
  }, [intake, addToast, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-autronis-accent" />
      </div>
    );
  }

  if (!intake) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-red-400">Intake kon niet geladen worden.</p>
        <Link href="/projecten" className="text-autronis-accent hover:underline mt-4 inline-block">
          ← Terug naar projecten
        </Link>
      </div>
    );
  }

  const currentStep = intake.stap;
  const stepIdx = STAPPEN.findIndex((s) => s.key === currentStep);

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/projecten"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Terug naar projecten
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Zap className="w-8 h-8 text-autronis-accent" />
            Project intake
          </h1>
          <p className="text-[var(--text-tertiary)] mt-2">
            Van concept naar werkend project in 5 stappen
            {intake.bron === "sales-engine" && intake.scanId && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-autronis-accent/15 text-autronis-accent">
                <Sparkles className="w-3 h-3" />
                Gestart vanuit Sales Engine scan
              </span>
            )}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STAPPEN.map((stap, idx) => {
              const Icon = stap.icon;
              const isActive = idx === stepIdx;
              const isDone = idx < stepIdx || currentStep === "klaar";
              return (
                <div key={stap.key} className="flex items-center flex-1 last:flex-none">
                  <div
                    className={`flex flex-col items-center ${
                      isActive ? "text-autronis-accent" : isDone ? "text-emerald-400" : "text-[var(--text-tertiary)]"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-colors ${
                        isActive
                          ? "border-autronis-accent bg-autronis-accent/15"
                          : isDone
                            ? "border-emerald-400 bg-emerald-400/15"
                            : "border-[var(--border)] bg-[var(--card)]"
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className="text-xs mt-2 font-medium">{stap.label}</span>
                  </div>
                  {idx < STAPPEN.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 transition-colors ${
                        idx < stepIdx ? "bg-emerald-400" : "bg-[var(--border)]"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 lg:p-8"
          >
            {currentStep === "concept" && (
              <div>
                <h2 className="text-xl font-semibold mb-2">Wat wil de klant?</h2>
                <p className="text-sm text-[var(--text-tertiary)] mb-6">
                  Beschrijf de klant, sector, de pijnpunten die je wil oplossen en wat je denkt te gaan bouwen.
                  Wees concreet — hoe meer context, hoe betere invalshoeken Claude kan voorstellen.
                </p>
                <textarea
                  value={klantConcept}
                  onChange={(e) => setKlantConcept(e.target.value)}
                  placeholder="Bijv: Acme BV is een e-commerce bedrijf met 15 medewerkers dat dagelijks 200+ orders handmatig verwerkt in Excel. Grootste knelpunt: de synchronisatie met hun boekhouding (Moneybird) kost elke ochtend 2 uur. We willen een n8n workflow bouwen die..."
                  rows={10}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:border-autronis-accent focus:outline-none resize-none"
                />
                <div className="flex justify-end mt-6">
                  <button
                    onClick={persistConcept}
                    disabled={busy || klantConcept.trim().length < 20}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-autronis-accent hover:bg-autronis-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Genereer invalshoeken
                  </button>
                </div>
              </div>
            )}

            {currentStep === "invalshoeken" && (
              <div>
                <h2 className="text-xl font-semibold mb-2">Kies een invalshoek</h2>
                <p className="text-sm text-[var(--text-tertiary)] mb-6">
                  Claude heeft {invalshoeken.length} richtingen voorgesteld. Kies de hoek waarop je verder wil bouwen.
                </p>
                {invalshoeken.length === 0 && !busy && (
                  <button
                    onClick={generateInvalshoeken}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25"
                  >
                    <Sparkles className="w-4 h-4" />
                    Opnieuw genereren
                  </button>
                )}
                {busy && (
                  <div className="flex items-center gap-3 text-[var(--text-tertiary)]">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Claude denkt na...
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {invalshoeken.map((iv, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectInvalshoek(idx)}
                      disabled={busy}
                      className={`text-left p-5 rounded-xl border-2 transition-all ${
                        gekozenInvalshoekIdx === idx
                          ? "border-autronis-accent bg-autronis-accent/10 shadow-[0_0_12px_rgba(23,184,165,0.25)]"
                          : "border-[var(--border)] bg-[var(--background)] hover:border-autronis-accent/50"
                      }`}
                    >
                      <h3 className="font-semibold text-base mb-2">{iv.naam}</h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">{iv.beschrijving}</p>
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="text-emerald-400 font-medium">Impact:</span>{" "}
                          <span className="text-[var(--text-tertiary)]">{iv.impact}</span>
                        </div>
                        <div>
                          <span className="text-autronis-accent font-medium">Aanpak:</span>{" "}
                          <span className="text-[var(--text-tertiary)]">{iv.aanpak}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === "project" && (
              <div>
                <h2 className="text-xl font-semibold mb-2">Project aanmaken</h2>
                <p className="text-sm text-[var(--text-tertiary)] mb-6">
                  Dit maakt een projecten-rij aan in het dashboard en creëert automatisch een GitHub repo.
                  De klant wordt nog NIET aangemaakt — dat doen we pas bij akkoord.
                </p>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-2">Projectnaam *</label>
                    <input
                      type="text"
                      value={projectNaam}
                      onChange={(e) => setProjectNaam(e.target.value)}
                      placeholder="Bijv: Acme Shopify → Moneybird Sync"
                      className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:border-autronis-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Omschrijving (optioneel — anders wordt klantConcept + invalshoek gebruikt)
                    </label>
                    <textarea
                      value={projectOmschrijving}
                      onChange={(e) => setProjectOmschrijving(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:border-autronis-accent focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Eigenaar *</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {EIGENAAR_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setProjectEigenaar(opt.value)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            projectEigenaar === opt.value
                              ? "border-autronis-accent bg-autronis-accent/10"
                              : "border-[var(--border)] bg-[var(--background)] hover:border-autronis-accent/50"
                          }`}
                        >
                          <div className="font-semibold">{opt.label}</div>
                          <div className="text-xs text-[var(--text-tertiary)] mt-1">{opt.subtitle}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <button
                    onClick={createProject}
                    disabled={busy || !projectNaam.trim() || !projectEigenaar}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-autronis-accent hover:bg-autronis-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                    Project aanmaken
                  </button>
                </div>
              </div>
            )}

            {currentStep === "scope" && (
              <ScopeStep
                intakeId={intake.id}
                projectId={intake.projectId}
                busy={busy}
                onSkip={skipScope}
                onGenerated={async (scopePdfUrl) => {
                  const res = await fetch(`/api/projecten/intake/${intake.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scopeStatus: "klaar", stap: "klant" }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setIntake(data.intake);
                  }
                  // Optimistic toast already handled inside ScopeStep
                  void scopePdfUrl;
                }}
              />
            )}

            {currentStep === "klant" && (
              <div>
                <h2 className="text-xl font-semibold mb-2">Klant koppeling — uitgesteld</h2>
                <p className="text-sm text-[var(--text-tertiary)] mb-6">
                  De klant wordt nog niet aangemaakt. Pas als de klant akkoord geeft op de scope/het voorstel,
                  kan je 'm aanmaken en koppelen aan het project via de klant-picker op de project detail page,
                  óf direct in een nieuwe Claude chat met &quot;klant akkoord&quot;.
                </p>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 mb-6">
                  <div className="flex items-start gap-3">
                    <UserPlus className="w-5 h-5 text-amber-400 mt-1" />
                    <div className="text-sm text-[var(--text-secondary)]">
                      <strong className="text-amber-400 block mb-1">Vervolgstappen wanneer er akkoord is:</strong>
                      <ol className="list-decimal ml-5 space-y-1">
                        <li>Open je project detail page</li>
                        <li>Klik op de &quot;Geen klant&quot; badge in de header</li>
                        <li>Kies een bestaande klant óf maak een nieuwe aan via <code className="bg-[var(--card)] px-1.5 rounded">/klanten</code></li>
                      </ol>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={finishKlantStep}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-500/90 disabled:opacity-50 text-white font-medium transition-colors"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Intake afronden
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Project link if already created */}
        {intake.projectId && (
          <div className="mt-6 flex justify-center">
            <Link
              href={`/projecten/${intake.projectId}`}
              className="inline-flex items-center gap-2 text-sm text-autronis-accent hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              Project {intake.projectId} openen in nieuw tabblad
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function ScopeUploadButton({
  projectId,
  disabled,
  onUploaded,
}: {
  projectId: number | null;
  disabled: boolean;
  onUploaded: () => void | Promise<void>;
}) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !projectId) return;
      if (!file.type.includes("pdf")) {
        addToast("Bestand moet een PDF zijn", "fout");
        return;
      }
      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/projecten/${projectId}/scope/upload`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.fout || "Upload mislukt");
        }
        const data = await res.json();
        addToast(`PDF geüpload: ${data.url}`, "succes");
        await onUploaded();
      } catch (err) {
        addToast(err instanceof Error ? err.message : "Upload fout", "fout");
      } finally {
        setBusy(false);
      }
    },
    [projectId, addToast, onUploaded]
  );

  return (
    <label
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25 font-medium transition-colors cursor-pointer ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
      PDF uploaden
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        disabled={disabled || busy}
        onChange={handleFile}
      />
    </label>
  );
}

export default function IntakeWizardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-autronis-accent" />
      </div>
    }>
      <IntakeWizardContent />
    </Suspense>
  );
}
