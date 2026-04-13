"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Menu, LogOut, Timer } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { NotificationCenter } from "@/components/ui/notification-center";
import { useSidebar } from "@/hooks/use-sidebar";
import { useTimer } from "@/hooks/use-timer";
import { cn } from "@/lib/utils";
import type { SessionGebruiker } from "@/types";

function formatTimerKort(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface HeaderProps {
  gebruiker: SessionGebruiker;
}

export function Header({ gebruiker }: HeaderProps) {
  const router = useRouter();
  const { isCollapsed, setOpen } = useSidebar();
  const timer = useTimer();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick the timer in header too
  useEffect(() => {
    if (timer.isRunning) {
      timer.tick();
      intervalRef.current = setInterval(() => timer.tick(), 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [timer.isRunning]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const initials = gebruiker.naam.charAt(0).toUpperCase();

  const profielFotos: Record<string, string> = {
    "sem@autronis.com": "/foto-sem.jpg",
    "syb@autronis.com": "/foto-syb.jpg",
  };
  const profielFoto = profielFotos[gebruiker.email];

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-10 bg-autronis-card border-b border-autronis-border transition-all duration-300 h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)]",
        "left-0 lg:left-64",
        isCollapsed && "lg:left-16"
      )}
    >
      <div className="flex items-center justify-between h-full px-4">
        {/* Left: hamburger (mobile only) */}
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary lg:hidden"
          aria-label="Menu openen"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Spacer for desktop */}
        <div className="hidden lg:block" />

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Timer indicator */}
          {timer.isRunning && (
            <Link
              href="/tijd"
              className="flex items-center gap-2 bg-autronis-accent/10 border border-autronis-accent/30 rounded-lg px-3 py-1.5 hover:bg-autronis-accent/20 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-autronis-accent animate-pulse" />
              <Timer className="w-4 h-4 text-autronis-accent" />
              <span className="text-sm font-mono font-semibold text-autronis-accent tabular-nums">
                {formatTimerKort(timer.elapsed)}
              </span>
            </Link>
          )}

          <NotificationCenter />
          <ThemeToggle />

          {/* User avatar */}
          <div className="flex items-center gap-2 ml-2">
            {profielFoto ? (
              <Image
                src={profielFoto}
                alt={gebruiker.naam}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-autronis-accent flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-autronis-bg">{initials}</span>
              </div>
            )}
            <span className="hidden sm:block text-sm font-medium text-autronis-text-primary">
              {gebruiker.naam}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors ml-1"
            aria-label="Uitloggen"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
