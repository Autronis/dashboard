"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
const WavesBackground = dynamic(
  () => import("./waves-background").then((m) => ({ default: m.WavesBackground })),
  { ssr: false }
);
import { ToastContainer } from "@/components/ui/toast";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { KeyboardShortcutsOverlay } from "@/components/ui/keyboard-shortcuts-overlay";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useSidebar } from "@/hooks/use-sidebar";
import { FocusSetupModal } from "@/components/focus/focus-setup-modal";
import { FocusReflectieModal } from "@/components/focus/focus-reflectie-modal";
import { useFocus, loadFocusFromStorage } from "@/hooks/use-focus";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { SessionGebruiker } from "@/types";

const CommandPalette = dynamic(
  () => import("@/components/ui/command-palette").then((m) => ({ default: m.CommandPalette })),
  { ssr: false }
);

const FocusOverlay = dynamic(
  () => import("@/components/focus/focus-overlay").then((m) => ({ default: m.FocusOverlay })),
  { ssr: false }
);

const AriWidget = dynamic(
  () => import("@/components/ai/ari-widget").then((m) => ({ default: m.AriWidget })),
  { ssr: false }
);

const TeamFloat = dynamic(
  () => import("@/components/team/team-float").then((m) => ({ default: m.TeamFloat })),
  { ssr: false }
);

interface AppShellProps {
  gebruiker: SessionGebruiker;
  children: React.ReactNode;
}

export function AppShell({ gebruiker, children }: AppShellProps) {
  const { isCollapsed } = useSidebar();
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    shortcutsOverlayOpen,
    setShortcutsOverlayOpen,
  } = useKeyboardShortcuts();

  const focus = useFocus();

  // Restore focus session from localStorage on mount
  useEffect(() => {
    const stored = loadFocusFromStorage();
    if (stored) {
      focus.restore();
    }
  }, []);

  // Run auto-tasks + project sync once per session per day (non-blocking)
  useEffect(() => {
    const key =
      "autronis-auto-tasks-" + new Date().toISOString().split("T")[0];
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/auto-tasks", { method: "POST" }).catch(() => {});
    fetch("/api/projecten/sync", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-autronis-bg relative">
      {/* Animated background */}
      <WavesBackground />

      <Sidebar />
      <Header gebruiker={gebruiker} />
      <ToastContainer />
      <main
        className={cn(
          "relative z-[1] transition-all duration-300 env-safe-top",
          "pl-0 lg:pl-64",
          isCollapsed && "lg:pl-16",
          "pb-20 md:pb-6"
        )}
      >
        <div className="p-3 sm:p-4 lg:p-6 max-w-[1400px] mx-auto">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Floating elements */}
      <ScrollToTop />

      {/* Modals */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <KeyboardShortcutsOverlay
        open={shortcutsOverlayOpen}
        onClose={() => setShortcutsOverlayOpen(false)}
      />

      {/* Focus modals & overlay */}
      <FocusSetupModal />
      <FocusOverlay />
      <FocusReflectieModal />

      {/* Team awareness floating widget */}
      <TeamFloat />

      {/* A.R.I. floating chat widget */}
      <AriWidget />
    </div>
  );
}
