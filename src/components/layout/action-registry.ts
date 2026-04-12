import type { LucideIcon } from "lucide-react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  Zap, CheckSquare, Lightbulb, FileText, Search, Rocket, Inbox, Sparkles,
  Play, Calendar, CheckCircle, Target, Receipt, Landmark, BarChart3, RefreshCw,
  User, Phone, StickyNote, Mail, Home, Clock, Briefcase, TrendingUp, Users,
  ArrowRight, BookOpen, Download, Bookmark, ShieldOff, Pause, LayoutDashboard,
} from "lucide-react";

export type ActionId =
  | "timer-start"
  | "taak-nieuw"
  | "idee-nieuw"
  | "idee-voer-uit"
  | "idee-backlog"
  | "ai-brainstorm"
  | "dagritme"
  | "search"
  | "timer-op-taak"
  | "plan-agenda"
  | "taak-klaar"
  | "focus"
  | "factuur-nieuw"
  | "uitgave-nieuw"
  | "bank-import"
  | "btw-aangifte"
  | "revolut-sync"
  | "klant-nieuw"
  | "lead-nieuw"
  | "offerte-nieuw"
  | "notitie-nieuw"
  | "mail-nieuw"
  | "timer-toggle"
  | "tijd-handmatig"
  | "locatie-toggle"
  | "tijd-week"
  | "focus-sessie"
  | "project-nieuw"
  | "project-voortgang"
  | "teamlid-toevoegen"
  | "agenda-nieuw"
  | "agenda-vandaag"
  | "google-sync"
  | "meeting-plannen"
  | "wiki-nieuw"
  | "wiki-zoek"
  | "wiki-import"
  | "second-brain-save"
  | "focus-start"
  | "focus-block"
  | "focus-pauze"
  | "focus-stats"
  | "lead-converteren"
  | "pipeline-view"
  | "followup-sturen"
  | "dashboard";

export interface ActionContext {
  router: AppRouterInstance;
  pathname: string;
  openCommandPalette: () => void;
  addToast: (bericht: string, type?: "succes" | "fout" | "info") => void;
}

export interface ActionDef {
  id: ActionId;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  handler: (ctx: ActionContext) => void;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  "timer-start": { id: "timer-start", label: "Timer starten", icon: Zap, shortcut: "S", handler: (ctx) => ctx.router.push("/tijd?start=true") },
  "taak-nieuw": { id: "taak-nieuw", label: "Nieuwe taak", icon: CheckSquare, shortcut: "N", handler: (ctx) => ctx.router.push("/taken?nieuw=true") },
  "idee-nieuw": { id: "idee-nieuw", label: "Nieuw idee", icon: Lightbulb, handler: (ctx) => ctx.router.push("/ideeen?nieuw=true") },
  "idee-voer-uit": { id: "idee-voer-uit", label: "Voer idee uit", icon: Rocket, handler: (ctx) => ctx.router.push("/ideeen?voerUit=true") },
  "idee-backlog": { id: "idee-backlog", label: "Naar backlog", icon: Inbox, handler: (ctx) => ctx.router.push("/ideeen?tab=backlog") },
  "ai-brainstorm": { id: "ai-brainstorm", label: "AI brainstorm", icon: Sparkles, handler: (ctx) => ctx.router.push("/ideeen?ai=true") },
  "dagritme": { id: "dagritme", label: "Dagritme", icon: Clock, handler: (ctx) => ctx.router.push("/dagritme") },
  "search": { id: "search", label: "Zoeken", icon: Search, shortcut: "⌘K", handler: (ctx) => ctx.openCommandPalette() },
  "timer-op-taak": { id: "timer-op-taak", label: "Timer op taak", icon: Play, handler: (ctx) => ctx.router.push("/tijd?start=true") },
  "plan-agenda": { id: "plan-agenda", label: "Plan in agenda", icon: Calendar, handler: (ctx) => ctx.router.push("/agenda?plan=true") },
  "taak-klaar": { id: "taak-klaar", label: "Markeer klaar", icon: CheckCircle, handler: (ctx) => ctx.addToast("Selecteer een taak om klaar te markeren", "info") },
  "focus": { id: "focus", label: "Focus mode", icon: Target, handler: (ctx) => ctx.router.push("/focus") },
  "factuur-nieuw": { id: "factuur-nieuw", label: "Nieuwe factuur", icon: FileText, handler: (ctx) => ctx.router.push("/financien/nieuw") },
  "uitgave-nieuw": { id: "uitgave-nieuw", label: "Uitgave", icon: Receipt, handler: (ctx) => ctx.router.push("/financien?tab=uitgaven&nieuw=true") },
  "bank-import": { id: "bank-import", label: "Bank import", icon: Landmark, handler: (ctx) => ctx.router.push("/financien?tab=bank") },
  "btw-aangifte": { id: "btw-aangifte", label: "BTW aangifte", icon: BarChart3, handler: (ctx) => ctx.router.push("/belasting") },
  "revolut-sync": { id: "revolut-sync", label: "Revolut sync", icon: RefreshCw, handler: (ctx) => ctx.router.push("/financien?sync=revolut") },
  "klant-nieuw": { id: "klant-nieuw", label: "Nieuwe klant", icon: User, handler: (ctx) => ctx.router.push("/klanten?nieuw=true") },
  "lead-nieuw": { id: "lead-nieuw", label: "Nieuwe lead", icon: Phone, handler: (ctx) => ctx.router.push("/leads?nieuw=true") },
  "offerte-nieuw": { id: "offerte-nieuw", label: "Nieuwe offerte", icon: FileText, handler: (ctx) => ctx.router.push("/offertes/nieuw") },
  "notitie-nieuw": { id: "notitie-nieuw", label: "Notitie", icon: StickyNote, handler: (ctx) => ctx.addToast("Selecteer een klant voor een notitie", "info") },
  "mail-nieuw": { id: "mail-nieuw", label: "Mail", icon: Mail, handler: (ctx) => ctx.router.push("/mail") },
  "timer-toggle": { id: "timer-toggle", label: "Timer start/stop", icon: Play, handler: (ctx) => ctx.router.push("/tijd?toggle=true") },
  "tijd-handmatig": { id: "tijd-handmatig", label: "Handmatige registratie", icon: FileText, handler: (ctx) => ctx.router.push("/tijd?handmatig=true") },
  "locatie-toggle": { id: "locatie-toggle", label: "Thuis/kantoor", icon: Home, handler: (ctx) => ctx.addToast("Selecteer een sessie om locatie te wijzigen", "info") },
  "tijd-week": { id: "tijd-week", label: "Week overzicht", icon: BarChart3, handler: (ctx) => ctx.router.push("/tijd?view=week") },
  "focus-sessie": { id: "focus-sessie", label: "Focus sessie", icon: Target, handler: (ctx) => ctx.router.push("/focus") },
  "project-nieuw": { id: "project-nieuw", label: "Nieuw project", icon: Briefcase, handler: (ctx) => ctx.router.push("/projecten?nieuw=true") },
  "project-voortgang": { id: "project-voortgang", label: "Voortgang", icon: TrendingUp, handler: (ctx) => ctx.addToast("Selecteer een project om voortgang bij te werken", "info") },
  "teamlid-toevoegen": { id: "teamlid-toevoegen", label: "Teamlid", icon: Users, handler: (ctx) => ctx.router.push("/team?nieuw=true") },
  "agenda-nieuw": { id: "agenda-nieuw", label: "Nieuwe afspraak", icon: Calendar, handler: (ctx) => ctx.router.push("/agenda?nieuw=true") },
  "agenda-vandaag": { id: "agenda-vandaag", label: "Vandaag", icon: Calendar, handler: (ctx) => ctx.router.push("/agenda?datum=vandaag") },
  "google-sync": { id: "google-sync", label: "Google sync", icon: RefreshCw, handler: (ctx) => ctx.router.push("/agenda?sync=google") },
  "meeting-plannen": { id: "meeting-plannen", label: "Meeting", icon: Users, handler: (ctx) => ctx.router.push("/meetings?nieuw=true") },
  "wiki-nieuw": { id: "wiki-nieuw", label: "Nieuwe pagina", icon: BookOpen, handler: (ctx) => ctx.router.push("/wiki/nieuw") },
  "wiki-zoek": { id: "wiki-zoek", label: "Zoek in wiki", icon: Search, handler: (ctx) => ctx.openCommandPalette() },
  "wiki-import": { id: "wiki-import", label: "Import URL", icon: Download, handler: (ctx) => ctx.router.push("/wiki?import=true") },
  "second-brain-save": { id: "second-brain-save", label: "Second Brain", icon: Bookmark, handler: (ctx) => ctx.router.push("/second-brain?nieuw=true") },
  "focus-start": { id: "focus-start", label: "Start focus", icon: Target, handler: (ctx) => ctx.router.push("/focus?start=true") },
  "focus-block": { id: "focus-block", label: "Block distractions", icon: ShieldOff, handler: (ctx) => ctx.router.push("/focus?block=true") },
  "focus-pauze": { id: "focus-pauze", label: "Pauze", icon: Pause, handler: (ctx) => ctx.addToast("Pauze alleen beschikbaar tijdens actieve focus sessie", "info") },
  "focus-stats": { id: "focus-stats", label: "Focus stats", icon: BarChart3, handler: (ctx) => ctx.router.push("/focus?tab=stats") },
  "lead-converteren": { id: "lead-converteren", label: "Lead → klant", icon: ArrowRight, handler: (ctx) => ctx.addToast("Selecteer een lead om te converteren", "info") },
  "pipeline-view": { id: "pipeline-view", label: "Pipeline", icon: BarChart3, handler: (ctx) => ctx.router.push("/sales-engine?view=pipeline") },
  "followup-sturen": { id: "followup-sturen", label: "Follow-up", icon: Mail, handler: (ctx) => ctx.router.push("/followup") },
  "dashboard": { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, handler: (ctx) => ctx.router.push("/") },
};

export const SHORTCUTS_BY_ROUTE: Record<string, ActionId[]> = {
  "/": ["timer-start", "taak-nieuw", "idee-nieuw", "dagritme", "search"],
  "/ideeen": ["idee-nieuw", "idee-voer-uit", "idee-backlog", "ai-brainstorm", "search"],
  "/taken": ["taak-nieuw", "timer-op-taak", "plan-agenda", "taak-klaar", "focus"],
  "/financien": ["factuur-nieuw", "uitgave-nieuw", "bank-import", "btw-aangifte", "revolut-sync"],
  "/klanten": ["klant-nieuw", "lead-nieuw", "offerte-nieuw", "notitie-nieuw", "mail-nieuw"],
  "/tijd": ["timer-toggle", "tijd-handmatig", "locatie-toggle", "tijd-week", "focus-sessie"],
  "/projecten": ["project-nieuw", "taak-nieuw", "timer-op-taak", "project-voortgang", "teamlid-toevoegen"],
  "/agenda": ["agenda-nieuw", "plan-agenda", "agenda-vandaag", "google-sync", "meeting-plannen"],
  "/wiki": ["wiki-nieuw", "wiki-zoek", "wiki-import", "second-brain-save", "dashboard"],
  "/focus": ["focus-start", "focus-block", "focus-pauze", "focus-stats", "idee-nieuw"],
  "/sales-engine": ["lead-nieuw", "offerte-nieuw", "followup-sturen", "pipeline-view", "lead-converteren"],
  "/leads": ["lead-nieuw", "offerte-nieuw", "followup-sturen", "pipeline-view", "lead-converteren"],
  "/offertes": ["lead-nieuw", "offerte-nieuw", "followup-sturen", "pipeline-view", "lead-converteren"],
};

export const FALLBACK_SHORTCUTS: ActionId[] = [
  "timer-start",
  "taak-nieuw",
  "idee-nieuw",
  "dashboard",
  "search",
];

/**
 * Resolve shortcut IDs for a given pathname.
 * Rules:
 * 1. Exact match wins
 * 2. Otherwise longest matching prefix (pathname starts with "<key>/") wins
 * 3. Fallback shortcuts if nothing matches
 */
export function getShortcutsForRoute(pathname: string): ActionId[] {
  if (!pathname) return FALLBACK_SHORTCUTS;

  if (SHORTCUTS_BY_ROUTE[pathname]) {
    return SHORTCUTS_BY_ROUTE[pathname];
  }

  const keys = Object.keys(SHORTCUTS_BY_ROUTE).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (pathname.startsWith(key + "/")) {
      return SHORTCUTS_BY_ROUTE[key];
    }
  }

  return FALLBACK_SHORTCUTS;
}
