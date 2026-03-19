"use client";

import { useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { WavesBackground } from "./waves-background";
import { ToastContainer } from "@/components/ui/toast";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { QuickActionButton } from "@/components/ui/quick-action-button";
import { CommandPalette } from "@/components/ui/command-palette";
import { KeyboardShortcutsOverlay } from "@/components/ui/keyboard-shortcuts-overlay";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useSidebar } from "@/hooks/use-sidebar";
import { FocusSetupModal } from "@/components/focus/focus-setup-modal";
import { FocusOverlay } from "@/components/focus/focus-overlay";
import { FocusReflectieModal } from "@/components/focus/focus-reflectie-modal";
import { AriWidget } from "@/components/ai/ari-widget";
import { useFocus, loadFocusFromStorage } from "@/hooks/use-focus";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { SessionGebruiker } from "@/types";

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

  // Run auto-tasks once per session per day (non-blocking)
  useEffect(() => {
    const key =
      "autronis-auto-tasks-" + new Date().toISOString().split("T")[0];
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/auto-tasks", { method: "POST" }).catch(() => {});
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
          "relative z-[1] pt-16 transition-all duration-300",
          "pl-0 lg:pl-64",
          isCollapsed && "lg:pl-16",
          "pb-20 md:pb-6"
        )}
      >
        <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Floating elements */}
      <QuickActionButton />
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

      {/* A.R.I. floating chat widget */}
      <AriWidget />
    </div>
  );
}
