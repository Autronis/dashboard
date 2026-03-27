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
  PlusCircle, Compass, Sparkles,
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
  // Top-level
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Ops Room", icon: Radio, href: "/ops-room" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Taken", icon: CheckSquare, href: "/taken" },
  { label: "Agenda", icon: Calendar, href: "/agenda" },
  { label: "Weekreview", icon: CalendarDays, href: "/weekreview" },

  // Mijn dag
  {
    section: "Mijn dag",
    items: [
      { label: "Tijd", icon: Clock, href: "/tijd" },
      { label: "Focus", icon: Focus, href: "/focus" },
      { label: "Dagritme", icon: Sunrise, href: "/dagritme" },
      { label: "Meetings", icon: Mic, href: "/meetings" },
      { label: "Ideeën", icon: Lightbulb, href: "/ideeen" },
      { label: "Projecten", icon: FolderKanban, href: "/projecten" },
      { label: "Documenten", icon: FileText, href: "/documenten" },
    ],
  },

  // Sales & Klanten
  {
    section: "Sales & Klanten",
    items: [
      {
        label: "Overzicht",
        icon: Layers,
        children: [
          { label: "Leads", icon: Zap, href: "/leads" },
          { label: "Follow-up", icon: UserCheck, href: "/followup" },
          { label: "Client Status", icon: Activity, href: "/client-status" },
          { label: "Sales Engine", icon: Rocket, href: "/sales-engine" },
        ],
      },
      { label: "Klanten", icon: Users, href: "/klanten" },
      { label: "Outreach", icon: Mail, href: "/outreach" },
      { label: "Mail Assistent", icon: Sparkles, href: "/mail" },
      { label: "Prijscalculator", icon: Calculator, href: "/prijscalculator" },
    ],
  },

  // Geld
  {
    section: "Geld",
    items: [
      {
        label: "Opstellen",
        icon: PenLine,
        children: [
          { label: "Offerte", icon: FileText, href: "/offertes" },
          { label: "Contract", icon: FileText, href: "/offertes/contracten" },
          { label: "Factuur", icon: Euro, href: "/facturen", alsoMatches: ["/financien/nieuw", "/financien/"] },
        ],
      },
      { label: "Financiën", icon: Euro, href: "/financien", alsoMatches: [] },
      { label: "Belasting", icon: Landmark, href: "/belasting" },
      { label: "Kilometers", icon: Car, href: "/kilometers" },
    ],
  },

  // Kennis & Content
  {
    section: "Kennis & Content",
    items: [
      {
        label: "Nieuw",
        icon: PlusCircle,
        children: [
          { label: "Content", icon: Megaphone, href: "/content" },
          { label: "Animatie", icon: Wand2, href: "/animaties" },
          { label: "Case Study", icon: Video, href: "/case-studies" },
        ],
      },
      {
        label: "Bibliotheek",
        icon: Library,
        children: [
          { label: "Wiki", icon: BookOpen, href: "/wiki" },
          { label: "Second Brain", icon: Brain, href: "/second-brain" },
          { label: "Learning Radar", icon: Radar, href: "/radar" },
        ],
      },
      { label: "Contract Analyzer", icon: ShieldAlert, href: "/contract-analyse" },
    ],
  },

  // Inzicht & Strategie
  {
    section: "Inzicht & Strategie",
    items: [
      {
        label: "Vastleggen",
        icon: Compass,
        children: [
          { label: "Doel", icon: Crosshair, href: "/doelen" },
          { label: "Gewoonte", icon: Flame, href: "/gewoontes" },
          { label: "Concurrent", icon: Eye, href: "/concurrenten" },
        ],
      },
    ],
  },

  // Beheer
  {
    section: "Beheer",
    items: [
      { label: "Team", icon: Users2, href: "/team" },
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
function isNavLinkActive(link: NavLink, pathname: string): boolean {
  if (link.href === "/") return pathname === "/";
  // Exact match on alsoMatches: [] means exact-only
  if (link.alsoMatches !== undefined && link.alsoMatches.length === 0) {
    return pathname === link.href || pathname === link.href + "/";
  }
  // Check alsoMatches prefixes
  if (link.alsoMatches?.some((prefix) => pathname.startsWith(prefix))) return true;
  // Standard match
  if (pathname === link.href) return true;
  if (pathname.startsWith(link.href + "/")) return true;
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

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
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
          <Link href="/" className={cn("flex items-center gap-2 flex-shrink-0", isCollapsed && "mx-auto")}>
            <Image
              src="/logo.png"
              alt="Autronis"
              width={isCollapsed ? 28 : 40}
              height={isCollapsed ? 14 : 20}
              className={cn("object-contain transition-all duration-300", isCollapsed ? "h-5 w-auto" : "h-7 w-auto")}
              priority
            />
            {!isCollapsed && (
              <span className="text-lg font-bold text-autronis-text-primary tracking-tight">Autronis</span>
            )}
          </Link>
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-autronis-border/30 text-autronis-text-secondary lg:hidden ml-auto">
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCollapsed(!isCollapsed)}
            className={cn("hidden lg:flex p-1 rounded-lg hover:bg-autronis-border/30 text-autronis-text-secondary transition-transform duration-300", isCollapsed ? "ml-auto rotate-180" : "ml-auto")}
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
              <NavItem key={entry.href} item={entry} isCollapsed={isCollapsed} isActive={isActive(entry.href)} />
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
