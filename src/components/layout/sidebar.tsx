"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  Users,
  Euro,
  BarChart3,
  Target,
  Calendar,
  CheckSquare,
  Settings,
  ChevronLeft,
  X,
  Command,
  ChevronDown,
  Landmark,
  Users2,
  Sparkles,
  FileText,
  Crosshair,
  Car,
  BookOpen,
  Monitor,
  Mic,
  Radar,
  Lightbulb,
} from "lucide-react";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Tijdregistratie", icon: Clock, href: "/tijdregistratie" },
  { label: "Schermtijd", icon: Monitor, href: "/schermtijd" },
  { label: "Meetings", icon: Mic, href: "/meetings" },
  { label: "Klanten", icon: Users, href: "/klanten" },
  { label: "Financiën", icon: Euro, href: "/financien" },
  { label: "Offertes", icon: FileText, href: "/offertes" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "CRM / Leads", icon: Target, href: "/crm" },
  { label: "Belasting", icon: Landmark, href: "/belasting" },
  { label: "Agenda", icon: Calendar, href: "/agenda" },
  { label: "Taken", icon: CheckSquare, href: "/taken" },
  { label: "Ideeën", icon: Lightbulb, href: "/ideeen" },
  { label: "Doelen (OKR)", icon: Crosshair, href: "/doelen" },
  { label: "Team", icon: Users2, href: "/team" },
  { label: "Kilometers", icon: Car, href: "/kilometers" },
  { label: "Wiki", icon: BookOpen, href: "/wiki" },
  { label: "Documenten", icon: FileText, href: "/documenten" },
  { label: "Learning Radar", icon: Radar, href: "/radar" },
  { label: "AI Assistent", icon: Sparkles, href: "/ai-assistent" },
];

const bottomNavItem = { label: "Instellingen", icon: Settings, href: "/instellingen" };

export function Sidebar() {
  const { isOpen, isCollapsed, setOpen, setCollapsed } = useSidebar();
  const pathname = usePathname();
  const [recentOpen, setRecentOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-30 flex flex-col glass border-r border-autronis-border transition-all duration-300",
          isCollapsed ? "w-16" : "w-64",
          // Mobile: hidden unless isOpen
          "max-lg:translate-x-full max-lg:w-64",
          isOpen && "max-lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-autronis-border flex-shrink-0">
          {!isCollapsed ? (
            <Image
              src="/logo.png"
              alt="Autronis"
              width={140}
              height={36}
              className="h-9 w-auto"
              priority
            />
          ) : (
            <Image
              src="/logo.png"
              alt="Autronis"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
          )}
          {/* Close button on mobile */}
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-lg hover:bg-autronis-border text-autronis-text-secondary lg:hidden ml-auto"
          >
            <X className="w-5 h-5" />
          </button>
          {/* Collapse button on desktop */}
          <button
            onClick={() => setCollapsed(!isCollapsed)}
            className={cn(
              "hidden lg:flex p-1 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-transform duration-300",
              isCollapsed ? "ml-auto rotate-180" : "ml-auto"
            )}
            aria-label={isCollapsed ? "Uitklappen" : "Inklappen"}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  active
                    ? "bg-autronis-accent/10 text-autronis-accent"
                    : "text-autronis-text-secondary hover:bg-autronis-border"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-autronis-border p-2 space-y-1">
          {/* Shortcuts hint */}
          {!isCollapsed && (
            <div className="px-3 py-2 mb-1">
              <button
                onClick={() => setRecentOpen(!recentOpen)}
                className="flex items-center gap-2 text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors w-full"
              >
                <ChevronDown className={cn("w-3 h-3 transition-transform", recentOpen && "rotate-180")} />
                Sneltoetsen
              </button>
              {recentOpen && (
                <div className="mt-2 space-y-1.5 text-xs text-autronis-text-secondary">
                  <div className="flex items-center justify-between">
                    <span>Zoeken</span>
                    <kbd className="bg-autronis-bg border border-autronis-border rounded px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Nieuw item</span>
                    <kbd className="bg-autronis-bg border border-autronis-border rounded px-1.5 py-0.5 text-[10px] font-mono">N</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Shortcuts</span>
                    <kbd className="bg-autronis-bg border border-autronis-border rounded px-1.5 py-0.5 text-[10px] font-mono">?</kbd>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Keyboard search hint */}
          {!isCollapsed && (
            <div className="px-3 py-2 mb-1 flex items-center gap-2 text-xs text-autronis-text-secondary">
              <Command className="w-3.5 h-3.5" />
              <span>Ctrl+K om te zoeken</span>
            </div>
          )}

          {/* Settings */}
          {(() => {
            const Icon = bottomNavItem.icon;
            const active = isActive(bottomNavItem.href);
            return (
              <Link
                href={bottomNavItem.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  active
                    ? "bg-autronis-accent/10 text-autronis-accent"
                    : "text-autronis-text-secondary hover:bg-autronis-border"
                )}
                title={isCollapsed ? bottomNavItem.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">{bottomNavItem.label}</span>
                )}
              </Link>
            );
          })()}
        </div>
      </aside>
    </>
  );
}
