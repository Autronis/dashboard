"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Clock, Users, Euro, BarChart3, Calendar,
  CheckSquare, ChevronLeft, X, Landmark, Users2, FileText,
  Crosshair, Car, BookOpen, Mic, Radar, Lightbulb, Eye,
  Megaphone, Video, Flame, Focus, Brain, Zap, FolderKanban,
  Rocket, ChevronDown, Mail, Radio, Sunrise, Calculator,
  UserCheck, Activity, CalendarDays, Wand2, ShieldAlert, Settings,
  Receipt, CreditCard, ChevronRight, Layers, PenLine, Library,
  PlusCircle, Compass, Sparkles, UtensilsCrossed, HeartPulse,
} from "lucide-react";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────
interface NavLink { label: string; icon: typeof LayoutDashboard; href: string; alsoMatches?: string[] }
interface LauncherLink {
  label: string;
  icon: typeof LayoutDashboard;
  children: NavLink[];
}
interface NavSection { section: string; items: (NavLink | LauncherLink)[] }

function isLauncher(item: NavLink | LauncherLink): item is LauncherLink {
  return "children" in item;
}

// ─── Navigation structure ───────────────────────────────────────
const navSections: (NavLink | NavSection | "divider")[] = [
  // Dagelijks — altijd zichtbaar, meest gebruikt
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Taken", icon: CheckSquare, href: "/taken" },
  { label: "Agenda", icon: Calendar, href: "/agenda" },
  { label: "Projecten", icon: FolderKanban, href: "/projecten" },

  // Werk
  {
    section: "Werk",
    items: [
      { label: "Klanten", icon: Users, href: "/klanten" },
      {
        label: "Sales",
        icon: Rocket,
        children: [
          { label: "Leads", icon: Zap, href: "/leads" },
          { label: "Follow-up", icon: UserCheck, href: "/followup" },
          { label: "Sales Engine", icon: Rocket, href: "/sales-engine" },
          { label: "Client Status", icon: Activity, href: "/client-status" },
          { label: "Gezondheid", icon: HeartPulse, href: "/klant-gezondheid" },
        ],
      },
      {
        label: "Financiën",
        icon: Euro,
        children: [
          { label: "Overzicht", icon: Euro, href: "/financien" },
          { label: "Facturen", icon: Receipt, href: "/facturen", alsoMatches: ["/financien/nieuw", "/financien/"] },
          { label: "Offertes", icon: FileText, href: "/offertes" },
          { label: "Contracten", icon: FileText, href: "/offertes/contracten" },
          { label: "Belasting", icon: Landmark, href: "/belasting" },
        ],
      },
      { label: "Kilometers", icon: Car, href: "/kilometers" },
      { label: "Mail Assistent", icon: Sparkles, href: "/mail" },
    ],
  },

  // Operationeel
  {
    section: "Operationeel",
    items: [
      { label: "Ops Room", icon: Radio, href: "/ops-room" },
      { label: "Tijd", icon: Clock, href: "/tijd" },
      { label: "Focus", icon: Focus, href: "/focus" },
      { label: "Team", icon: Users2, href: "/team" },
    ],
  },

  // Kennis & Content
  {
    section: "Kennis & Content",
    items: [
      { label: "Wiki", icon: BookOpen, href: "/wiki" },
      { label: "Second Brain", icon: Brain, href: "/second-brain" },
      { label: "Content Engine", icon: Megaphone, href: "/content", alsoMatches: ["/content/posts", "/content/kennisbank", "/content/kalender"] },
      { label: "Video Studio", icon: Video, href: "/content/videos/studio", alsoMatches: ["/content/videos"] },
    ],
  },

  // Overig
  {
    section: "Overig",
    items: [
      { label: "Analytics", icon: BarChart3, href: "/analytics" },
      { label: "Weekreview", icon: CalendarDays, href: "/weekreview" },
      { label: "Ideeën", icon: Lightbulb, href: "/ideeen" },
      { label: "Dagritme", icon: Sunrise, href: "/dagritme" },
      { label: "Meetings", icon: Mic, href: "/meetings" },
      { label: "Mealplanner", icon: UtensilsCrossed, href: "/mealplan" },
      { label: "Documenten", icon: FileText, href: "/documenten" },
      { label: "Banners", icon: PenLine, href: "/content/banners" },
      { label: "Animaties", icon: Wand2, href: "/animaties" },
      { label: "Case Studies", icon: Compass, href: "/case-studies" },
      { label: "Learning Radar", icon: Radar, href: "/radar" },
      { label: "YT Knowledge", icon: Video, href: "/yt-knowledge" },
      { label: "Contract Analyzer", icon: ShieldAlert, href: "/contract-analyse" },
      { label: "Prijscalculator", icon: Calculator, href: "/prijscalculator" },
      {
        label: "Doelen & Tracking",
        icon: Crosshair,
        children: [
          { label: "Doelen", icon: Crosshair, href: "/doelen" },
          { label: "Gewoontes", icon: Flame, href: "/gewoontes" },
          { label: "Concurrenten", icon: Eye, href: "/concurrenten" },
        ],
      },
    ],
  },

  // Beheer
  {
    section: "Beheer",
    items: [
      { label: "API Gebruik", icon: Activity, href: "/api-gebruik" },
      { label: "Instellingen", icon: Settings, href: "/instellingen" },
    ],
  },
];

// ─── NavItem ────────────────────────────────────────────────────
function NavItem({ item, isCollapsed, isActive }: { item: NavLink; isCollapsed: boolean; isActive: boolean }) {
  const Icon = item.icon;
  const { setOpen } = useSidebar();
  return (
    <Link
      href={item.href}
      onClick={() => setOpen(false)}
      className={cn(
        "flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-150 group relative",
        isActive
          ? "bg-autronis-accent/10 text-autronis-text-primary font-semibold"
          : "text-autronis-text-secondary hover:bg-autronis-border/30 hover:text-autronis-text-primary"
      )}
      title={isCollapsed ? item.label : undefined}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-autronis-accent rounded-r" />
      )}
      <Icon className={cn(
        "w-[18px] h-[18px] transition-colors flex-shrink-0",
        isActive ? "text-autronis-accent" : "text-autronis-text-secondary group-hover:text-autronis-text-primary"
      )} />
      {!isCollapsed && (
        <span className="text-[13px] truncate">{item.label}</span>
      )}
    </Link>
  );
}

// ─── LauncherItem ───────────────────────────────────────────────
function LauncherItem({
  item,
  isCollapsed,
  isActive,
  pathname,
}: {
  item: LauncherLink;
  isCollapsed: boolean;
  isActive: boolean;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Icon = item.icon;
  const { setOpen: setSidebarOpen } = useSidebar();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-150 group relative",
          isActive
            ? "bg-autronis-accent/10 text-autronis-text-primary font-semibold"
            : "text-autronis-text-secondary hover:bg-autronis-border/30 hover:text-autronis-text-primary"
        )}
        title={isCollapsed ? item.label : undefined}
        aria-expanded={open}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-autronis-accent rounded-r" />
        )}
        <Icon className={cn(
          "w-[18px] h-[18px] transition-colors flex-shrink-0",
          isActive ? "text-autronis-accent" : "text-autronis-text-secondary group-hover:text-autronis-text-primary"
        )} />
        {!isCollapsed && (
          <>
            <span className="text-[13px] truncate flex-1 text-left">{item.label}</span>
            <ChevronRight className={cn(
              "w-3 h-3 transition-transform duration-200 flex-shrink-0",
              open && "rotate-90",
              isActive ? "text-autronis-accent/50" : "text-autronis-text-secondary/40"
            )} />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "z-50 bg-autronis-card border border-autronis-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden",
              isCollapsed
                ? "absolute left-full top-0 ml-2 min-w-[180px]"
                : "mt-1 ml-6 mr-1"
            )}
          >
            <div className="py-1.5">
              {item.children.map((child) => {
                const ChildIcon = child.icon;
                const childActive = isNavLinkActive(child, pathname);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => { setOpen(false); setSidebarOpen(false); }}
                    className={cn(
                      "flex items-center gap-2.5 px-3.5 py-2 text-[13px] transition-colors",
                      childActive
                        ? "text-autronis-accent bg-autronis-accent/10 font-medium"
                        : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/30"
                    )}
                  >
                    <ChildIcon className={cn("w-3.5 h-3.5 flex-shrink-0", childActive ? "text-autronis-accent" : "text-autronis-text-secondary/70")} />
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Section state ──────────────────────────────────────────────
const SIDEBAR_SECTIONS_KEY = "autronis-sidebar-sections";

function useSectionState(section: string, defaultOpen: boolean) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_SECTIONS_KEY);
      if (stored) {
        const map = JSON.parse(stored) as Record<string, boolean>;
        if (section in map) setExpanded(map[section]);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, [section]);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        const stored = localStorage.getItem(SIDEBAR_SECTIONS_KEY);
        const map = stored ? JSON.parse(stored) as Record<string, boolean> : {};
        map[section] = next;
        localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(map));
      } catch { /* ignore */ }
      return next;
    });
  }, [section]);

  return { expanded: loaded ? expanded : defaultOpen, toggle };
}

// ─── Active matching ────────────────────────────────────────────
// All known nav hrefs for specificity checking
const ALL_NAV_HREFS: string[] = [];
for (const entry of navSections) {
  if (entry === "divider") continue;
  if ("section" in entry) {
    for (const item of entry.items) {
      if (isLauncher(item)) {
        for (const child of item.children) { ALL_NAV_HREFS.push(child.href); if (child.alsoMatches) ALL_NAV_HREFS.push(...child.alsoMatches); }
      } else {
        ALL_NAV_HREFS.push(item.href);
        if (item.alsoMatches) ALL_NAV_HREFS.push(...item.alsoMatches);
      }
    }
  } else {
    ALL_NAV_HREFS.push(entry.href);
    if (entry.alsoMatches) ALL_NAV_HREFS.push(...entry.alsoMatches);
  }
}

function isNavLinkActive(link: NavLink, pathname: string): boolean {
  if (link.href === "/") return pathname === "/";
  // Exact match on alsoMatches: [] means exact-only
  if (link.alsoMatches !== undefined && link.alsoMatches.length === 0) {
    return pathname === link.href || pathname === link.href + "/";
  }
  // Exact match
  if (pathname === link.href) return true;
  // Check alsoMatches
  if (link.alsoMatches?.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) return true;
  // startsWith match — but only if no MORE specific href matches
  if (pathname.startsWith(link.href + "/")) {
    const hasMoreSpecific = ALL_NAV_HREFS.some(h => h !== link.href && h.length > link.href.length && (pathname === h || pathname.startsWith(h + "/") || pathname.startsWith(h)));
    return !hasMoreSpecific;
  }
  return false;
}

// ─── CollapsibleSection ─────────────────────────────────────────
function getAllHrefs(items: (NavLink | LauncherLink)[]): string[] {
  return items.flatMap((item) => isLauncher(item) ? item.children.map((c) => c.href) : [item.href]);
}

function getAllNavLinks(items: (NavLink | LauncherLink)[]): NavLink[] {
  return items.flatMap((item) => isLauncher(item) ? item.children : [item]);
}

function CollapsibleSection({
  section,
  items,
  isCollapsed,
  pathname,
}: {
  section: string;
  items: (NavLink | LauncherLink)[];
  isCollapsed: boolean;
  pathname: string;
}) {
  const allLinks = getAllNavLinks(items);
  const hasActiveChild = allLinks.some((link) => isNavLinkActive(link, pathname));
  const { expanded, toggle } = useSectionState(section, true);

  function isItemActive(item: NavLink) {
    return isNavLinkActive(item, pathname);
  }

  function isLauncherActive(launcher: LauncherLink) {
    return launcher.children.some((c) => isNavLinkActive(c, pathname));
  }

  if (isCollapsed) {
    return (
      <>
        <div className="my-1.5 mx-3 border-t border-autronis-border/30" />
        {items.map((item) =>
          isLauncher(item) ? (
            <LauncherItem key={item.label} item={item} isCollapsed isActive={isLauncherActive(item)} pathname={pathname} />
          ) : (
            <NavItem key={item.href} item={item} isCollapsed isActive={isItemActive(item)} />
          )
        )}
      </>
    );
  }

  return (
    <div className="mt-3 first:mt-1">
      <button
        onClick={toggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer transition-colors",
          "hover:bg-autronis-accent/5",
          hasActiveChild && "bg-autronis-accent/5"
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest transition-colors",
            hasActiveChild ? "text-autronis-accent/80" : "text-autronis-text-secondary/50"
          )}>
            {section}
          </span>
          <span className={cn(
            "text-[9px] tabular-nums px-1.5 py-0.5 rounded-full transition-colors",
            hasActiveChild
              ? "bg-autronis-accent/15 text-autronis-accent/70"
              : "bg-autronis-border/30 text-autronis-text-secondary/40"
          )}>
            {items.length}
          </span>
        </div>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 transition-transform duration-200",
          hasActiveChild ? "text-autronis-accent/50" : "text-autronis-text-secondary/40",
          !expanded && "-rotate-90"
        )} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 pt-0.5 pb-1">
              {items.map((item) =>
                isLauncher(item) ? (
                  <LauncherItem key={item.label} item={item} isCollapsed={false} isActive={isLauncherActive(item)} pathname={pathname} />
                ) : (
                  <NavItem key={item.href} item={item} isCollapsed={false} isActive={isItemActive(item)} />
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────
export function Sidebar() {
  const { isOpen, isCollapsed, setOpen, setCollapsed } = useSidebar();
  const pathname = usePathname();

  // Collect all nav hrefs to find the most specific match
  const allHrefs: string[] = [];
  for (const entry of navSections) {
    if (entry === "divider") continue;
    if ("section" in entry) {
      for (const item of entry.items) {
        if (isLauncher(item)) {
          for (const child of item.children) allHrefs.push(child.href);
        } else {
          allHrefs.push(item.href);
          if (item.alsoMatches) allHrefs.push(...item.alsoMatches);
        }
      }
    } else {
      allHrefs.push(entry.href);
      if (entry.alsoMatches) allHrefs.push(...entry.alsoMatches);
    }
  }

  function isActive(href: string, alsoMatches?: string[]) {
    if (href === "/") return pathname === "/";
    // Exact match
    if (pathname === href) return true;
    // Check alsoMatches first
    if (alsoMatches?.some(m => pathname === m || pathname.startsWith(m + "/"))) return true;
    // startsWith match — but only if no OTHER nav item is more specific
    if (!pathname.startsWith(href + "/") && pathname !== href) return false;
    // There IS a startsWith match — check if another href is more specific
    const moreSpecific = allHrefs.find(h => h !== href && h.length > href.length && (pathname === h || pathname.startsWith(h + "/") || pathname.startsWith(h)));
    return !moreSpecific;
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <motion.aside
        animate={{ width: isCollapsed ? 72 : 256 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "fixed top-0 left-0 h-full z-30 flex flex-col bg-autronis-card/95 backdrop-blur-xl border-r border-autronis-border",
          "max-lg:-translate-x-full max-lg:w-64 max-lg:transition-transform max-lg:duration-300",
          isOpen && "max-lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center justify-between h-14 border-b border-autronis-border flex-shrink-0 pt-[env(safe-area-inset-top)]", isCollapsed ? "px-2" : "px-4")}>
          <Link href="/" className={cn("flex items-center gap-2.5 flex-shrink-0", isCollapsed && "mx-auto")}>
            <Image
              src="/logo.png"
              alt="Autronis"
              width={isCollapsed ? 28 : 36}
              height={isCollapsed ? 28 : 36}
              className={cn("object-contain transition-all duration-300", isCollapsed ? "h-7 w-7" : "h-9 w-9")}
              priority
            />
            {!isCollapsed && (
              <span className="text-lg font-bold text-autronis-text-primary tracking-tight">Autronis</span>
            )}
          </Link>
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-autronis-border/30 text-autronis-text-secondary lg:hidden ml-auto" aria-label="Menu sluiten">
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCollapsed(!isCollapsed)}
            className={cn("hidden lg:flex p-1 rounded-lg hover:bg-autronis-border/30 text-autronis-text-secondary transition-transform duration-300", isCollapsed ? "ml-auto rotate-180" : "ml-auto")}
            aria-label={isCollapsed ? "Sidebar uitklappen" : "Sidebar inklappen"}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-thin pb-20 max-lg:pb-24">
          {navSections.map((entry, idx) => {
            if (entry === "divider") {
              return <div key={`div-${idx}`} className="my-1.5 mx-3 border-t border-autronis-border/30" />;
            }
            if ("section" in entry) {
              return (
                <CollapsibleSection
                  key={entry.section}
                  section={entry.section}
                  items={entry.items}
                  isCollapsed={isCollapsed}
                  pathname={pathname}
                />
              );
            }
            return (
              <NavItem key={entry.href} item={entry} isCollapsed={isCollapsed} isActive={isActive(entry.href, entry.alsoMatches)} />
            );
          })}
        </nav>

        {/* Keyboard shortcut hint */}
        {!isCollapsed && (
          <div className="hidden lg:block border-t border-autronis-border p-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-autronis-border/20 text-autronis-text-secondary/40">
              <span className="text-[10px]">⌘K zoeken</span>
            </div>
          </div>
        )}
      </motion.aside>
    </>
  );
}
