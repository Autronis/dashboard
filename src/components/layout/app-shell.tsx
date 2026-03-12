"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
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
        <div className="p-6">{children}</div>
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
    </div>
  );
}
