"use client";

import { create } from "zustand";
import type { TijdCategorie } from "@/types";

interface LastTimer {
  projectId: number;
  omschrijving: string;
  categorie: TijdCategorie;
}

interface TimerState {
  isRunning: boolean;
  startTijd: string | null;
  projectId: number | null;
  omschrijving: string;
  categorie: TijdCategorie;
  registratieId: number | null;
  elapsed: number; // seconds
  lastTimer: LastTimer | null;

  start: (projectId: number, omschrijving: string, categorie: TijdCategorie, registratieId: number) => void;
  stop: () => void;
  tick: () => void;
  setOmschrijving: (omschrijving: string) => void;
  setCategorie: (categorie: TijdCategorie) => void;
  setProjectId: (projectId: number) => void;
  restore: (data: {
    startTijd: string;
    projectId: number;
    omschrijving: string;
    categorie: TijdCategorie;
    registratieId: number;
  }) => void;
}

const STORAGE_KEY = "autronis-timer";

function saveToStorage(state: Partial<TimerState>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        isRunning: state.isRunning,
        startTijd: state.startTijd,
        projectId: state.projectId,
        omschrijving: state.omschrijving,
        categorie: state.categorie,
        registratieId: state.registratieId,
      })
    );
  } catch {
    // localStorage not available
  }
}

function clearStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage not available
  }
}

export function loadTimerFromStorage(): Partial<TimerState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const useTimer = create<TimerState>((set, get) => ({
  isRunning: false,
  startTijd: null,
  projectId: null,
  omschrijving: "",
  categorie: "development",
  registratieId: null,
  elapsed: 0,
  lastTimer: null,

  start: (projectId, omschrijving, categorie, registratieId) => {
    const startTijd = new Date().toISOString();
    const newState = {
      isRunning: true,
      startTijd,
      projectId,
      omschrijving,
      categorie,
      registratieId,
      elapsed: 0,
    };
    set(newState);
    saveToStorage(newState);
  },

  stop: () => {
    const { projectId, omschrijving, categorie } = get();
    const last: LastTimer | null = projectId
      ? { projectId, omschrijving, categorie }
      : null;
    set({
      isRunning: false,
      startTijd: null,
      projectId: null,
      omschrijving: "",
      categorie: "development",
      registratieId: null,
      elapsed: 0,
      lastTimer: last,
    });
    clearStorage();
  },

  tick: () => {
    const { isRunning, startTijd } = get();
    if (!isRunning || !startTijd) return;
    const now = Date.now();
    const start = new Date(startTijd).getTime();
    const elapsed = Math.floor((now - start) / 1000);
    set({ elapsed });
  },

  setOmschrijving: (omschrijving) => {
    set({ omschrijving });
    const state = get();
    if (state.isRunning) saveToStorage(state);
  },

  setCategorie: (categorie) => {
    set({ categorie });
    const state = get();
    if (state.isRunning) saveToStorage(state);
  },

  setProjectId: (projectId) => {
    set({ projectId });
    const state = get();
    if (state.isRunning) saveToStorage(state);
  },

  restore: (data) => {
    const now = Date.now();
    const start = new Date(data.startTijd).getTime();
    const elapsed = Math.floor((now - start) / 1000);
    set({
      isRunning: true,
      startTijd: data.startTijd,
      projectId: data.projectId,
      omschrijving: data.omschrijving,
      categorie: data.categorie,
      registratieId: data.registratieId,
      elapsed,
    });
  },
}));
