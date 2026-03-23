"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Clock, Users, Euro, BarChart3, Calendar,
  CheckSquare, ChevronLeft, X, Landmark, Users2, FileText,
  Crosshair, Car, BookOpen, Mic, Radar, Lightbulb, Eye,
  Megaphone, Video, Flame, Focus, Brain, Zap, FolderKanban,
  Rocket, ChevronDown, Mail, Radio,
} from "lucide-react";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

interface NavLink { label: string; icon: typeof LayoutDashboard; href: string }
interface NavSection { section: string; items: NavLink[] }

const navSections: (NavLink | NavSection)[] = [
  // Top-level (always visible)
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Agenda", icon: Calendar, href: "/agenda" },
  { label: "Taken", icon: CheckSquare, href: "/taken" },

  // Grouped sections
  {
    section: "Werk",
    items: [
      { label: "Tijd", icon: Clock, href: "/tijd" },
      { label: "Focus", icon: Focus, href: "/focus" },
      { label: "Meetings", icon: Mic, href: "/meetings" },
      { label: "Ops Room", icon: Radio, href: "/ops-room" },
    ],
  },
  {
    section: "Klanten & Sales",
    items: [
      { label: "Projecten", icon: FolderKanban, href: "/projecten" },
      { label: "Klanten", icon: Users, href: "/klanten" },
      { label: "Leads", icon: Zap, href: "/leads" },
      { label: "Sales Engine", icon: Rocket, href: "/sales-engine" },
      { label: "Outreach", icon: Mail, href: "/outreach" },
      { label: "Offertes", icon: FileText, href: "/offertes" },
      { label: "Contracten", icon: FileText, href: "/offertes/contracten" },
    ],
  },
  {
    section: "Financieel",
    items: [
      { label: "Financiën", icon: Euro, href: "/financien" },
      { label: "Belasting", icon: Landmark, href: "/belasting" },
      { label: "Kilometers", icon: Car, href: "/kilometers" },
    ],
  },
  {
    section: "Groei",
    items: [
      { label: "Analytics", icon: BarChart3, href: "/analytics" },
      { label: "Gewoontes", icon: Flame, href: "/gewoontes" },
      { label: "Doelen", icon: Crosshair, href: "/doelen" },
      { label: "Ideeën", icon: Lightbulb, href: "/ideeen" },
      { label: "Concurrenten", icon: Eye, href: "/concurrenten" },
    ],
  },
  {
    section: "Content & Kennis",
    items: [
      { label: "Content", icon: Megaphone, href: "/content" },
      { label: "Case Studies", icon: Video, href: "/case-studies" },
      { label: "Documenten", icon: FileText, href: "/documenten" },
      { label: "Wiki", icon: BookOpen, href: "/wiki" },
      { label: "Learning Radar", icon: Radar, href: "/radar" },
      { label: "Second Brain", icon: Brain, href: "/second-brain" },
    ],
  },
  {
    section: "Team",
    items: [
      { label: "Team", icon: Users2, href: "/team" },
    ],
  },
];

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

function CollapsibleSection({
  section,
  items,
  isCollapsed,
  pathname,
}: {
  section: string;
  items: NavLink[];
  isCollapsed: boolean;
  pathname: string;
}) {
  const hasActiveChild = items.some((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );
  const { expanded, toggle } = useSectionState(section, true);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    // Exact match first, then prefix match only if the next char is "/" or end of string
    // This prevents /offertes matching when on /offertes/contracten
    if (pathname === href) return true;
    if (pathname.startsWith(href + "/")) {
      // Check no sibling route is a better match
      const betterMatch = items.some(
        (other) => other.href !== href && other.href.startsWith(href + "/") && pathname.startsWith(other.href)
      );
      return !betterMatch;
    }
    return false;
  }

  if (isCollapsed) {
    return (
      <>
        <div className="my-1.5 mx-3 border-t border-autronis-border/30" />
        {items.map((item) => (
          <NavItem key={item.href} item={item} isCollapsed isActive={isActive(item.href)} />
        ))}
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
            hasActiveChild ? "text-autronis-accent/80" : "text-autronis-text-secondary/50 group-hover:text-autronis-text-secondary/70"
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
              {items.map((item) => (
                <NavItem key={item.href} item={item} isCollapsed={false} isActive={isActive(item.href)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
        <div className="flex items-center justify-between px-4 h-16 border-b border-autronis-border flex-shrink-0 pt-[env(safe-area-inset-top)]">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <Image src="/logo.png" alt="Autronis" width={34} height={34} className="h-8 w-auto" priority />
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

        {/* Keyboard shortcut hint (desktop only) */}
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
