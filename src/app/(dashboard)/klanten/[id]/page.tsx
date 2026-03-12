"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Archive,
  FolderKanban,
  Clock,
  Euro,
  TrendingUp,
  Plus,
  Mail,
  Phone,
  MapPin,
  User,
  FileText,
  Link2,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { cn, formatUren, formatBedrag, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KlantModal } from "../klant-modal";
import { ProjectModal } from "./project-modal";
import { NoteModal } from "./note-modal";
import { DocumentModal } from "./document-modal";

interface Klant {
  id: number;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  email: string | null;
  telefoon: string | null;
  adres: string | null;
  uurtarief: number | null;
  notities: string | null;
}

interface Project {
  id: number;
  naam: string;
  omschrijving: string | null;
  status: string;
  voortgangPercentage: number | null;
  werkelijkeMinuten: number;
  geschatteUren: number | null;
  deadline: string | null;
  isActief: number;
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

interface Tijdregistratie {
  id: number;
  omschrijving: string;
  projectNaam: string | null;
  startTijd: string;
  duurMinuten: number;
  categorie: string | null;
}

interface KlantData {
  klant: Klant;
  projecten: Project[];
  notities: Notitie[];
  documenten: DocumentItem[];
  recenteTijdregistraties: Tijdregistratie[];
  kpis: {
    aantalProjecten: number;
    totaalMinuten: number;
    omzet: number;
    uurtarief: number;
  };
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  actief: { bg: "bg-green-500/15", text: "text-green-400", label: "Actief" },
  afgerond: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Afgerond" },
  "on-hold": { bg: "bg-amber-500/15", text: "text-amber-400", label: "On hold" },
  inactief: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Inactief" },
};

const notitieTypeConfig: Record<string, { border: string; label: string; badge: string }> = {
  belangrijk: {
    border: "border-l-red-500",
    label: "Belangrijk",
    badge: "bg-red-500/15 text-red-400",
  },
  afspraak: {
    border: "border-l-green-500",
    label: "Afspraak",
    badge: "bg-green-500/15 text-green-400",
  },
  notitie: {
    border: "border-l-slate-500",
    label: "Notitie",
    badge: "bg-slate-500/15 text-slate-400",
  },
};

const docTypeConfig: Record<string, { icon: typeof FileText; color: string }> = {
  contract: { icon: FileText, color: "text-red-400" },
  offerte: { icon: FileText, color: "text-amber-400" },
  link: { icon: Link2, color: "text-autronis-accent" },
  overig: { icon: FileText, color: "text-slate-400" },
};

export default function KlantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const id = Number(params.id);

  const [data, setData] = useState<KlantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [klantModalOpen, setKlantModalOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/klanten/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Fout bij ophalen klantgegevens");
      const json = await res.json();
      setData(json);
    } catch {
      addToast("Kon klantgegevens niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleArchive = async () => {
    try {
      const res = await fetch(`/api/klanten/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Klant gearchiveerd", "succes");
      router.push("/klanten");
    } catch {
      addToast("Kon klant niet archiveren", "fout");
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

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-2 border-autronis-accent/30 border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  // 404 state
  if (notFound || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-autronis-text-secondary text-lg">Klant niet gevonden</p>
        <Link
          href="/klanten"
          className="flex items-center gap-2 text-autronis-accent hover:underline text-base"
        >
          <ArrowLeft className="w-5 h-5" />
          Terug naar klanten
        </Link>
      </div>
    );
  }

  const { klant, projecten, notities, documenten, recenteTijdregistraties, kpis } = data;

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
      {/* Top section */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/klanten"
            className="inline-flex items-center gap-2 text-base text-autronis-text-secondary hover:text-autronis-text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Klanten
          </Link>
          <h1 className="text-3xl font-bold text-autronis-text-primary">
            {klant.bedrijfsnaam}
          </h1>
          {klant.notities && (
            <p className="text-base text-autronis-text-secondary">{klant.notities}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setKlantModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
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
            label: "Projecten",
            waarde: kpis.aantalProjecten.toString(),
            icon: FolderKanban,
          },
          {
            label: "Totaal uren",
            waarde: formatUren(kpis.totaalMinuten),
            icon: Clock,
          },
          {
            label: "Omzet",
            waarde: formatBedrag(kpis.omzet),
            icon: Euro,
            accent: true,
          },
          {
            label: "Uurtarief",
            waarde: formatBedrag(kpis.uurtarief),
            icon: TrendingUp,
            accent: true,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                <kpi.icon className="w-5 h-5 text-autronis-accent" />
              </div>
            </div>
            <p className={cn(
              "text-3xl font-bold",
              kpi.accent ? "text-autronis-accent" : "text-autronis-text-primary"
            )}>
              {kpi.waarde}
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              {kpi.label}
            </p>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column */}
        <div className="space-y-8">
          {/* Klantgegevens */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
            <h2 className="text-lg font-semibold text-autronis-text-primary mb-5">
              Klantgegevens
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Contactpersoon</p>
                  <p className="text-base text-autronis-text-primary mt-0.5">
                    {klant.contactpersoon || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">E-mail</p>
                  {klant.email ? (
                    <a
                      href={`mailto:${klant.email}`}
                      className="text-base text-autronis-accent hover:underline mt-0.5 block"
                    >
                      {klant.email}
                    </a>
                  ) : (
                    <p className="text-base text-autronis-text-primary mt-0.5">—</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Telefoon</p>
                  {klant.telefoon ? (
                    <a
                      href={`tel:${klant.telefoon}`}
                      className="text-base text-autronis-accent hover:underline mt-0.5 block"
                    >
                      {klant.telefoon}
                    </a>
                  ) : (
                    <p className="text-base text-autronis-text-primary mt-0.5">—</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Adres</p>
                  <p className="text-base text-autronis-text-primary mt-0.5">
                    {klant.adres || "—"}
                  </p>
                </div>
              </div>
            </div>
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
                Nog geen documenten of links toegevoegd.
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
                          <p className="text-base font-medium text-autronis-text-primary truncate">
                            {doc.naam}
                          </p>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDocId(doc.id);
                          }}
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
                Nog geen notities toegevoegd.
              </p>
            ) : (
              <div className="space-y-3">
                {notities.map((notitie) => {
                  const config = notitieTypeConfig[notitie.type] || notitieTypeConfig.notitie;
                  return (
                    <div
                      key={notitie.id}
                      className={cn(
                        "border-l-4 rounded-xl bg-autronis-bg/50 p-5",
                        config.border
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-semibold",
                            config.badge
                          )}
                        >
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

        {/* Right column */}
        <div className="space-y-8">
          {/* Projecten */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-autronis-text-primary">
                Projecten
              </h2>
              <button
                onClick={() => setProjectModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Project
              </button>
            </div>
            {projecten.length === 0 ? (
              <p className="text-base text-autronis-text-secondary">
                Nog geen projecten.
              </p>
            ) : (
              <div className="space-y-4">
                {projecten.map((project) => {
                  const status = statusConfig[project.status] || statusConfig.inactief;
                  const voortgang = project.voortgangPercentage ?? 0;
                  return (
                    <Link
                      key={project.id}
                      href={`/klanten/${id}/projecten/${project.id}`}
                      className="block bg-autronis-bg/50 rounded-xl p-5 space-y-3 hover:bg-autronis-bg/80 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-base font-semibold text-autronis-text-primary">
                          {project.naam}
                        </p>
                        <span
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0",
                            status.bg,
                            status.text
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                      {project.omschrijving && (
                        <p className="text-sm text-autronis-text-secondary line-clamp-2">
                          {project.omschrijving}
                        </p>
                      )}
                      {/* Progress bar */}
                      <div className="w-full bg-autronis-border rounded-full h-2">
                        <div
                          className="bg-autronis-accent h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(voortgang, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm text-autronis-text-secondary">
                        <span>
                          <Clock className="w-4 h-4 inline mr-1.5" />
                          {project.geschatteUren != null
                            ? `${formatUren(project.werkelijkeMinuten)} / ${formatUren(project.geschatteUren * 60)}`
                            : formatUren(project.werkelijkeMinuten)}
                        </span>
                        {project.deadline && (
                          <span>Deadline: {formatDatum(project.deadline)}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recente tijdregistraties */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
            <h2 className="text-lg font-semibold text-autronis-text-primary mb-5">
              Recente tijdregistraties
            </h2>
            {recenteTijdregistraties.length === 0 ? (
              <p className="text-base text-autronis-text-secondary">
                Geen recente tijdregistraties.
              </p>
            ) : (
              <div className="space-y-3">
                {recenteTijdregistraties.slice(0, 5).map((registratie) => (
                  <div
                    key={registratie.id}
                    className="bg-autronis-bg/50 rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base text-autronis-text-primary truncate">
                        {registratie.omschrijving}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {registratie.projectNaam && (
                          <span className="text-sm text-autronis-accent">
                            {registratie.projectNaam}
                          </span>
                        )}
                        <span className="text-sm text-autronis-text-secondary">
                          {formatDatum(registratie.startTijd)}
                        </span>
                      </div>
                    </div>
                    <span className="text-base font-bold text-autronis-text-primary flex-shrink-0 tabular-nums">
                      {formatUren(registratie.duurMinuten)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <KlantModal
        open={klantModalOpen}
        onClose={() => setKlantModalOpen(false)}
        klant={klant}
        onOpgeslagen={() => {
          setKlantModalOpen(false);
          fetchData();
        }}
      />

      <ConfirmDialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        onBevestig={handleArchive}
        titel="Klant archiveren?"
        bericht={`Weet je zeker dat je "${klant.bedrijfsnaam}" wilt archiveren? Deze actie kan niet ongedaan worden gemaakt.`}
        bevestigTekst="Archiveren"
        variant="danger"
      />

      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        klantId={id}
        onOpgeslagen={() => {
          setProjectModalOpen(false);
          fetchData();
        }}
      />

      <NoteModal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        klantId={id}
        onOpgeslagen={() => {
          setNoteModalOpen(false);
          fetchData();
        }}
      />

      <DocumentModal
        open={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        klantId={id}
        onOpgeslagen={() => {
          setDocumentModalOpen(false);
          fetchData();
        }}
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
  );
}
