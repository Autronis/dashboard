"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ActionDock } from "./action-dock";
const WavesBackground = dynamic(
  () => import("./waves-background").then((m) => ({ default: m.WavesBackground })),
  { ssr: false }
);
import { ToastContainer } from "@/components/ui/toast";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { KeyboardShortcutsOverlay } from "@/components/ui/keyboard-shortcuts-overlay";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { SessionGebruiker } from "@/types";

const CommandPalette = dynamic(
  () => import("@/components/ui/command-palette").then((m) => ({ default: m.CommandPalette })),
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

const AutoClusterJobWatcher = dynamic(
  () =>
    import("@/components/taken/auto-cluster-job-watcher").then((m) => ({
      default: m.AutoClusterJobWatcher,
    })),
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

  // Open command palette when ActionDock search action fires
  useEffect(() => {
    const onOpen = () => setCommandPaletteOpen(true);
    window.addEventListener("autronis:open-command-palette", onOpen);
    return () => window.removeEventListener("autronis:open-command-palette", onOpen);
  }, [setCommandPaletteOpen]);

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

      <Sidebar gebruikerId={gebruiker.id} />
      <Header gebruiker={gebruiker} />
      <ToastContainer />
      <main
        className={cn(
          "relative z-[1] transition-all duration-300 env-safe-top",
          "pl-0 lg:pl-64",
          isCollapsed && "lg:pl-16",
          "pb-24 md:pb-24"
        )}
      >
        <div className="p-3 sm:p-4 lg:p-6 max-w-[1400px] mx-auto">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>

      {/* Action Dock */}
      <ActionDock />

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

      {/* Team awareness floating widget */}
      <TeamFloat />

      {/* A.R.I. floating chat widget */}
      <AriWidget />

      {/* Auto-cluster job progress banner (global, survives navigation) */}
      <AutoClusterJobWatcher />
    </div>
  );
}
