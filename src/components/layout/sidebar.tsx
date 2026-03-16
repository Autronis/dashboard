"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
  Megaphone,
  Video,
} from "lucide-react";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

type NavItem = { label: string; icon: typeof LayoutDashboard; href: string } | "separator" | { section: string };

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Agenda", icon: Calendar, href: "/agenda" },
  { label: "Taken", icon: CheckSquare, href: "/taken" },
  { section: "Werk" },
  { label: "Tijdregistratie", icon: Clock, href: "/tijdregistratie" },
  { label: "Schermtijd", icon: Monitor, href: "/schermtijd" },
  { label: "Meetings", icon: Mic, href: "/meetings" },
  { section: "Klanten & Sales" },
  { label: "Klanten", icon: Users, href: "/klanten" },
  { label: "CRM / Leads", icon: Target, href: "/crm" },
  { label: "Offertes", icon: FileText, href: "/offertes" },
  { section: "Financieel" },
  { label: "Financiën", icon: Euro, href: "/financien" },
  { label: "Belasting", icon: Landmark, href: "/belasting" },
  { label: "Kilometers", icon: Car, href: "/kilometers" },
  { section: "Groei" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Doelen", icon: Crosshair, href: "/doelen" },
  { label: "Ideeën", icon: Lightbulb, href: "/ideeen" },
  { section: "Content & Kennis" },
  { label: "Content", icon: Megaphone, href: "/content" },
  { label: "Documenten", icon: FileText, href: "/documenten" },
  { label: "Wiki", icon: BookOpen, href: "/wiki" },
  { label: "Learning Radar", icon: Radar, href: "/radar" },
  { section: "Team & AI" },
  { label: "Team", icon: Users2, href: "/team" },
  { label: "AI Assistent", icon: Sparkles, href: "/ai-assistent" },
  { label: "Case Studies", icon: Video, href: "/case-studies" },
];

const bottomNavItem = { label: "Instellingen", icon: Settings, href: "/instellingen" };

export function Sidebar() {
  const { isOpen, isCollapsed, setOpen, setCollapsed } = useSidebar();
  const pathname = usePathname();
  const [urgentCount, setUrgentCount] = useState(0);

  useEffect(() => {
    fetch(`/api/belasting/deadlines?jaar=${new Date().getFullYear()}`)
      .then(r => r.json())
      .then(data => {
        const nu = new Date();
        const count = (data.deadlines || []).filter((d: {afgerond: number; datum: string}) => {
          if (d.afgerond) return false;
          const dagen = Math.ceil((new Date(d.datum).getTime() - nu.getTime()) / 86400000);
          return dagen <= 7;
        }).length;
        setUrgentCount(count);
      })
      .catch(() => {});
  }, []);

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
      <motion.aside
        animate={{ width: isCollapsed ? 72 : 260 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "fixed top-0 left-0 h-full z-30 flex flex-col glass border-r border-autronis-border",
          // Mobile: hidden unless isOpen
          "max-lg:translate-x-full max-lg:w-64 max-lg:transition-transform max-lg:duration-300",
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
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item, idx) => {
            if (item === "separator") {
              return <div key={`sep-${idx}`} className="my-2 mx-3 border-t border-autronis-border/50" />;
            }
            if ("section" in item) {
              if (isCollapsed) {
                return <div key={`sec-${idx}`} className="my-2 mx-3 border-t border-autronis-border/50" />;
              }
              return (
                <div key={`sec-${idx}`} className="pt-4 pb-1 px-4">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-autronis-text-tertiary">{item.section}</span>
                </div>
              );
            }
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-150 group",
                  active
                    ? "bg-autronis-accent/10 border-l-[3px] border-autronis-accent text-white font-semibold"
                    : "text-autronis-text-secondary hover:bg-white/5 hover:text-autronis-text-primary border-l-[3px] border-transparent"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="relative flex-shrink-0">
                  <Icon className={cn("w-[18px] h-[18px] transition-colors", active ? "text-autronis-accent" : "text-slate-400 group-hover:text-slate-300")} />
                  {item.href === "/belasting" && urgentCount > 0 && isCollapsed && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </span>
                {!isCollapsed && (
                  <span className="text-[13px] truncate flex-1">{item.label}</span>
                )}
                {!isCollapsed && item.href === "/belasting" && urgentCount > 0 && (
                  <span className="ml-auto flex-shrink-0 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-red-500 text-white rounded-full animate-pulse">
                    {urgentCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-autronis-border/50 p-2 space-y-0.5">
          {/* Settings */}
          {(() => {
            const Icon = bottomNavItem.icon;
            const active = isActive(bottomNavItem.href);
            return (
              <Link
                href={bottomNavItem.href}
                className={cn(
                  "flex items-center gap-3 py-3 px-4 rounded-lg transition-colors duration-150",
                  active
                    ? "bg-autronis-accent/10 border-l-[3px] border-autronis-accent text-white font-semibold"
                    : "text-autronis-text-secondary hover:bg-white/5 border-l-[3px] border-transparent"
                )}
                title={isCollapsed ? bottomNavItem.label : undefined}
              >
                <Icon className={cn("w-5 h-5 flex-shrink-0", active ? "text-autronis-accent" : "text-slate-400")} />
                {!isCollapsed && (
                  <span className="text-sm">{bottomNavItem.label}</span>
                )}
              </Link>
            );
          })()}
        </div>
      </motion.aside>
    </>
  );
}
