import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface AgendaItem {
  id: number;
  gebruikerId: number | null;
  gebruikerNaam: string | null;
  titel: string;
  omschrijving: string | null;
  type: string;
  startDatum: string;
  eindDatum: string | null;
  heleDag: number | null;
  herinneringMinuten: number | null;
}

function datumStr(jaar: number, maand: number, dag: number) {
  return `${jaar}-${String(maand + 1).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

async function fetchAgenda(jaar: number, maand: number): Promise<AgendaItem[]> {
  const van = datumStr(maand === 0 ? jaar - 1 : jaar, maand === 0 ? 11 : maand - 1, 1);
  const totJaar = maand === 11 ? jaar + 1 : jaar;
  const totMaand = maand === 11 ? 0 : maand + 1;
  const totDagen = new Date(totJaar, totMaand + 1, 0).getDate();
  const tot = datumStr(totJaar, totMaand, totDagen);

  const res = await fetch(`/api/agenda?van=${van}&tot=${tot}`);
  if (!res.ok) throw new Error("Kon agenda niet laden");
  const json = await res.json();
  return json.items;
}

export function useAgenda(jaar: number, maand: number) {
  return useQuery({
    queryKey: ["agenda", jaar, maand],
    queryFn: () => fetchAgenda(jaar, maand),
    staleTime: 30_000,
  });
}

// ============ DEADLINES ============

export interface DeadlineEvent {
  id: string;
  titel: string;
  type: "taak" | "project" | "factuur";
  datum: string;
  klantNaam: string | null;
  projectNaam: string | null;
  linkHref: string;
  bedrag: number | null;
  googleEventId: string | null;
  status?: string;
}

async function fetchDeadlineEvents(jaar: number, maand: number): Promise<DeadlineEvent[]> {
  const van = datumStr(maand === 0 ? jaar - 1 : jaar, maand === 0 ? 11 : maand - 1, 1);
  const totJaar = maand === 11 ? jaar + 1 : jaar;
  const totMaand = maand === 11 ? 0 : maand + 1;
  const totDagen = new Date(totJaar, totMaand + 1, 0).getDate();
  const tot = datumStr(totJaar, totMaand, totDagen);

  const res = await fetch(`/api/agenda/deadlines?van=${van}&tot=${tot}`);
  if (!res.ok) return [];
  const json = await res.json() as { deadlines: DeadlineEvent[] };
  return json.deadlines;
}

export function useDeadlineEvents(jaar: number, maand: number) {
  return useQuery({
    queryKey: ["deadline-events", jaar, maand],
    queryFn: () => fetchDeadlineEvents(jaar, maand),
    staleTime: 30_000,
  });
}

// ============ EXTERNE KALENDERS ============

export interface ExternAttendee {
  naam: string | null;
  email: string;
}

export interface ExternEvent {
  id: string;
  titel: string;
  omschrijving: string | null;
  startDatum: string;
  eindDatum: string | null;
  heleDag: boolean;
  locatie: string | null;
  meetingUrl: string | null;
  organisator: string | null;
  deelnemers: ExternAttendee[];
  bron: string;
  bronNaam: string;
  kleur: string;
}

export interface ExterneKalender {
  id: number;
  naam: string;
  url: string;
  bron: string;
  kleur: string | null;
  isActief: number | null;
  laatstGesyncOp: string | null;
}

async function fetchExterneEvents(jaar: number, maand: number): Promise<ExternEvent[]> {
  const van = datumStr(maand === 0 ? jaar - 1 : jaar, maand === 0 ? 11 : maand - 1, 1);
  const totJaar = maand === 11 ? jaar + 1 : jaar;
  const totMaand = maand === 11 ? 0 : maand + 1;
  const totDagen = new Date(totJaar, totMaand + 1, 0).getDate();
  const tot = datumStr(totJaar, totMaand, totDagen);

  const res = await fetch(`/api/agenda/sync?van=${van}&tot=${tot}`);
  if (!res.ok) return [];
  const json = await res.json() as { events: ExternEvent[] };
  return json.events;
}

export function useExterneEvents(jaar: number, maand: number) {
  return useQuery({
    queryKey: ["externe-events", jaar, maand],
    queryFn: () => fetchExterneEvents(jaar, maand),
    staleTime: 60_000,
  });
}

async function fetchKalenders(): Promise<ExterneKalender[]> {
  const res = await fetch("/api/agenda/kalenders");
  if (!res.ok) return [];
  const json = await res.json() as { kalenders: ExterneKalender[] };
  return json.kalenders;
}

export function useExterneKalenders() {
  return useQuery({
    queryKey: ["externe-kalenders"],
    queryFn: fetchKalenders,
    staleTime: 60_000,
  });
}

export function useAddKalender() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { naam: string; url: string; bron: string; kleur?: string }) => {
      const res = await fetch("/api/agenda/kalenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json() as { fout?: string };
        throw new Error(json.fout ?? "Toevoegen mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["externe-kalenders"] });
      queryClient.invalidateQueries({ queryKey: ["externe-events"] });
    },
  });
}

export function useDeleteKalender() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/agenda/kalenders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Verwijderen mislukt");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["externe-kalenders"] });
      queryClient.invalidateQueries({ queryKey: ["externe-events"] });
    },
  });
}

// ============ TAKEN VOOR KALENDER ============

export interface AgendaTaak {
  id: number;
  titel: string;
  status: string;
  prioriteit: string;
  deadline: string | null;
  geschatteDuur: number | null; // minuten
  ingeplandStart: string | null; // ISO datetime
  ingeplandEind: string | null;  // ISO datetime
  projectNaam: string | null;
  klantNaam: string | null;
  toegewezenAanId: number | null;
  kalenderId: number | null;
  kalenderNaam: string | null;
  kalenderKleur: string | null;
  uitvoerder: string | null;
  projectMap: string | null;
  fase: string | null;
  cluster: string | null;
  omschrijving: string | null;
}

async function fetchAgendaTaken(): Promise<AgendaTaak[]> {
  const res = await fetch("/api/agenda/taken");
  if (!res.ok) return [];
  const json = await res.json() as { taken: AgendaTaak[] };
  return json.taken ?? [];
}

export function useAgendaTaken() {
  return useQuery({
    queryKey: ["agenda-taken"],
    queryFn: fetchAgendaTaken,
    staleTime: 30_000,
  });
}

export interface PlanTaakPayload {
  ingeplandStart: string;
  ingeplandEind: string;
  geschatteDuur?: number;
  kalenderId?: number;
}

export function usePlanTaak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: PlanTaakPayload & { id: number }) => {
      const res = await fetch(`/api/taken/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Inplannen mislukt");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-taken"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}

export function useUnplanTaak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/taken/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingeplandStart: null, ingeplandEind: null }),
      });
      if (!res.ok) throw new Error("Uitplannen mislukt");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-taken"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}

export function useUitplannenAlle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/agenda/uitplannen-alle", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.fout || "Uitplannen mislukt");
      }
      return res.json() as Promise<{ uitgepland: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-taken"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}
