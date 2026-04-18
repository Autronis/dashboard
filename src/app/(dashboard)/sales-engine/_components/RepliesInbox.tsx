"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  MailOpen,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDatum } from "@/lib/utils";

interface Reply {
  emailId: string;
  leadName: string;
  website: string | null;
  leadEmail: string | null;
  supabaseLeadId: string | null;
  threadId: string | null;
  source: string;
  originalSubject: string | null;
  originalBody: string | null;
  replySubject: string | null;
  replyBody: string | null;
  replyReceivedAt: string | null;
  emailStatus: string | null;
  createdAt: string;
}

interface ReplyPlanResult {
  antwoordMail: string;
  plan: string[];
  hasScanContext: boolean;
}

function truncate(str: string, n: number): string {
  if (str.length <= n) return str;
  return str.slice(0, n).trim() + "…";
}

export function RepliesInbox() {
  const router = useRouter();
  const { addToast } = useToast();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [planningFor, setPlanningFor] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, ReplyPlanResult>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leads/emails/replies")
      .then((r) => (r.ok ? r.json() : { replies: [] }))
      .then((data) => {
        if (cancelled) return;
        setReplies(Array.isArray(data?.replies) ? data.replies : []);
      })
      .catch(() => {
        if (cancelled) return;
        setReplies([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function scanWebsite(reply: Reply) {
    if (!reply.website) {
      addToast("Deze lead heeft geen website — kan niet scannen", "fout");
      return;
    }
    const params = new URLSearchParams();
    const item = [{
      bedrijfsnaam: reply.leadName,
      website: reply.website,
      ...(reply.leadEmail ? { email: reply.leadEmail } : {}),
      ...(reply.supabaseLeadId ? { supabaseLeadId: reply.supabaseLeadId } : {}),
    }];
    const b64 = window.btoa(unescape(encodeURIComponent(JSON.stringify(item))));
    params.set("queue", b64);
    router.push(`/sales-engine?${params.toString()}`);
  }

  async function generatePlan(reply: Reply) {
    if (!reply.replyBody) return;
    setPlanningFor(reply.emailId);
    try {
      const res = await fetch("/api/sales-engine/reply-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadName: reply.leadName,
          website: reply.website,
          supabaseLeadId: reply.supabaseLeadId,
          originalSubject: reply.originalSubject,
          originalBody: reply.originalBody,
          replySubject: reply.replySubject,
          replyBody: reply.replyBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || `HTTP ${res.status}`);
      setPlans((prev) => ({ ...prev, [reply.emailId]: data }));
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Genereren mislukt", "fout");
    } finally {
      setPlanningFor(null);
    }
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedId(id);
        addToast("Gekopieerd", "succes");
        setTimeout(() => setCopiedId(null), 1800);
      },
      () => addToast("Kopiëren mislukt", "fout"),
    );
  }

  if (loading) {
    return (
      <div className="bg-[var(--card)] rounded-xl border border-autronis-border px-5 py-6 flex items-center justify-center gap-2 text-sm text-autronis-text-secondary">
        <Loader2 className="w-4 h-4 animate-spin text-autronis-accent" />
        Inbox replies laden &hellip;
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <div className="bg-[var(--card)] rounded-xl border border-autronis-border px-5 py-4 flex items-center gap-3">
        <MailOpen className="w-4 h-4 text-autronis-text-tertiary flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-autronis-text-primary">Inbox leeg</p>
          <p className="text-xs text-autronis-text-secondary mt-0.5">
            Zodra iemand reageert op een cold mail uit <span className="text-autronis-accent">/leads/emails</span> verschijnt die hier — met originele mail, reply, scan-knop en AI-gegenereerd antwoord + plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--card)] rounded-xl border border-blue-400/30 overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-autronis-border bg-blue-500/5">
        <MailOpen className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-autronis-text-primary">
          Inbox — replies op cold mails
        </h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500 text-white tabular-nums">
          {replies.length}
        </span>
        <span className="hidden sm:inline text-xs text-autronis-text-secondary ml-auto">
          Antwoord + volgende-stap plan per reply via AI
        </span>
      </div>
      <div className="divide-y divide-autronis-border/50 max-h-[520px] overflow-y-auto">
        {replies.map((reply) => {
          const isExpanded = expandedId === reply.emailId;
          const plan = plans[reply.emailId];
          const isPlanning = planningFor === reply.emailId;

          return (
            <div key={reply.emailId} className="transition-colors">
              <button
                onClick={() => setExpandedId(isExpanded ? null : reply.emailId)}
                className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-autronis-bg/30 transition-colors"
              >
                <Mail className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-autronis-text-primary truncate">
                      {reply.leadName}
                    </span>
                    {reply.website && (
                      <span className="text-xs text-autronis-text-secondary truncate">
                        &middot; {(() => {
                          try {
                            return new URL(reply.website.startsWith("http") ? reply.website : `https://${reply.website}`).hostname;
                          } catch {
                            return reply.website;
                          }
                        })()}
                      </span>
                    )}
                    {reply.replyReceivedAt && (
                      <span className="text-xs text-autronis-text-tertiary flex items-center gap-1 ml-auto">
                        <Clock className="w-3 h-3" />
                        {formatDatum(reply.replyReceivedAt)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-autronis-text-secondary mt-1 line-clamp-1">
                    {reply.replySubject ? <span className="font-medium">{reply.replySubject} — </span> : null}
                    {truncate((reply.replyBody ?? "").replace(/\s+/g, " "), 140)}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-autronis-text-secondary flex-shrink-0 mt-0.5" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-autronis-text-secondary flex-shrink-0 mt-0.5" />
                )}
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden bg-autronis-bg/40"
                  >
                    <div className="px-5 py-4 space-y-4">
                      {reply.originalSubject || reply.originalBody ? (
                        <div className="space-y-1.5">
                          <div className="text-[10px] uppercase tracking-wide text-autronis-text-tertiary font-semibold">
                            Cold mail (jij → {reply.leadName})
                          </div>
                          {reply.originalSubject && (
                            <div className="text-xs font-medium text-autronis-text-primary">
                              {reply.originalSubject}
                            </div>
                          )}
                          {reply.originalBody && (
                            <div className="text-xs text-autronis-text-secondary whitespace-pre-wrap bg-autronis-card rounded-lg p-3 border border-autronis-border/60">
                              {reply.originalBody}
                            </div>
                          )}
                        </div>
                      ) : null}

                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wide text-blue-400 font-semibold">
                          Reply ({reply.leadName} → jij)
                        </div>
                        {reply.replySubject && (
                          <div className="text-xs font-medium text-autronis-text-primary">
                            {reply.replySubject}
                          </div>
                        )}
                        <div className="text-xs text-autronis-text-primary whitespace-pre-wrap bg-blue-500/5 rounded-lg p-3 border border-blue-400/20">
                          {reply.replyBody}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {reply.website && (
                          <button
                            onClick={() => scanWebsite(reply)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-accent/10 border border-autronis-accent/30 text-autronis-accent text-xs font-semibold hover:bg-autronis-accent/20 transition-colors"
                          >
                            <Zap className="w-3 h-3" />
                            Start scan van {(() => {
                              try {
                                return new URL(reply.website.startsWith("http") ? reply.website : `https://${reply.website}`).hostname;
                              } catch {
                                return "website";
                              }
                            })()}
                          </button>
                        )}
                        <button
                          onClick={() => void generatePlan(reply)}
                          disabled={isPlanning}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                        >
                          {isPlanning ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          {plan ? "Regenereer antwoord + plan" : "Genereer antwoord + plan"}
                        </button>
                      </div>

                      {plan && (
                        <div className="space-y-3 border-t border-autronis-border/60 pt-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase tracking-wide text-purple-300 font-semibold">
                                Voorgestelde antwoord-mail {plan.hasScanContext && (
                                  <span className="text-emerald-400 ml-1">· gebruikt scan-kansen</span>
                                )}
                              </div>
                              <button
                                onClick={() => copy(plan.antwoordMail, `${reply.emailId}-mail`)}
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-300 hover:text-purple-200 transition-colors"
                              >
                                {copiedId === `${reply.emailId}-mail` ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                {copiedId === `${reply.emailId}-mail` ? "Gekopieerd" : "Kopieer"}
                              </button>
                            </div>
                            <div className="text-xs text-autronis-text-primary whitespace-pre-wrap bg-purple-500/5 rounded-lg p-3 border border-purple-400/20">
                              {plan.antwoordMail}
                            </div>
                          </div>

                          {plan.plan.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="text-[10px] uppercase tracking-wide text-purple-300 font-semibold">
                                Volgende stappen
                              </div>
                              <ul className="space-y-1">
                                {plan.plan.map((stap, i) => (
                                  <li
                                    key={i}
                                    className={cn(
                                      "flex items-start gap-2 text-xs text-autronis-text-primary",
                                    )}
                                  >
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold flex-shrink-0 mt-0.5">
                                      {i + 1}
                                    </span>
                                    <span>{stap}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {reply.website && (
                        <a
                          href={reply.website.startsWith("http") ? reply.website : `https://${reply.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-autronis-text-tertiary hover:text-autronis-accent transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open website
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
