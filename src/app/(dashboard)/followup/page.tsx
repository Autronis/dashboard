"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, AlertTriangle, CheckCircle2, Clock, Mail, ExternalLink, Loader2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import Link from "next/link";

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
  danger: Contact[];
  warning: Contact[];
  ok: Contact[];
  totaal: number;
}

const stagger = {
  visible: { transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.22 } },
};

function ContactRow({ contact }: { contact: Contact }) {
  const urgency = contact.dagenGeleden > 30
    ? { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", strip: "bg-red-400" }
    : contact.dagenGeleden > 14
    ? { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", strip: "bg-amber-400" }
    : { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", strip: "bg-emerald-400" };

  const href = contact.type === "klant" ? `/klanten/${contact.id}` : `/leads`;

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
            {contact.dagenGeleden === 999 ? "Nooit" : `${contact.dagenGeleden}d geleden`}
          </p>
          {contact.lastContact && (
            <p className="text-[10px] text-autronis-text-secondary">
              {new Date(contact.lastContact).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors"
              title={contact.email}
            >
              <Mail className="w-3.5 h-3.5" />
            </a>
          )}
          <Link
            href={href}
            className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function FollowUpPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<FollowUpData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/followup");
      const json = await res.json() as FollowUpData;
      setData(json);
    } catch {
      addToast("Kon follow-up data niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-autronis-accent animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto p-4 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-autronis-accent" />
              <h1 className="text-2xl font-bold text-autronis-text-primary">Follow-up tracker</h1>
            </div>
            <p className="text-sm text-autronis-text-secondary">
              Contacten die je niet te lang moet laten liggen.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 text-autronis-text-secondary hover:text-autronis-accent border border-autronis-border hover:border-autronis-accent/50 rounded-xl text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Dringend", value: data?.danger.length ?? 0, color: "text-red-400", icon: AlertTriangle, bg: "bg-red-500/10 border-red-500/20" },
            { label: "Let op", value: data?.warning.length ?? 0, color: "text-amber-400", icon: Clock, bg: "bg-amber-500/10 border-amber-500/20" },
            { label: "OK", value: data?.ok.length ?? 0, color: "text-emerald-400", icon: CheckCircle2, bg: "bg-emerald-500/10 border-emerald-500/20" },
          ].map(({ label, value, color, icon: Icon, bg }) => (
            <div key={label} className={cn("rounded-xl border p-3.5", bg)}>
              <p className="text-[11px] text-autronis-text-secondary flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3" />
                {label}
              </p>
              <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Danger section */}
        {(data?.danger?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold text-red-400">
                Dringend — {data!.danger.length} contact{data!.danger.length > 1 ? "en" : ""}
              </h2>
              <p className="text-xs text-autronis-text-secondary">klanten &gt;30d · leads &gt;14d</p>
            </div>
            <motion.div className="space-y-2" variants={stagger} initial="hidden" animate="visible">
              {data!.danger.map((c) => <ContactRow key={`${c.type}-${c.id}`} contact={c} />)}
            </motion.div>
          </div>
        )}

        {/* Warning section */}
        {(data?.warning?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-amber-400">
                Let op — {data!.warning.length} contact{data!.warning.length > 1 ? "en" : ""}
              </h2>
            </div>
            <motion.div className="space-y-2" variants={stagger} initial="hidden" animate="visible">
              {data!.warning.map((c) => <ContactRow key={`${c.type}-${c.id}`} contact={c} />)}
            </motion.div>
          </div>
        )}

        {/* OK section (collapsed by default) */}
        {(data?.ok?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-emerald-400">
                Recent contact — {data!.ok.length} contact{data!.ok.length > 1 ? "en" : ""}
              </h2>
            </div>
            <motion.div className="space-y-2" variants={stagger} initial="hidden" animate="visible">
              {data!.ok.map((c) => <ContactRow key={`${c.type}-${c.id}`} contact={c} />)}
            </motion.div>
          </div>
        )}

        {data?.totaal === 0 && (
          <div className="text-center py-12 text-autronis-text-secondary">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Geen actieve klanten of leads gevonden.</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
