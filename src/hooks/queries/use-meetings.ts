import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface MeetingAttendee {
  naam: string | null;
  email: string;
}

export interface Meeting {
  id: number | string;
  klantId: number | null;
  projectId: number | null;
  titel: string;
  datum: string;
  eindDatum: string | null;
  duurMinuten: number | null;
  audioPad: string | null;
  transcript: string | null;
  samenvatting: string | null;
  actiepunten: Array<{ tekst: string; verantwoordelijke: string }>;
  besluiten: string[];
  openVragen: string[];
  sentiment: string | null;
  tags: string[];
  status: "verwerken" | "klaar" | "mislukt" | null;
  klantNaam: string | null;
  projectNaam: string | null;
  aangemaaktOp: string | null;
  bron: "database" | "kalender";
  meetingUrl: string | null;
  deelnemers: MeetingAttendee[];
  bronNaam: string | null;
  locatie: string | null;
  omschrijving: string | null;
  organisator: string | null;
  hasNotities: boolean;
}

export interface MeetingVoorbereiding {
  context: string;
  suggesties: string[];
  waarschuwingen?: string[];
  openActiepunten: Array<{ tekst: string; verantwoordelijke: string }>;
  openTaken?: Array<{ titel: string; prioriteit: string; deadline: string | null }>;
  vorigeMeetings?: Array<{ titel: string; datum: string; samenvatting: string | null }>;
}

function parseJsonField<T>(val: unknown, fallback: T): T {
  if (typeof val === "string") {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return (val as T) || fallback;
}

function parseMeeting(m: Record<string, unknown>): Meeting {
  return {
    ...(m as unknown as Meeting),
    actiepunten: parseJsonField(m.actiepunten, []),
    besluiten: parseJsonField(m.besluiten, []),
    openVragen: parseJsonField(m.openVragen, []),
    tags: parseJsonField(m.tags, []),
    deelnemers: parseJsonField(m.deelnemers, []),
    bron: (m.bron as Meeting["bron"]) || "database",
    meetingUrl: (m.meetingUrl as string) || null,
    eindDatum: (m.eindDatum as string) || null,
    bronNaam: (m.bronNaam as string) || null,
    locatie: (m.locatie as string) || null,
    omschrijving: (m.omschrijving as string) || null,
    organisator: (m.organisator as string) || null,
    hasNotities: !!(m.hasNotities || m.samenvatting || m.transcript),
  } as Meeting;
}

async function fetchMeetings(klantId?: number, projectId?: number, zoek?: string): Promise<Meeting[]> {
  const params = new URLSearchParams();
  if (klantId) params.set("klantId", String(klantId));
  if (projectId) params.set("projectId", String(projectId));
  if (zoek) params.set("zoek", zoek);
  const res = await fetch(`/api/meetings?${params}`);
  if (!res.ok) throw new Error("Kon meetings niet laden");
  const data = await res.json();
  return (data.meetings || []).map((m: Record<string, unknown>) => parseMeeting(m));
}

async function fetchMeeting(id: number): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${id}`);
  if (!res.ok) throw new Error("Kon meeting niet laden");
  const data = await res.json();
  return parseMeeting(data.meeting);
}

export function useMeetings(klantId?: number, projectId?: number, zoek?: string) {
  return useQuery({
    queryKey: ["meetings", klantId, projectId, zoek],
    queryFn: () => fetchMeetings(klantId, projectId, zoek),
    staleTime: 30_000,
  });
}

export function useMeeting(id: number) {
  return useQuery({
    queryKey: ["meeting", id],
    queryFn: () => fetchMeeting(id),
    enabled: id > 0,
  });
}

export function useMeetingVoorbereiding(klantId?: number | null, projectId?: number | null, titel?: string) {
  return useQuery({
    queryKey: ["meeting-voorbereiding", klantId, projectId, titel],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (klantId) params.set("klantId", String(klantId));
      if (projectId) params.set("projectId", String(projectId));
      if (titel) params.set("titel", titel);
      const res = await fetch(`/api/meetings/voorbereiding?${params}`);
      if (!res.ok) throw new Error("Kon voorbereiding niet laden");
      const data = await res.json();
      return data.voorbereiding as MeetingVoorbereiding;
    },
    enabled: !!(klantId || projectId),
    staleTime: 60_000,
  });
}

export function useUploadMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/meetings", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Upload mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useVerwerkMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/meetings/${id}/verwerk`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Verwerking mislukt");
      }
      return res.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["meeting", id] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useSubmitTranscript() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, transcript }: { id: number; transcript: string }) => {
      const res = await fetch(`/api/meetings/${id}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Verwerking mislukt");
      }
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["meeting", id] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number | string; notities?: string; titel?: string; calendarImport?: boolean; datum?: string }) => {
      const numId = typeof id === "string" ? 0 : id;
      const res = await fetch(`/api/meetings/${numId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Opslaan mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useUploadMeetingAudio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, audio }: { id: number; audio: File }) => {
      const formData = new FormData();
      formData.append("audio", audio);
      const res = await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Upload mislukt");
      }
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["meeting", id] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Verwijderen mislukt");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}
