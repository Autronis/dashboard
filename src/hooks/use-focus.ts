"use client";

import { create } from "zustand";
import { useTimer } from "./use-timer";
import { playFocusDing, requestNotificationPermission, showFocusNotification } from "@/lib/focus-sound";

const STORAGE_KEY = "autronis-focus";

interface FocusStorage {
  isActive: boolean;
  isPaused: boolean;
  projectId: number;
  projectNaam: string;
  taakId: number | null;
  taakTitel: string | null;
  geplandeDuur: number;
  startTimestamp: number;
  totalePauzeDuur: number;
  pauseStartTimestamp: number | null;
  focusSessieId: number;
  tijdregistratieId: number;
}

interface FocusState {
  isActive: boolean;
  isPaused: boolean;
  projectId: number | null;
  projectNaam: string;
  taakId: number | null;
  taakTitel: string | null;
  geplandeDuur: number;
  resterend: number;
  startTimestamp: number | null;
  totalePauzeDuur: number;
  pauseStartTimestamp: number | null;
  focusSessieId: number | null;
  tijdregistratieId: number | null;
  showSetup: boolean;
  showReflectie: boolean;
  showOverlay: boolean;
}

interface FocusActions {
  openSetup: () => void;
  closeSetup: () => void;
  start: (params: {
    projectId: number;
    projectNaam: string;
    taakId: number | null;
    taakTitel: string | null;
    duurMinuten: number;
  }) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: (reflectie?: string) => Promise<void>;
  tick: () => void;
  openOverlay: () => void;
  closeReflectie: () => void;
  restore: () => void;
}

function saveToStorage(state: FocusStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable
  }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // SSR or storage unavailable
  }
}

function loadFromStorage(): FocusStorage | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FocusStorage;
  } catch {
    return null;
  }
}

function calculateResterend(
  geplandeDuur: number,
  startTimestamp: number,
  totalePauzeDuur: number,
  isPaused: boolean,
  pauseStartTimestamp: number | null
): number {
  const now = Date.now() / 1000;
  const elapsed = now - startTimestamp / 1000;
  let pauzeDuur = totalePauzeDuur;
  if (isPaused && pauseStartTimestamp) {
    pauzeDuur += now - pauseStartTimestamp / 1000;
  }
  return Math.max(0, Math.round(geplandeDuur - elapsed + pauzeDuur));
}

export const useFocus = create<FocusState & FocusActions>((set, get) => ({
  // State
  isActive: false,
  isPaused: false,
  projectId: null,
  projectNaam: "",
  taakId: null,
  taakTitel: null,
  geplandeDuur: 0,
  resterend: 0,
  startTimestamp: null,
  totalePauzeDuur: 0,
  pauseStartTimestamp: null,
  focusSessieId: null,
  tijdregistratieId: null,
  showSetup: false,
  showReflectie: false,
  showOverlay: false,

  // Actions
  openSetup: () => set({ showSetup: true }),
  closeSetup: () => set({ showSetup: false }),

  start: async ({ projectId, projectNaam, taakId, taakTitel, duurMinuten }) => {
    // Stop active regular timer if running
    const timerState = useTimer.getState();
    if (timerState.isRunning && timerState.registratieId) {
      const elapsed = timerState.elapsed;
      const duur = Math.round(elapsed / 60);
      const timerRes = await fetch(`/api/tijdregistraties/${timerState.registratieId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eindTijd: new Date().toISOString(),
          duurMinuten: duur,
        }),
      });
      if (timerRes.ok) {
        timerState.stop();
      }
      // Continue with focus start regardless — don't block on timer stop failure
    }

    // Request notification permission
    requestNotificationPermission();

    // Create tijdregistratie
    const regRes = await fetch("/api/tijdregistraties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        omschrijving: `Focus sessie${taakTitel ? `: ${taakTitel}` : ""}`,
        categorie: "focus",
        startTijd: new Date().toISOString(),
      }),
    });
    const regData = await regRes.json();
    if (!regRes.ok) throw new Error(regData.fout || "Tijdregistratie aanmaken mislukt");

    // Create focus session
    const focusRes = await fetch("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        taakId,
        geplandeDuurMinuten: duurMinuten,
        tijdregistratieId: regData.registratie.id,
      }),
    });
    const focusData = await focusRes.json();
    if (!focusRes.ok) {
      // Cleanup orphaned tijdregistratie
      await fetch(`/api/tijdregistraties/${regData.registratie.id}`, { method: "DELETE" });
      throw new Error(focusData.fout || "Focus sessie aanmaken mislukt");
    }

    const geplandeDuur = duurMinuten * 60;
    const startTimestamp = Date.now();

    const newState = {
      isActive: true,
      isPaused: false,
      projectId,
      projectNaam,
      taakId,
      taakTitel,
      geplandeDuur,
      resterend: geplandeDuur,
      startTimestamp,
      totalePauzeDuur: 0,
      pauseStartTimestamp: null,
      focusSessieId: focusData.sessie.id,
      tijdregistratieId: regData.registratie.id,
      showSetup: false,
      showReflectie: false,
      showOverlay: true,
    };

    set(newState);
    saveToStorage({
      isActive: true,
      isPaused: false,
      projectId,
      projectNaam,
      taakId,
      taakTitel,
      geplandeDuur,
      startTimestamp,
      totalePauzeDuur: 0,
      pauseStartTimestamp: null,
      focusSessieId: focusData.sessie.id,
      tijdregistratieId: regData.registratie.id,
    });
  },

  pause: () => {
    const state = get();
    if (!state.isActive || state.isPaused) return;
    const pauseStartTimestamp = Date.now();
    set({ isPaused: true, pauseStartTimestamp });
    saveToStorage({
      isActive: true,
      isPaused: true,
      projectId: state.projectId!,
      projectNaam: state.projectNaam,
      taakId: state.taakId,
      taakTitel: state.taakTitel,
      geplandeDuur: state.geplandeDuur,
      startTimestamp: state.startTimestamp!,
      totalePauzeDuur: state.totalePauzeDuur,
      pauseStartTimestamp,
      focusSessieId: state.focusSessieId!,
      tijdregistratieId: state.tijdregistratieId!,
    });
  },

  resume: () => {
    const state = get();
    if (!state.isActive || !state.isPaused || !state.pauseStartTimestamp) return;
    const pauzeDuur = (Date.now() - state.pauseStartTimestamp) / 1000;
    const totalePauzeDuur = state.totalePauzeDuur + pauzeDuur;
    set({ isPaused: false, pauseStartTimestamp: null, totalePauzeDuur });
    saveToStorage({
      isActive: true,
      isPaused: false,
      projectId: state.projectId!,
      projectNaam: state.projectNaam,
      taakId: state.taakId,
      taakTitel: state.taakTitel,
      geplandeDuur: state.geplandeDuur,
      startTimestamp: state.startTimestamp!,
      totalePauzeDuur,
      pauseStartTimestamp: null,
      focusSessieId: state.focusSessieId!,
      tijdregistratieId: state.tijdregistratieId!,
    });
  },

  stop: async (reflectie?: string) => {
    const state = get();
    if (!state.isActive) return;

    const werkelijkeDuur = state.geplandeDuur - state.resterend;
    const werkelijkeDuurMinuten = Math.round(werkelijkeDuur / 60);
    const isVoltooid = state.resterend <= 0;

    let apiFailed = false;

    // Update tijdregistratie
    if (state.tijdregistratieId) {
      const res = await fetch(`/api/tijdregistraties/${state.tijdregistratieId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eindTijd: new Date().toISOString(),
          duurMinuten: werkelijkeDuurMinuten,
        }),
      });
      if (!res.ok) apiFailed = true;
    }

    // Update focus session
    if (state.focusSessieId) {
      const res = await fetch(`/api/focus/${state.focusSessieId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          werkelijkeDuurMinuten,
          reflectie: reflectie || null,
          status: isVoltooid ? "voltooid" : "afgebroken",
        }),
      });
      if (!res.ok) apiFailed = true;
    }

    // Always clear state — don't keep the user stuck if API fails
    set({
      isActive: false,
      isPaused: false,
      projectId: null,
      projectNaam: "",
      taakId: null,
      taakTitel: null,
      geplandeDuur: 0,
      resterend: 0,
      startTimestamp: null,
      totalePauzeDuur: 0,
      pauseStartTimestamp: null,
      focusSessieId: null,
      tijdregistratieId: null,
      showSetup: false,
      showReflectie: false,
      showOverlay: false,
    });
    clearStorage();

    if (apiFailed) {
      throw new Error("Sessie opslaan mislukt, maar timer is gestopt.");
    }
  },

  tick: () => {
    const state = get();
    if (!state.isActive || state.isPaused || !state.startTimestamp) return;
    // Prevent re-triggering after completion
    if (state.showReflectie) return;

    const resterend = calculateResterend(
      state.geplandeDuur,
      state.startTimestamp,
      state.totalePauzeDuur,
      state.isPaused,
      state.pauseStartTimestamp
    );

    set({ resterend });

    if (resterend <= 0) {
      // Timer complete — set isPaused to stop further ticks
      playFocusDing();
      showFocusNotification(state.projectNaam);
      set({ showReflectie: true, showOverlay: false, isPaused: true });
    }
  },

  openOverlay: () => set({ showOverlay: true }),

  closeReflectie: () => set({ showReflectie: false }),

  restore: () => {
    const stored = loadFromStorage();
    if (!stored || !stored.isActive) return;

    const resterend = calculateResterend(
      stored.geplandeDuur,
      stored.startTimestamp,
      stored.totalePauzeDuur,
      stored.isPaused,
      stored.pauseStartTimestamp
    );

    // If timer expired while away, trigger completion
    if (resterend <= 0 && !stored.isPaused) {
      set({
        isActive: true,
        isPaused: false,
        projectId: stored.projectId,
        projectNaam: stored.projectNaam,
        taakId: stored.taakId,
        taakTitel: stored.taakTitel,
        geplandeDuur: stored.geplandeDuur,
        resterend: 0,
        startTimestamp: stored.startTimestamp,
        totalePauzeDuur: stored.totalePauzeDuur,
        pauseStartTimestamp: null,
        focusSessieId: stored.focusSessieId,
        tijdregistratieId: stored.tijdregistratieId,
        showSetup: false,
        showReflectie: true,
        showOverlay: false,
      });
      playFocusDing();
      return;
    }

    set({
      isActive: true,
      isPaused: stored.isPaused,
      projectId: stored.projectId,
      projectNaam: stored.projectNaam,
      taakId: stored.taakId,
      taakTitel: stored.taakTitel,
      geplandeDuur: stored.geplandeDuur,
      resterend,
      startTimestamp: stored.startTimestamp,
      totalePauzeDuur: stored.totalePauzeDuur,
      pauseStartTimestamp: stored.pauseStartTimestamp,
      focusSessieId: stored.focusSessieId,
      tijdregistratieId: stored.tijdregistratieId,
      showSetup: false,
      showReflectie: false,
      showOverlay: true,
    });
  },
}));

export function loadFocusFromStorage(): FocusStorage | null {
  return loadFromStorage();
}
