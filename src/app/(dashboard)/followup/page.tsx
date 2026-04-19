"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, AlertTriangle, CheckCircle2, Clock, Mail, ExternalLink, Loader2, RefreshCw,
  Settings2, FileText, History, Plus, Pencil, Trash2, Zap, SearchCheck, CircleDashed, ChevronDown, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Modal } from "@/components/ui/modal";
import Link from "next/link";

// ============ TYPES ============

interface Contact {
  id: number;
  naam: string;
  contactpersoon?: string | null;
  email?: string | null;
  type: "klant" | "lead";
  lastContact: string | null;
  dagenGeleden: number;
  status?: string;
}

interface FollowUpData {
  nooit: Contact[];
  danger: Contact[];
  warning: Contact[];
  ok: Contact[];
  totaal: number;
}

interface Regel {
  id: number;
  naam: string;
  type: "geen_contact" | "offerte_niet_beantwoord" | "offerte_vervalt" | "handmatig";
  doelgroep: "klanten" | "leads" | "beide";
  dagenDrempel: number;
  templateId: number | null;
  templateNaam: string | null;
  isActief: number;
  aangemaaktOp: string;
}

interface Template {
  id: number;
  naam: string;
  onderwerp: string;
  inhoud: string;
  type: "email" | "notificatie";
  isActief: number;
  aangemaaktOp: string;
}

interface LogEntry {
  id: number;
  regelNaam: string | null;
  contactType: "klant" | "lead";
  contactId: number;
  contactNaam: string;
  offerteId: number | null;
  status: string;
  dagenGeleden: number | null;
  emailVerstuurd: string | null;
  foutmelding: string | null;
  verstuurdOp: string | null;
  aangemaaktOp: string;
}

interface CheckResult {
  triggers: Array<{
    regelNaam: string;
    contactType: "klant" | "lead";
    contactNaam: string;
    email: string | null;
    dagenGeleden: number;
  }>;
  totaal: number;
  gecontroleerd: { klanten: number; leads: number; offertes: number };
}

type Tab = "overzicht" | "regels" | "templates" | "log";

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "overzicht", label: "Overzicht", icon: Users },
  { key: "regels", label: "Regels", icon: Settings2 },
  { key: "templates", label: "Templates", icon: FileText },
  { key: "log", label: "Log", icon: History },
];

const TYPE_LABELS: Record<string, string> = {
  geen_contact: "Geen contact",
  offerte_niet_beantwoord: "Offerte niet beantwoord",
  offerte_vervalt: "Offerte vervalt",
  handmatig: "Handmatig",
};

const DOELGROEP_LABELS: Record<string, string> = {
  klanten: "Klanten",
  leads: "Leads",
  beide: "Beide",
};

const stagger = { visible: { transition: { staggerChildren: 0.05 } } };
const item = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.22 } },
};

// ============ CONTACT ROW (Overzicht) ============

function ContactRow({ contact, onGecontacteerd }: { contact: Contact; onGecontacteerd: (c: Contact) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const nooit = contact.dagenGeleden >= 999;
  const urgency = nooit
    ? { color: "text-slate-400", strip: "bg-slate-400" }
    : contact.dagenGeleden > 30
    ? { color: "text-red-400", strip: "bg-red-400" }
    : contact.dagenGeleden > 14
    ? { color: "text-amber-400", strip: "bg-amber-400" }
    : { color: "text-emerald-400", strip: "bg-emerald-400" };

  const href = contact.type === "klant" ? `/klanten/${contact.id}` : `/leads`;

  const handleGecontacteerd = async () => {
    setBusy(true);
    try {
      await onGecontacteerd(contact);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div variants={item} className="relative overflow-hidden">
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl", urgency.strip)} />
      <div className="flex items-center gap-4 bg-autronis-bg/30 border border-autronis-border/50 rounded-xl pl-5 pr-4 py-3 hover:border-autronis-accent/30 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-autronis-text-primary truncate">{contact.naam}</p>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0",
              contact.type === "klant" ? "bg-autronis-accent/15 text-autronis-accent" : "bg-purple-500/15 text-purple-400"
            )}>
              {contact.type === "klant" ? "Klant" : `Lead · ${contact.status}`}
            </span>
          </div>
          {contact.contactpersoon && (
            <p className="text-xs text-autronis-text-secondary mt-0.5">{contact.contactpersoon}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={cn("text-sm font-semibold tabular-nums", urgency.color)}>
            {nooit ? "Nooit" : `${contact.dagenGeleden}d geleden`}
          </p>
          {contact.lastContact && !nooit && (
            <p className="text-[10px] text-autronis-text-secondary">
              {new Date(contact.lastContact).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleGecontacteerd}
            disabled={busy}
            title="Markeren als gecontacteerd — logt een notitie en reset de follow-up"
            className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors" title={contact.email}>
              <Mail className="w-3.5 h-3.5" />
            </a>
          )}
          <Link href={href} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ============ STATUS BADGE ============

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    getriggerd: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Getriggerd" },
    verstuurd: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Verstuurd" },
    mislukt: { bg: "bg-red-500/15", text: "text-red-400", label: "Mislukt" },
    overgeslagen: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Overgeslagen" },
    gesnoozed: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Gesnoozed" },
  };
  const c = config[status] ?? config.getriggerd;
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", c.bg, c.text)}>
      {c.label}
    </span>
  );
}

// ============ MAIN PAGE ============

export default function FollowUpPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("overzicht");
  const [loading, setLoading] = useState(true);

  // Overzicht state
  const [data, setData] = useState<FollowUpData | null>(null);

  // Regels state
  const [regels, setRegels] = useState<Regel[]>([]);
  const [regelModalOpen, setRegelModalOpen] = useState(false);
  const [editRegel, setEditRegel] = useState<Regel | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);

  // Log state
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  // Check state
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<CheckResult | null>(null);

  // ---- FETCHERS ----

  const fetchOverzicht = useCallback(async () => {
    try {
      const res = await fetch("/api/followup");
      const json = await res.json() as FollowUpData;
      setData(json);
    } catch {
      addToast("Kon follow-up data niet laden", "fout");
    }
  }, [addToast]);

  const fetchRegels = useCallback(async () => {
    try {
      const res = await fetch("/api/followup/regels");
      const json = await res.json();
      setRegels(json.regels ?? []);
    } catch {
      addToast("Kon regels niet laden", "fout");
    }
  }, [addToast]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/followup/templates");
      const json = await res.json();
      setTemplates(json.templates ?? []);
    } catch {
      addToast("Kon templates niet laden", "fout");
    }
  }, [addToast]);

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch("/api/followup/log");
      const json = await res.json();
      setLogEntries(json.log ?? []);
    } catch {
      addToast("Kon log niet laden", "fout");
    }
  }, [addToast]);

  const runCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/followup/check", { method: "POST" });
      const json = await res.json() as CheckResult;
      setLastCheck(json);
      if (json.totaal > 0) {
        addToast(`${json.totaal} follow-up(s) getriggerd (dry-run — e-mails gaan via daily cron)`, "succes");
        fetchLog();
      } else {
        addToast("Geen nieuwe follow-ups gevonden", "info");
      }
    } catch {
      addToast("Scan mislukt", "fout");
    } finally {
      setChecking(false);
    }
  };

  const markGecontacteerd = useCallback(async (contact: Contact) => {
    try {
      const res = await fetch("/api/followup/gecontacteerd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactType: contact.type, contactId: contact.id, via: "follow-up tracker" }),
      });
      if (!res.ok) throw new Error();
      addToast(`${contact.naam} gemarkeerd als gecontacteerd`, "succes");
      fetchOverzicht();
    } catch {
      addToast("Kon niet markeren", "fout");
    }
  }, [addToast, fetchOverzicht]);

  // ---- INITIAL LOAD ----

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchOverzicht(), fetchRegels(), fetchTemplates(), fetchLog()]);
      setLoading(false);
    };
    load();
  }, [fetchOverzicht, fetchRegels, fetchTemplates, fetchLog]);

  // ---- REGEL CRUD ----

  const saveRegel = async (form: { naam: string; type: string; doelgroep: string; dagenDrempel: number; templateId: number | null }) => {
    try {
      if (editRegel) {
        const res = await fetch(`/api/followup/regels/${editRegel.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        addToast("Regel bijgewerkt", "succes");
      } else {
        const res = await fetch("/api/followup/regels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        addToast("Regel aangemaakt", "succes");
      }
      setRegelModalOpen(false);
      setEditRegel(null);
      fetchRegels();
    } catch {
      addToast("Kon regel niet opslaan", "fout");
    }
  };

  const deleteRegel = async (id: number) => {
    try {
      await fetch(`/api/followup/regels/${id}`, { method: "DELETE" });
      addToast("Regel verwijderd", "succes");
      fetchRegels();
    } catch {
      addToast("Kon regel niet verwijderen", "fout");
    }
  };

  // ---- TEMPLATE CRUD ----

  const saveTemplate = async (form: { naam: string; onderwerp: string; inhoud: string; type: string }) => {
    try {
      if (editTemplate) {
        const res = await fetch(`/api/followup/templates/${editTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        addToast("Template bijgewerkt", "succes");
      } else {
        const res = await fetch("/api/followup/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        addToast("Template aangemaakt", "succes");
      }
      setTemplateModalOpen(false);
      setEditTemplate(null);
      fetchTemplates();
    } catch {
      addToast("Kon template niet opslaan", "fout");
    }
  };

  const deleteTemplate = async (id: number) => {
    try {
      await fetch(`/api/followup/templates/${id}`, { method: "DELETE" });
      addToast("Template verwijderd", "succes");
      fetchTemplates();
    } catch {
      addToast("Kon template niet verwijderen", "fout");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-autronis-accent animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-autronis-accent" />
              <h1 className="text-2xl font-bold text-autronis-text-primary">Follow-up tracker</h1>
            </div>
            <p className="text-sm text-autronis-text-secondary">
              Automatische follow-ups voor klanten en leads.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runCheck}
              disabled={checking}
              title="Scan contacten tegen regels en log welke zouden triggeren. Verstuurt GEEN e-mails — die gaan via de dagelijkse cron om 09:00 NL."
              className="flex items-center gap-2 px-3 py-2 text-sm bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl transition-colors disabled:opacity-50"
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchCheck className="w-4 h-4" />}
              Scan (dry-run)
            </button>
            <button
              onClick={() => {
                fetchOverzicht();
                fetchRegels();
                fetchTemplates();
                fetchLog();
              }}
              className="p-2 text-autronis-text-secondary hover:text-autronis-accent border border-autronis-border hover:border-autronis-accent/50 rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Last check result */}
        <AnimatePresence>
          {lastCheck && lastCheck.totaal > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-autronis-accent/10 border border-autronis-accent/30 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-autronis-accent" />
                <p className="text-sm font-semibold text-autronis-accent">
                  {lastCheck.totaal} follow-up(s) getriggerd
                </p>
              </div>
              <div className="space-y-1">
                {lastCheck.triggers.slice(0, 5).map((t, i) => (
                  <p key={i} className="text-xs text-autronis-text-secondary">
                    {t.contactNaam} — {t.regelNaam} ({t.dagenGeleden}d)
                  </p>
                ))}
                {lastCheck.totaal > 5 && (
                  <p className="text-xs text-autronis-text-secondary">
                    ...en {lastCheck.totaal - 5} meer
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center",
                activeTab === key
                  ? "bg-autronis-accent text-autronis-bg shadow-lg"
                  : "text-autronis-text-secondary hover:bg-autronis-bg/50"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overzicht" && <OverzichtTab data={data} onGecontacteerd={markGecontacteerd} />}
        {activeTab === "regels" && (
          <RegelsTab
            regels={regels}
            onAdd={() => { setEditRegel(null); setRegelModalOpen(true); }}
            onEdit={(r) => { setEditRegel(r); setRegelModalOpen(true); }}
            onDelete={deleteRegel}
          />
        )}
        {activeTab === "templates" && (
          <TemplatesTab
            templates={templates}
            onAdd={() => { setEditTemplate(null); setTemplateModalOpen(true); }}
            onEdit={(t) => { setEditTemplate(t); setTemplateModalOpen(true); }}
            onDelete={deleteTemplate}
          />
        )}
        {activeTab === "log" && <LogTab entries={logEntries} />}

        {/* Regel modal */}
        <RegelModal
          open={regelModalOpen}
          onClose={() => { setRegelModalOpen(false); setEditRegel(null); }}
          onSave={saveRegel}
          edit={editRegel}
          templates={templates}
        />

        {/* Template modal */}
        <TemplateModal
          open={templateModalOpen}
          onClose={() => { setTemplateModalOpen(false); setEditTemplate(null); }}
          onSave={saveTemplate}
          edit={editTemplate}
        />
      </div>
    </PageTransition>
  );
}

// ============ OVERZICHT TAB ============

function OverzichtTab({ data, onGecontacteerd }: { data: FollowUpData | null; onGecontacteerd: (c: Contact) => Promise<void> }) {
  const [showOk, setShowOk] = useState(false);
  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Dringend", value: data?.danger.length ?? 0, color: "text-red-400", icon: AlertTriangle, bg: "bg-red-500/10 border-red-500/20" },
          { label: "Nog niet benaderd", value: data?.nooit.length ?? 0, color: "text-slate-300", icon: CircleDashed, bg: "bg-slate-500/10 border-slate-500/20" },
          { label: "Let op", value: data?.warning.length ?? 0, color: "text-amber-400", icon: Clock, bg: "bg-amber-500/10 border-amber-500/20" },
          { label: "OK", value: data?.ok.length ?? 0, color: "text-emerald-400", icon: CheckCircle2, bg: "bg-emerald-500/10 border-emerald-500/20" },
        ].map(({ label, value, color, icon: Icon, bg }) => (
          <div key={label} className={cn("rounded-xl border p-3.5", bg)}>
            <p className="text-[11px] text-autronis-text-secondary flex items-center gap-1.5 mb-1">
              <Icon className="w-3 h-3" /> {label}
            </p>
            <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      {(data?.danger?.length ?? 0) > 0 && (
        <Section icon={AlertTriangle} color="red" label={`Dringend — ${data!.danger.length} contact${data!.danger.length > 1 ? "en" : ""}`} sub="klanten >30d · leads >14d">
          {data!.danger.map((c) => <ContactRow key={`${c.type}-${c.id}`} contact={c} onGecontacteerd={onGecontacteerd} />)}
        </Section>
      )}
      {(data?.nooit?.length ?? 0) > 0 && (
        <Section icon={CircleDashed} color="slate" label={`Nog niet benaderd — ${data!.nooit.length} contact${data!.nooit.length > 1 ? "en" : ""}`} sub="geen enkele notitie, meeting of activiteit gelogd">
          {data!.nooit.map((c) => <ContactRow key={`${c.type}-${c.id}`} contact={c} onGecontacteerd={onGecontacteerd} />)}
        </Section>
      )}
      {(data?.warning?.length ?? 0) > 0 && (
        <Section icon={Clock} color="amber" label={`Let op — ${data!.warning.length} contact${data!.warning.length > 1 ? "en" : ""}`}>
          {data!.warning.map((c) => <ContactRow key={`${c.type}-${c.id}`} contact={c} onGecontacteerd={onGecontacteerd} />)}
        </Section>
      )}
      {(data?.ok?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowOk(!showOk)}
            className="flex items-center gap-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Recent contact — {data!.ok.length}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showOk && "rotate-180")} />
          </button>
          {showOk && (
            <motion.div className="space-y-2" variants={stagger} initial="hidden" animate="visible">
              {data!.ok.map((c) => <ContactRow key={`${c.type}-${c.id}`} contact={c} onGecontacteerd={onGecontacteerd} />)}
            </motion.div>
          )}
        </div>
      )}
      {data?.totaal === 0 && (
        <div className="text-center py-12 text-autronis-text-secondary">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Geen actieve klanten of leads gevonden.</p>
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, color, label, sub, children }: {
  icon: typeof AlertTriangle; color: string; label: string; sub?: string;
  children: React.ReactNode;
}) {
  const colorMap: Record<string, string> = { red: "text-red-400", amber: "text-amber-400", emerald: "text-emerald-400", slate: "text-slate-300" };
  const iconColorMap: Record<string, string> = { red: "text-red-400", amber: "text-amber-400", emerald: "text-emerald-400", slate: "text-slate-400" };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("w-4 h-4", iconColorMap[color])} />
        <h2 className={cn("text-sm font-semibold", colorMap[color])}>{label}</h2>
        {sub && <p className="text-xs text-autronis-text-secondary">{sub}</p>}
      </div>
      <motion.div className="space-y-2" variants={stagger} initial="hidden" animate="visible">
        {children}
      </motion.div>
    </div>
  );
}

// ============ REGELS TAB ============

function RegelsTab({ regels, onAdd, onEdit, onDelete }: {
  regels: Regel[]; onAdd: () => void; onEdit: (r: Regel) => void; onDelete: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-autronis-text-secondary">{regels.length} actieve regel{regels.length !== 1 ? "s" : ""}</p>
        <button onClick={onAdd} className="flex items-center gap-2 px-3 py-2 text-sm bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Nieuwe regel
        </button>
      </div>

      {regels.length === 0 ? (
        <div className="text-center py-12 text-autronis-text-secondary">
          <Settings2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nog geen follow-up regels.</p>
          <p className="text-xs mt-1">Maak een regel aan om automatisch follow-ups te triggeren.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {regels.map((r) => (
            <div key={r.id} className="flex items-center gap-4 bg-autronis-bg/30 border border-autronis-border/50 rounded-xl px-4 py-3 hover:border-autronis-accent/30 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-autronis-text-primary">{r.naam}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-autronis-accent/15 text-autronis-accent">
                    {TYPE_LABELS[r.type]}
                  </span>
                  <span className="text-[10px] text-autronis-text-secondary">
                    {DOELGROEP_LABELS[r.doelgroep]} · {r.dagenDrempel} dagen
                  </span>
                  {r.templateNaam && (
                    <span className="text-[10px] text-autronis-text-secondary">
                      · {r.templateNaam}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => onEdit(r)} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(r.id)} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ TEMPLATES TAB ============

function TemplatesTab({ templates, onAdd, onEdit, onDelete }: {
  templates: Template[]; onAdd: () => void; onEdit: (t: Template) => void; onDelete: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-autronis-text-secondary">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
        <button onClick={onAdd} className="flex items-center gap-2 px-3 py-2 text-sm bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Nieuw template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 text-autronis-text-secondary">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nog geen e-mail templates.</p>
          <p className="text-xs mt-1">Templates worden gebruikt bij automatische follow-up e-mails.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-4 bg-autronis-bg/30 border border-autronis-border/50 rounded-xl px-4 py-3 hover:border-autronis-accent/30 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-autronis-text-primary">{t.naam}</p>
                <p className="text-xs text-autronis-text-secondary mt-0.5 truncate">
                  Onderwerp: {t.onderwerp}
                </p>
              </div>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0",
                t.type === "email" ? "bg-blue-500/15 text-blue-400" : "bg-purple-500/15 text-purple-400"
              )}>
                {t.type === "email" ? "E-mail" : "Notificatie"}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => onEdit(t)} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(t.id)} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ LOG TAB ============

function LogTab({ entries }: { entries: LogEntry[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-autronis-text-secondary">{entries.length} log entr{entries.length !== 1 ? "ies" : "y"}</p>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-autronis-text-secondary">
          <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nog geen follow-up activiteit.</p>
          <p className="text-xs mt-1">Gebruik &quot;Check nu&quot; om contacten te scannen.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-4 bg-autronis-bg/30 border border-autronis-border/50 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-autronis-text-primary truncate">{e.contactNaam}</p>
                  <StatusBadge status={e.status ?? "getriggerd"} />
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0",
                    e.contactType === "klant" ? "bg-autronis-accent/15 text-autronis-accent" : "bg-purple-500/15 text-purple-400"
                  )}>
                    {e.contactType === "klant" ? "Klant" : "Lead"}
                  </span>
                </div>
                <p className="text-xs text-autronis-text-secondary mt-0.5">
                  {e.regelNaam ?? "Handmatig"}
                  {e.dagenGeleden !== null && ` · ${e.dagenGeleden}d`}
                  {e.foutmelding && ` · ${e.foutmelding}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-autronis-text-secondary">
                  {e.aangemaaktOp ? new Date(e.aangemaaktOp).toLocaleDateString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ REGEL MODAL ============

function RegelModal({ open, onClose, onSave, edit, templates }: {
  open: boolean;
  onClose: () => void;
  onSave: (form: { naam: string; type: string; doelgroep: string; dagenDrempel: number; templateId: number | null }) => void;
  edit: Regel | null;
  templates: Template[];
}) {
  const [form, setForm] = useState({
    naam: "",
    type: "geen_contact",
    doelgroep: "beide",
    dagenDrempel: 7,
    templateId: null as number | null,
  });

  useEffect(() => {
    if (edit) {
      setForm({
        naam: edit.naam,
        type: edit.type,
        doelgroep: edit.doelgroep,
        dagenDrempel: edit.dagenDrempel,
        templateId: edit.templateId,
      });
    } else {
      setForm({ naam: "", type: "geen_contact", doelgroep: "beide", dagenDrempel: 7, templateId: null });
    }
  }, [edit, open]);

  const inputClasses = "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:ring-2 focus:ring-autronis-accent/50 focus:border-transparent outline-none transition-all";

  return (
    <Modal
      open={open}
      onClose={onClose}
      titel={edit ? "Regel bewerken" : "Nieuwe follow-up regel"}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
            Annuleren
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-2 text-sm bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl transition-colors"
          >
            {edit ? "Opslaan" : "Aanmaken"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs text-autronis-text-secondary mb-1.5 block">Naam</label>
          <input className={inputClasses} value={form.naam} onChange={(e) => setForm({ ...form, naam: e.target.value })} placeholder="bijv. Klanten 7 dagen geen contact" />
        </div>
        <div>
          <label className="text-xs text-autronis-text-secondary mb-1.5 block">Type trigger</label>
          <select className={inputClasses} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="geen_contact">Geen contact</option>
            <option value="offerte_niet_beantwoord">Offerte niet beantwoord</option>
            <option value="offerte_vervalt">Offerte vervalt binnenkort</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-autronis-text-secondary mb-1.5 block">Doelgroep</label>
            <select className={inputClasses} value={form.doelgroep} onChange={(e) => setForm({ ...form, doelgroep: e.target.value })}>
              <option value="beide">Beide</option>
              <option value="klanten">Alleen klanten</option>
              <option value="leads">Alleen leads</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-autronis-text-secondary mb-1.5 block">Dagen drempel</label>
            <input type="number" min={1} className={inputClasses} value={form.dagenDrempel} onChange={(e) => setForm({ ...form, dagenDrempel: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="text-xs text-autronis-text-secondary mb-1.5 block">E-mail template (optioneel)</label>
          <select className={inputClasses} value={form.templateId ?? ""} onChange={(e) => setForm({ ...form, templateId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Geen template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.naam}</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

// ============ TEMPLATE MODAL ============

function TemplateModal({ open, onClose, onSave, edit }: {
  open: boolean;
  onClose: () => void;
  onSave: (form: { naam: string; onderwerp: string; inhoud: string; type: string }) => void;
  edit: Template | null;
}) {
  const [form, setForm] = useState({
    naam: "",
    onderwerp: "",
    inhoud: "",
    type: "email",
  });

  useEffect(() => {
    if (edit) {
      setForm({ naam: edit.naam, onderwerp: edit.onderwerp, inhoud: edit.inhoud, type: edit.type });
    } else {
      setForm({ naam: "", onderwerp: "", inhoud: "", type: "email" });
    }
  }, [edit, open]);

  const inputClasses = "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:ring-2 focus:ring-autronis-accent/50 focus:border-transparent outline-none transition-all";

  return (
    <Modal
      open={open}
      onClose={onClose}
      titel={edit ? "Template bewerken" : "Nieuw e-mail template"}
      breedte="lg"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
            Annuleren
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-2 text-sm bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl transition-colors"
          >
            {edit ? "Opslaan" : "Aanmaken"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-autronis-text-secondary mb-1.5 block">Naam</label>
            <input className={inputClasses} value={form.naam} onChange={(e) => setForm({ ...form, naam: e.target.value })} placeholder="bijv. Eerste herinnering" />
          </div>
          <div>
            <label className="text-xs text-autronis-text-secondary mb-1.5 block">Type</label>
            <select className={inputClasses} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="email">E-mail</option>
              <option value="notificatie">Notificatie</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-autronis-text-secondary mb-1.5 block">Onderwerp</label>
          <input className={inputClasses} value={form.onderwerp} onChange={(e) => setForm({ ...form, onderwerp: e.target.value })} placeholder="bijv. Even bijpraten, {{naam}}?" />
        </div>
        <div>
          <label className="text-xs text-autronis-text-secondary mb-1.5 block">
            Inhoud <span className="text-autronis-text-secondary/50">— gebruik {"{{naam}}"}, {"{{bedrijf}}"}, {"{{dagen}}"} als variabelen</span>
          </label>
          <textarea
            className={cn(inputClasses, "min-h-[200px] resize-y")}
            value={form.inhoud}
            onChange={(e) => setForm({ ...form, inhoud: e.target.value })}
            placeholder={`Hoi {{naam}},\n\nHet is alweer {{dagen}} dagen geleden dat we contact hadden. Kunnen we even bijpraten?\n\nGroet,\nSem`}
          />
        </div>
      </div>
    </Modal>
  );
}
