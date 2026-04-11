"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  CheckSquare,
  Lightbulb,
  MoreHorizontal,
  Euro,
  BarChart3,
  Calendar,
  Settings,
  Users,
  FileText,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const mainTabs = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Timer", icon: Clock, href: "/tijd" },
  { label: "Taken", icon: CheckSquare, href: "/taken" },
  { label: "Ideeën", icon: Lightbulb, href: "/ideeen" },
];

const moreTabs = [
  { label: "Agenda", icon: Calendar, href: "/agenda" },
  { label: "Klanten", icon: Users, href: "/klanten" },
  { label: "Facturen", icon: Euro, href: "/facturen" },
  { label: "Offertes", icon: FileText, href: "/offertes" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Instellingen", icon: Settings, href: "/instellingen" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const activeIndex = mainTabs.findIndex((t) => isActive(t.href));
  const moreActive = moreTabs.some((t) => isActive(t.href));

  return (
    <>
      {/* More menu overlay */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-autronis-card border-t border-autronis-border rounded-t-2xl p-4 safe-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-autronis-text-primary">
                  Meer
                </h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-autronis-border text-autronis-text-secondary"
                  aria-label="Menu sluiten"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {moreTabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = isActive(tab.href);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors",
                        active
                          ? "bg-autronis-accent/10 text-autronis-accent"
                          : "text-autronis-text-secondary hover:bg-autronis-border"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{tab.label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-autronis-card border-t border-autronis-border md:hidden safe-bottom">
        <div className="flex items-center justify-around h-16 px-2 relative">
          {/* Sliding indicator */}
          {activeIndex >= 0 && (
            <motion.div
              className="absolute top-0 h-0.5 w-12 bg-autronis-accent rounded-full"
              layoutId="bottomNavIndicator"
              style={{ left: `calc(${(activeIndex / 5) * 100}% + ${activeIndex * 20}% / 5 + 6%)` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}

          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 px-3 transition-colors",
                  active ? "text-autronis-accent" : "text-autronis-text-secondary"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
                {active && (
                  <motion.div
                    layoutId="bottomDot"
                    className="w-1 h-1 rounded-full bg-autronis-accent"
                  />
                )}
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center gap-1 py-2 px-3 transition-colors",
              moreActive ? "text-autronis-accent" : "text-autronis-text-secondary"
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">Meer</span>
            {moreActive && (
              <div className="w-1 h-1 rounded-full bg-autronis-accent" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
