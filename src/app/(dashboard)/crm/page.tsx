"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  Plus,
  Euro,
  TrendingUp,
  Users,
  X,
  Trash2,
  Phone,
  Mail,
  CalendarClock,
  ArrowRightLeft,
  Send,
  MessageSquare,
  PhoneCall,
  Calendar,
} from "lucide-react";
import { cn, formatBedrag, formatDatum } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmailComposer } from "@/components/ui/email-composer";
import { useLeads, useLeadActiviteiten, useAfzenderEmail, type Lead, type Activiteit } from "@/hooks/queries/use-leads";
import { PageTransition } from "@/components/ui/page-transition";

// ============ CONSTANTS ============

const statusKolommen: { key: string; label: string; color: string; bg: string; bgHover: string }[] = [
  { key: "nieuw", label: "Nieuw", color: "text-slate-400", bg: "border-slate-500/50", bgHover: "border-slate-400" },
  { key: "contact", label: "Contact", color: "text-blue-400", bg: "border-blue-500/50", bgHover: "border-blue-400" },
  { key: "offerte", label: "Offerte", color: "text-yellow-400", bg: "border-yellow-500/50", bgHover: "border-yellow-400" },
  { key: "gewonnen", label: "Gewonnen", color: "text-green-400", bg: "border-green-500/50", bgHover: "border-green-400" },
  { key: "verloren", label: "Verloren", color: "text-red-400", bg: "border-red-500/50", bgHover: "border-red-400" },
];

const activiteitIcoon: Record<string, typeof ArrowRightLeft> = {
  status_gewijzigd: ArrowRightLeft,
  email_verstuurd: Send,
  notitie: MessageSquare,
  telefoon: PhoneCall,
  afspraak: Calendar,
};

// ============ DROPPABLE COLUMN ============

function DroppableKolom({
  kolomKey,
  isOver,
  children,
}: {
  kolomKey: string;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: kolomKey });
  const kolom = statusKolommen.find((k) => k.key === kolomKey);

  return (
    <div ref={setNodeRef} className="space-y-3">
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 rounded-xl border-l-4 transition-colors",
          isOver ? kolom?.bgHover : kolom?.bg,
          isOver && "bg-autronis-accent/5"
        )}
      >
        <span className={cn("text-sm font-semibold", kolom?.color)}>{kolom?.label}</span>
      </div>
      <div
        className={cn(
          "space-y-2 min-h-[80px] rounded-xl p-1 transition-colors",
          isOver && "bg-autronis-accent/5 ring-1 ring-autronis-accent/30"
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ============ DRAGGABLE LEAD CARD ============

function DraggableLeadCard({
  lead,
  kolomKey,
  isDragging,
  onClick,
}: {
  lead: Lead;
  kolomKey: string;
  isDragging: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `lead-${lead.id}`,
    data: { lead, kolomKey },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const vandaag = new Date().toISOString().slice(0, 10);
  const actieVerlopen = lead.volgendeActieDatum && lead.volgendeActieDatum < vandaag;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "w-full text-left bg-autronis-card border border-autronis-border rounded-xl p-4 hover:border-autronis-accent/50 transition-all group cursor-grab active:cursor-grabbing card-glow",
        isDragging && "opacity-30"
      )}
    >
      <LeadCardContent lead={lead} actieVerlopen={!!actieVerlopen} />
    </div>
  );
}

// ============ LEAD CARD CONTENT (shared by card + overlay) ============

function LeadCardContent({ lead, actieVerlopen }: { lead: Lead; actieVerlopen: boolean }) {
  return (
    <>
      <p className="text-sm font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors truncate">
        {lead.bedrijfsnaam}
      </p>
      {lead.contactpersoon && (
        <p className="text-xs text-autronis-text-secondary mt-0.5 truncate">
          {lead.contactpersoon}
        </p>
      )}
      <div className="flex items-center justify-between mt-3">
        {lead.waarde != null ? (
          <span className="text-sm font-bold text-autronis-accent tabular-nums">
            {formatBedrag(lead.waarde)}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          {lead.email && <Mail className="w-3 h-3 text-autronis-text-secondary" />}
          {lead.telefoon && <Phone className="w-3 h-3 text-autronis-text-secondary" />}
        </div>
      </div>
      {lead.volgendeActie && (
        <div
          className={cn(
            "mt-2 flex items-center gap-1.5 text-xs",
            actieVerlopen ? "text-red-400" : "text-autronis-text-secondary"
          )}
        >
          <CalendarClock className="w-3 h-3" />
          <span className="truncate">{lead.volgendeActie}</span>
          {lead.volgendeActieDatum && (
            <span className="flex-shrink-0">&middot; {formatDatum(lead.volgendeActieDatum)}</span>
          )}
        </div>
      )}
    </>
  );
}

// ============ ACTIVITEITEN TIMELINE ============

function tijdGeleden(datum: string): string {
  const nu = new Date();
  const d = new Date(datum);
  const diffMs = nu.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Zojuist";
  if (diffMin < 60) return `${diffMin} min geleden`;
  const diffUur = Math.floor(diffMin / 60);
  if (diffUur < 24) return `${diffUur} uur geleden`;
  const diffDag = Math.floor(diffUur / 24);
  if (diffDag < 7) return `${diffDag} dag${diffDag > 1 ? "en" : ""} geleden`;
  return formatDatum(datum);
}

function ActiviteitenTimeline({ activiteiten }: { activiteiten: Activiteit[] }) {
  if (activiteiten.length === 0) {
    return (
      <p className="text-sm text-autronis-text-secondary py-4 text-center">
        Nog geen activiteiten
      </p>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-autronis-border" />

      {activiteiten.map((act) => {
        const Icoon = activiteitIcoon[act.type] || MessageSquare;
        return (
          <div key={act.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
            {/* Icon dot */}
            <div className="absolute -left-6 mt-0.5 w-[22px] h-[22px] rounded-full bg-autronis-card border border-autronis-border flex items-center justify-center z-10">
              <Icoon className="w-3 h-3 text-autronis-accent" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-autronis-text-primary truncate">
                {act.titel}
              </p>
              {act.omschrijving && (
                <p className="text-xs text-autronis-text-secondary mt-0.5 line-clamp-2">
                  {act.omschrijving}
                </p>
              )}
              {act.aangemaaktOp && (
                <p className="text-xs text-autronis-text-secondary/60 mt-1">
                  {tijdGeleden(act.aangemaaktOp)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ MAIN PAGE ============

export default function CrmPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [zoek, setZoek] = useState("");

  const { data: leadsData, isLoading: loading } = useLeads(zoek);
  const allLeads = leadsData?.leads ?? [];
  const kpis = leadsData?.kpis ?? {
    totaal: 0, nieuw: 0, contact: 0, offerte: 0,
    gewonnen: 0, verloren: 0, pipelineWaarde: 0, gewonnenWaarde: 0,
  };

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Email composer state
  const [emailOpen, setEmailOpen] = useState(false);

  // Afzender email
  const { data: afzenderEmail } = useAfzenderEmail();

  // Activiteiten
  const [activiteitenLeadId, setActiviteitenLeadId] = useState<number | null>(null);
  const { data: activiteiten = [], isLoading: activiteitenLaden } = useLeadActiviteiten(activiteitenLeadId);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overKolom, setOverKolom] = useState<string | null>(null);

  // Form
  const [bedrijfsnaam, setBedrijfsnaam] = useState("");
  const [contactpersoon, setContactpersoon] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [waarde, setWaarde] = useState<string>("");
  const [status, setStatus] = useState("nieuw");
  const [bron, setBron] = useState("");
  const [notities, setNotities] = useState("");
  const [volgendeActie, setVolgendeActie] = useState("");
  const [volgendeActieDatum, setVolgendeActieDatum] = useState("");

  // Sensors - pointer with activation distance to allow clicks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const invalidateLeads = () => queryClient.invalidateQueries({ queryKey: ["leads"] });
  const invalidateActiviteiten = () => queryClient.invalidateQueries({ queryKey: ["lead-activiteiten"] });

  const saveMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number | null; body: Record<string, unknown> }) => {
      if (id) {
        const res = await fetch(`/api/leads/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
      }
    },
    onSuccess: (_data, variables) => {
      addToast(variables.id ? "Lead bijgewerkt" : "Lead aangemaakt", "succes");
      setModalOpen(false);
      invalidateLeads();
    },
    onError: () => {
      addToast("Kon lead niet opslaan", "fout");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      addToast("Lead verwijderd");
      setModalOpen(false);
      setDeleteDialogOpen(false);
      invalidateLeads();
    },
    onError: () => {
      addToast("Kon lead niet verwijderen", "fout");
    },
  });

  function openNieuwModal() {
    setSelectedLead(null);
    setBedrijfsnaam("");
    setContactpersoon("");
    setEmail("");
    setTelefoon("");
    setWaarde("");
    setStatus("nieuw");
    setBron("");
    setNotities("");
    setVolgendeActie("");
    setVolgendeActieDatum("");
    setActiviteitenLeadId(null);
    setModalOpen(true);
  }

  function openEditModal(lead: Lead) {
    setSelectedLead(lead);
    setBedrijfsnaam(lead.bedrijfsnaam);
    setContactpersoon(lead.contactpersoon || "");
    setEmail(lead.email || "");
    setTelefoon(lead.telefoon || "");
    setWaarde(lead.waarde != null ? String(lead.waarde) : "");
    setStatus(lead.status);
    setBron(lead.bron || "");
    setNotities(lead.notities || "");
    setVolgendeActie(lead.volgendeActie || "");
    setVolgendeActieDatum(lead.volgendeActieDatum || "");
    setModalOpen(true);
    setActiviteitenLeadId(lead.id);
  }

  function handleOpslaan() {
    if (!bedrijfsnaam.trim()) {
      addToast("Bedrijfsnaam is verplicht", "fout");
      return;
    }
    const body = {
      bedrijfsnaam,
      contactpersoon,
      email,
      telefoon,
      waarde: waarde ? Number(waarde) : null,
      status,
      bron,
      notities,
      volgendeActie,
      volgendeActieDatum: volgendeActieDatum || null,
    };
    saveMutation.mutate({ id: selectedLead?.id ?? null, body });
  }

  function handleDelete() {
    if (!selectedLead) return;
    deleteMutation.mutate(selectedLead.id);
  }

  const statusChangeMutation = useMutation({
    mutationFn: async ({ leadId, oudeStatus, nieuweStatus }: { leadId: number; oudeStatus: string; nieuweStatus: string }) => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nieuweStatus }),
      });
      if (!res.ok) throw new Error();

      const oudeLabel = statusKolommen.find((k) => k.key === oudeStatus)?.label || oudeStatus;
      const nieuweLabel = statusKolommen.find((k) => k.key === nieuweStatus)?.label || nieuweStatus;

      await fetch(`/api/leads/${leadId}/activiteiten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "status_gewijzigd",
          titel: `Status gewijzigd: ${oudeLabel} → ${nieuweLabel}`,
          omschrijving: null,
          oudeStatus,
          nieuweStatus,
        }),
      });
    },
    onSuccess: () => {
      invalidateLeads();
    },
    onError: () => {
      addToast("Kon status niet bijwerken", "fout");
      invalidateLeads();
    },
  });

  function handleStatusChange(leadId: number, oudeStatus: string, nieuweStatus: string) {
    queryClient.setQueryData(["leads", zoek], (old: typeof leadsData) => {
      if (!old) return old;
      return {
        ...old,
        leads: old.leads.map((l: Lead) => (l.id === leadId ? { ...l, status: nieuweStatus } : l)),
      };
    });
    statusChangeMutation.mutate({ leadId, oudeStatus, nieuweStatus });
  }

  // ============ DND HANDLERS ============

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id;
    if (overId && typeof overId === "string" && statusKolommen.some((k) => k.key === overId)) {
      setOverKolom(overId);
    } else {
      setOverKolom(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverKolom(null);

    const { active, over } = event;
    if (!over) return;

    const leadData = active.data.current as { lead: Lead; kolomKey: string } | undefined;
    if (!leadData) return;

    const nieuweKolom = String(over.id);
    if (!statusKolommen.some((k) => k.key === nieuweKolom)) return;
    if (leadData.kolomKey === nieuweKolom) return;

    handleStatusChange(leadData.lead.id, leadData.kolomKey, nieuweKolom);
  }

  function handleDragCancel() {
    setActiveId(null);
    setOverKolom(null);
  }

  // Find the active lead for DragOverlay
  const activeLead = activeId
    ? allLeads.find((l) => `lead-${l.id}` === activeId)
    : null;

  const inputClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-2 border-autronis-accent/30 border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="max-w-[1400px] mx-auto p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">CRM / Leads</h1>
          <p className="text-base text-autronis-text-secondary mt-1">
            {kpis.totaal} leads in pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoeken..."
            className="bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors w-56"
          />
          <button
            onClick={openNieuwModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 btn-press"
          >
            <Plus className="w-4 h-4" />
            Nieuwe lead
          </button>
        </div>
      </div>

      {/* KPI balk */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow card-gradient">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
              <Users className="w-5 h-5 text-autronis-accent" />
            </div>
          </div>
          <p className="text-3xl font-bold text-autronis-text-primary">{kpis.totaal}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Actieve leads</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-yellow-500/10 rounded-xl">
              <Euro className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-yellow-400">{formatBedrag(kpis.pipelineWaarde)}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Pipeline waarde</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-green-500/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-400">{formatBedrag(kpis.gewonnenWaarde)}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Gewonnen</p>
        </div>
      </div>

      {/* Pipeline kolommen met drag & drop */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statusKolommen.map((kolom) => {
            const kolomLeads = allLeads.filter((l) => l.status === kolom.key);
            return (
              <DroppableKolom
                key={kolom.key}
                kolomKey={kolom.key}
                isOver={overKolom === kolom.key}
              >
                {/* Count badge in column header area */}
                <div className="flex justify-end -mt-1 mb-1 px-1">
                  <span className="text-xs text-autronis-text-secondary bg-autronis-bg/50 px-2 py-0.5 rounded-full">
                    {kolomLeads.length}
                  </span>
                </div>

                {kolomLeads.map((lead) => (
                  <DraggableLeadCard
                    key={lead.id}
                    lead={lead}
                    kolomKey={kolom.key}
                    isDragging={activeId === `lead-${lead.id}`}
                    onClick={() => openEditModal(lead)}
                  />
                ))}
              </DroppableKolom>
            );
          })}
        </div>

        {/* Drag overlay - floating card */}
        <DragOverlay>
          {activeLead ? (
            <div className="w-[260px] bg-autronis-card border border-autronis-accent/50 rounded-xl p-4 shadow-2xl shadow-autronis-accent/10 rotate-2">
              <LeadCardContent
                lead={activeLead}
                actieVerlopen={
                  !!(activeLead.volgendeActieDatum &&
                    activeLead.volgendeActieDatum < new Date().toISOString().slice(0, 10))
                }
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Lead Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-autronis-text-primary">
                {selectedLead ? "Lead bewerken" : "Nieuwe lead"}
              </h3>
              <div className="flex items-center gap-2">
                {selectedLead?.email && (
                  <button
                    onClick={() => setEmailOpen(true)}
                    className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                    title="E-mail versturen"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                )}
                {selectedLead && (
                  <button
                    onClick={() => setDeleteDialogOpen(true)}
                    className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Bedrijfsnaam *</label>
                  <input type="text" value={bedrijfsnaam} onChange={(e) => setBedrijfsnaam(e.target.value)} className={inputClasses} placeholder="Bedrijf B.V." />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Contactpersoon</label>
                  <input type="text" value={contactpersoon} onChange={(e) => setContactpersoon(e.target.value)} className={inputClasses} placeholder="Jan Janssen" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">E-mail</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} placeholder="jan@bedrijf.nl" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Telefoon</label>
                  <input type="text" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} className={inputClasses} placeholder="+31 6 12345678" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Geschatte waarde</label>
                  <input type="number" value={waarde} onChange={(e) => setWaarde(e.target.value)} min={0} step={100} className={inputClasses} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Bron</label>
                  <input type="text" value={bron} onChange={(e) => setBron(e.target.value)} className={inputClasses} placeholder="Website, LinkedIn, etc." />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-autronis-text-secondary">Status</label>
                <div className="flex items-center gap-2">
                  {statusKolommen.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setStatus(s.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                        status === s.key
                          ? cn(s.bg, s.color, "border-current")
                          : "border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Volgende actie</label>
                  <input type="text" value={volgendeActie} onChange={(e) => setVolgendeActie(e.target.value)} className={inputClasses} placeholder="Bellen, offerte sturen..." />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Actie datum</label>
                  <input type="date" value={volgendeActieDatum} onChange={(e) => setVolgendeActieDatum(e.target.value)} className={inputClasses} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-autronis-text-secondary">Notities</label>
                <textarea
                  value={notities}
                  onChange={(e) => setNotities(e.target.value)}
                  rows={3}
                  className={cn(inputClasses, "resize-none")}
                  placeholder="Extra informatie..."
                />
              </div>

              {/* Activiteiten timeline */}
              {selectedLead && (
                <div className="space-y-2 pt-2 border-t border-autronis-border">
                  <h4 className="text-sm font-semibold text-autronis-text-primary">Activiteiten</h4>
                  {activiteitenLaden ? (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-autronis-accent/30 border-t-autronis-accent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <ActiviteitenTimeline activiteiten={activiteiten} />
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleOpslaan}
                disabled={saveMutation.isPending}
                className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
              >
                {saveMutation.isPending ? "Opslaan..." : selectedLead ? "Bijwerken" : "Toevoegen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email composer */}
      {selectedLead?.email && (
        <EmailComposer
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          leadId={selectedLead.id}
          leadEmail={selectedLead.email}
          afzenderEmail={afzenderEmail || "noreply@autronis.nl"}
          onVerstuurd={() => invalidateActiviteiten()}
        />
      )}

      {/* Delete dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onBevestig={handleDelete}
        titel="Lead verwijderen?"
        bericht={`Weet je zeker dat je ${selectedLead?.bedrijfsnaam} wilt verwijderen?`}
        bevestigTekst="Verwijderen"
        variant="danger"
      />
    </div>
    </PageTransition>
  );
}
