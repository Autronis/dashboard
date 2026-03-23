"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Archive,
  Clock,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  Plus,
  Trash2,
  FileText,
  Link2,
  ExternalLink,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import { cn, formatUren, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProjectModal } from "../../project-modal";
import { NoteModal } from "../../note-modal";
import { DocumentModal } from "../../document-modal";
import { TaakModal } from "./taak-modal";
import { PageTransition } from "@/components/ui/page-transition";

interface ProjectData {
  project: {
    id: number;
    klantId: number;
    naam: string;
    omschrijving: string | null;
    status: string;
    voortgangPercentage: number | null;
    deadline: string | null;
    geschatteUren: number | null;
    werkelijkeUren: number | null;
    isActief: number;
  };
  klantNaam: string;
  taken: Taak[];
  tijdregistraties: Tijdregistratie[];
  notities: Notitie[];
  documenten: DocumentItem[];
  kpis: {
    totaalMinuten: number;
    takenTotaal: number;
    takenAfgerond: number;
    voortgang: number;
  };
}

interface Taak {
  id: number;
  titel: string;
  omschrijving: string | null;
  status: string;
  deadline: string | null;
  prioriteit: string;
  aangemaaktOp: string;
}

interface Tijdregistratie {
  id: number;
  omschrijving: string | null;
  startTijd: string;
  eindTijd: string | null;
  duurMinuten: number | null;
  categorie: string | null;
}

interface Notitie {
  id: number;
  inhoud: string;
  type: string;
  aangemaaktOp: string;
}

interface DocumentItem {
  id: number;
  naam: string;
  url: string | null;
  type: string;
  aangemaaktOp: string;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  actief: { bg: "bg-green-500/15", text: "text-green-400", label: "Actief" },
  afgerond: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Afgerond" },
  "on-hold": { bg: "bg-amber-500/15", text: "text-amber-400", label: "On hold" },
};

const taakStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Open" },
  bezig: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Bezig" },
  afgerond: { bg: "bg-green-500/15", text: "text-green-400", label: "Afgerond" },
};

const prioriteitConfig: Record<string, { color: string; label: string }> = {
  laag: { color: "text-slate-400", label: "Laag" },
  normaal: { color: "text-blue-400", label: "Normaal" },
  hoog: { color: "text-red-400", label: "Hoog" },
};

const notitieTypeConfig: Record<string, { border: string; label: string; badge: string }> = {
  belangrijk: { border: "border-l-red-500", label: "Belangrijk", badge: "bg-red-500/15 text-red-400" },
  afspraak: { border: "border-l-green-500", label: "Afspraak", badge: "bg-green-500/15 text-green-400" },
  notitie: { border: "border-l-slate-500", label: "Notitie", badge: "bg-slate-500/15 text-slate-400" },
};

const docTypeConfig: Record<string, { icon: typeof FileText; color: string }> = {
  contract: { icon: FileText, color: "text-red-400" },
  offerte: { icon: FileText, color: "text-amber-400" },
  link: { icon: Link2, color: "text-autronis-accent" },
  overig: { icon: FileText, color: "text-slate-400" },
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const klantId = Number(params.id);
  const projectId = Number(params.projectId);

  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [taakModalOpen, setTaakModalOpen] = useState(false);
  const [bewerkTaak, setBewerkTaak] = useState<Taak | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [deleteTaakId, setDeleteTaakId] = useState<number | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);
  const [taakFilter, setTaakFilter] = useState<string>("alle");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/klanten/${klantId}/projecten/${projectId}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      addToast("Kon projectgegevens niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [klantId, projectId, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleArchive = async () => {
    try {
      const res = await fetch(`/api/klanten/${klantId}/projecten/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Project gearchiveerd", "succes");
      router.push(`/klanten/${klantId}`);
    } catch {
      addToast("Kon project niet archiveren", "fout");
    }
  };

  const handleTaakStatus = async (taak: Taak, nieuweStatus: string) => {
    try {
      const res = await fetch(`/api/taken/${taak.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nieuweStatus }),
      });
      if (!res.ok) throw new Error();
      fetchData();
    } catch {
      addToast("Kon taakstatus niet bijwerken", "fout");
    }
  };

  const handleDeleteTaak = async () => {
    if (!deleteTaakId) return;
    try {
      const res = await fetch(`/api/taken/${deleteTaakId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Taak verwijderd");
      setDeleteTaakId(null);
      fetchData();
    } catch {
      addToast("Kon taak niet verwijderen", "fout");
    }
  };

  const handleDeleteDoc = async () => {
    if (!deleteDocId) return;
    try {
      const res = await fetch(`/api/documenten/${deleteDocId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Document verwijderd");
      setDeleteDocId(null);
      fetchData();
    } catch {
      addToast("Kon document niet verwijderen", "fout");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-2 border-autronis-accent/30 border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-autronis-text-secondary text-lg">Project niet gevonden</p>
        <Link
          href={`/klanten/${klantId}`}
          className="flex items-center gap-2 text-autronis-accent hover:underline text-base"
        >
          <ArrowLeft className="w-5 h-5" />
          Terug naar klant
        </Link>
      </div>
    );
  }

  const { project, klantNaam, taken, tijdregistraties, notities, documenten, kpis } = data;
  const status = statusConfig[project.status] || statusConfig.actief;

  const gefilterdeTaken = taakFilter === "alle"
    ? taken
    : taken.filter((t) => t.status === taakFilter);

  const deadlineVerstreken = project.deadline && new Date(project.deadline) < new Date();

  return (
    <PageTransition>
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <Link
            href={`/klanten/${klantId}`}
            className="inline-flex items-center gap-2 text-base text-autronis-text-secondary hover:text-autronis-text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            {klantNaam}
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">
              {project.naam}
            </h1>
            <span className={cn("text-xs px-3 py-1.5 rounded-full font-semibold", status.bg, status.text)}>
              {status.label}
            </span>
          </div>
          {project.omschrijving && (
            <p className="text-base text-autronis-text-secondary max-w-2xl">{project.omschrijving}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setProjectModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 btn-press"
          >
            <Pencil className="w-4 h-4" />
            Bewerken
          </button>
          <button
            onClick={() => setArchiveDialogOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card hover:bg-autronis-card/80 border border-autronis-border text-autronis-text-secondary hover:text-red-400 rounded-xl text-sm font-semibold transition-colors"
          >
            <Archive className="w-4 h-4" />
            Archiveren
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            label: "Uren gewerkt",
            waarde: formatUren(kpis.totaalMinuten),
            sub: project.geschatteUren ? `/ ${formatUren(project.geschatteUren * 60)} geschat` : null,
            icon: Clock,
          },
          {
            label: "Taken afgerond",
            waarde: `${kpis.takenAfgerond}/${kpis.takenTotaal}`,
            sub: kpis.takenTotaal > 0 ? `${Math.round((kpis.takenAfgerond / kpis.takenTotaal) * 100)}%` : null,
            icon: CheckCircle2,
          },
          {
            label: "Voortgang",
            waarde: `${kpis.voortgang}%`,
            icon: TrendingUp,
            accent: true,
          },
          {
            label: "Deadline",
            waarde: project.deadline ? formatDatum(project.deadline) : "Geen",
            icon: CalendarDays,
            danger: deadlineVerstreken,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "p-2.5 rounded-xl",
                kpi.danger ? "bg-red-500/10" : "bg-autronis-accent/10"
              )}>
                <kpi.icon className={cn(
                  "w-5 h-5",
                  kpi.danger ? "text-red-400" : "text-autronis-accent"
                )} />
              </div>
            </div>
            <p className={cn(
              "text-3xl font-bold",
              kpi.danger ? "text-red-400" : kpi.accent ? "text-autronis-accent" : "text-autronis-text-primary"
            )}>
              {kpi.waarde}
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              {kpi.label}
            </p>
            {kpi.sub && (
              <p className="text-sm text-autronis-text-secondary mt-0.5">{kpi.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-autronis-text-primary">Voortgang</h2>
          <span className="text-2xl font-bold text-autronis-accent">{kpis.voortgang}%</span>
        </div>
        <div className="w-full bg-autronis-border rounded-full h-3">
          <div
            className="bg-autronis-accent h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(kpis.voortgang, 100)}%` }}
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column — Taken */}
        <div className="space-y-8">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-autronis-accent" />
                Taken
              </h2>
              <button
                onClick={() => { setBewerkTaak(null); setTaakModalOpen(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Taak
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-2 mb-5">
              {[
                { key: "alle", label: "Alle" },
                { key: "open", label: "Open" },
                { key: "bezig", label: "Bezig" },
                { key: "afgerond", label: "Afgerond" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTaakFilter(f.key)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    taakFilter === f.key
                      ? "bg-autronis-accent text-autronis-bg"
                      : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {gefilterdeTaken.length === 0 ? (
              <p className="text-base text-autronis-text-secondary">
                {taakFilter === "alle" ? "Nog geen taken aangemaakt." : `Geen ${taakFilter} taken.`}
              </p>
            ) : (
              <div className="space-y-3">
                {gefilterdeTaken.map((taak) => {
                  const ts = taakStatusConfig[taak.status] || taakStatusConfig.open;
                  const prio = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
                  const volgendeStatus = taak.status === "open" ? "bezig" : taak.status === "bezig" ? "afgerond" : null;
                  return (
                    <div
                      key={taak.id}
                      className="bg-autronis-bg/50 rounded-xl p-5 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Status toggle button */}
                          <button
                            onClick={() => volgendeStatus && handleTaakStatus(taak, volgendeStatus)}
                            className={cn(
                              "mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                              taak.status === "afgerond"
                                ? "bg-green-500 border-green-500 text-white"
                                : taak.status === "bezig"
                                ? "border-amber-400 hover:bg-amber-400/20"
                                : "border-slate-500 hover:bg-slate-500/20"
                            )}
                          >
                            {taak.status === "afgerond" && (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              "text-base font-medium",
                              taak.status === "afgerond"
                                ? "text-autronis-text-secondary line-through"
                                : "text-autronis-text-primary"
                            )}>
                              {taak.titel}
                            </p>
                            {taak.omschrijving && (
                              <p className="text-sm text-autronis-text-secondary mt-1 line-clamp-2">
                                {taak.omschrijving}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", ts.bg, ts.text)}>
                                {ts.label}
                              </span>
                              {taak.prioriteit === "hoog" && (
                                <span className="flex items-center gap-1 text-xs text-red-400">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Hoog
                                </span>
                              )}
                              {taak.deadline && (
                                <span className={cn(
                                  "text-xs",
                                  new Date(taak.deadline) < new Date() && taak.status !== "afgerond"
                                    ? "text-red-400"
                                    : "text-autronis-text-secondary"
                                )}>
                                  <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
                                  {formatDatum(taak.deadline)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setBewerkTaak(taak); setTaakModalOpen(true); }}
                            className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTaakId(taak.id)}
                            className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Documenten & Links */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-autronis-text-primary">
                Documenten & Links
              </h2>
              <button
                onClick={() => setDocumentModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Toevoegen
              </button>
            </div>
            {documenten.length === 0 ? (
              <p className="text-base text-autronis-text-secondary">
                Nog geen documenten of links.
              </p>
            ) : (
              <div className="space-y-3">
                {documenten.map((doc) => {
                  const docConfig = docTypeConfig[doc.type] || docTypeConfig.overig;
                  const DocIcon = docConfig.icon;
                  return (
                    <div
                      key={doc.id}
                      className="bg-autronis-bg/50 rounded-xl p-4 flex items-center justify-between gap-4 group"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <DocIcon className={cn("w-5 h-5 flex-shrink-0", docConfig.color)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-medium text-autronis-text-primary truncate">{doc.naam}</p>
                          <p className="text-sm text-autronis-text-secondary mt-0.5">
                            {doc.type.charAt(0).toUpperCase() + doc.type.slice(1)} — {formatDatum(doc.aangemaaktOp)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-autronis-accent hover:text-autronis-accent-hover transition-colors px-3 py-1.5 rounded-lg hover:bg-autronis-accent/10"
                          >
                            Openen
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => setDeleteDocId(doc.id)}
                          className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-8">
          {/* Tijdregistraties */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
            <h2 className="text-lg font-semibold text-autronis-text-primary mb-5 flex items-center gap-2">
              <Clock className="w-5 h-5 text-autronis-accent" />
              Tijdregistraties
            </h2>
            {tijdregistraties.length === 0 ? (
              <p className="text-base text-autronis-text-secondary">
                Geen tijdregistraties voor dit project.
              </p>
            ) : (
              <div className="space-y-3">
                {tijdregistraties.slice(0, 10).map((reg) => (
                  <div
                    key={reg.id}
                    className="bg-autronis-bg/50 rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base text-autronis-text-primary truncate">
                        {reg.omschrijving || "Geen omschrijving"}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-autronis-text-secondary">
                          {formatDatum(reg.startTijd)}
                        </span>
                        {reg.categorie && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-autronis-accent/10 text-autronis-accent font-medium">
                            {reg.categorie}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-base font-bold text-autronis-text-primary flex-shrink-0 tabular-nums">
                      {reg.duurMinuten ? formatUren(reg.duurMinuten) : "—"}
                    </span>
                  </div>
                ))}
                {tijdregistraties.length > 10 && (
                  <p className="text-sm text-autronis-text-secondary text-center pt-2">
                    + {tijdregistraties.length - 10} meer registraties
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Notities & Afspraken */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-autronis-text-primary">
                Notities & Afspraken
              </h2>
              <button
                onClick={() => setNoteModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Notitie
              </button>
            </div>
            {notities.length === 0 ? (
              <p className="text-base text-autronis-text-secondary">
                Nog geen notities.
              </p>
            ) : (
              <div className="space-y-3">
                {notities.map((notitie) => {
                  const config = notitieTypeConfig[notitie.type] || notitieTypeConfig.notitie;
                  return (
                    <div
                      key={notitie.id}
                      className={cn("border-l-4 rounded-xl bg-autronis-bg/50 p-5", config.border)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", config.badge)}>
                          {config.label}
                        </span>
                        <span className="text-sm text-autronis-text-secondary">
                          {formatDatum(notitie.aangemaaktOp)}
                        </span>
                      </div>
                      <p className="text-base text-autronis-text-primary leading-relaxed">
                        {notitie.inhoud}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        klantId={klantId}
        project={data.project}
        onOpgeslagen={() => {
          setProjectModalOpen(false);
          fetchData();
        }}
      />

      <ConfirmDialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        onBevestig={handleArchive}
        titel="Project archiveren?"
        bericht={`Weet je zeker dat je "${project.naam}" wilt archiveren?`}
        bevestigTekst="Archiveren"
        variant="danger"
      />

      <TaakModal
        open={taakModalOpen}
        onClose={() => { setTaakModalOpen(false); setBewerkTaak(null); }}
        projectId={projectId}
        taak={bewerkTaak}
        onOpgeslagen={() => {
          setTaakModalOpen(false);
          setBewerkTaak(null);
          fetchData();
        }}
      />

      <NoteModal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        klantId={klantId}
        projectId={projectId}
        onOpgeslagen={() => {
          setNoteModalOpen(false);
          fetchData();
        }}
      />

      <DocumentModal
        open={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        klantId={klantId}
        projectId={projectId}
        onOpgeslagen={() => {
          setDocumentModalOpen(false);
          fetchData();
        }}
      />

      <ConfirmDialog
        open={deleteTaakId !== null}
        onClose={() => setDeleteTaakId(null)}
        onBevestig={handleDeleteTaak}
        titel="Taak verwijderen?"
        bericht="Weet je zeker dat je deze taak wilt verwijderen?"
        bevestigTekst="Verwijderen"
        variant="danger"
      />

      <ConfirmDialog
        open={deleteDocId !== null}
        onClose={() => setDeleteDocId(null)}
        onBevestig={handleDeleteDoc}
        titel="Document verwijderen?"
        bericht="Weet je zeker dat je dit document wilt verwijderen?"
        bevestigTekst="Verwijderen"
        variant="danger"
      />
    </div>
    </PageTransition>
  );
}
