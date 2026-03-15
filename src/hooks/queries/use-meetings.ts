import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Meeting {
  id: number;
  klantId: number | null;
  projectId: number | null;
  titel: string;
  datum: string;
  audioPad: string | null;
  transcript: string | null;
  samenvatting: string | null;
  actiepunten: Array<{ tekst: string; verantwoordelijke: string }>;
  besluiten: string[];
  openVragen: string[];
  status: "verwerken" | "klaar" | "mislukt";
  klantNaam: string | null;
  projectNaam: string | null;
  aangemaaktOp: string;
}

async function fetchMeetings(klantId?: number, projectId?: number): Promise<Meeting[]> {
  const params = new URLSearchParams();
  if (klantId) params.set("klantId", String(klantId));
  if (projectId) params.set("projectId", String(projectId));
  const res = await fetch(`/api/meetings?${params}`);
  if (!res.ok) throw new Error("Kon meetings niet laden");
  const data = await res.json();
  return (data.meetings || []).map((m: Record<string, unknown>) => ({
    ...m,
    actiepunten: typeof m.actiepunten === "string" ? JSON.parse(m.actiepunten as string) : m.actiepunten || [],
    besluiten: typeof m.besluiten === "string" ? JSON.parse(m.besluiten as string) : m.besluiten || [],
    openVragen: typeof m.openVragen === "string" ? JSON.parse(m.openVragen as string) : m.openVragen || [],
  }));
}

async function fetchMeeting(id: number): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${id}`);
  if (!res.ok) throw new Error("Kon meeting niet laden");
  const data = await res.json();
  const m = data.meeting;
  return {
    ...m,
    actiepunten: typeof m.actiepunten === "string" ? JSON.parse(m.actiepunten) : m.actiepunten || [],
    besluiten: typeof m.besluiten === "string" ? JSON.parse(m.besluiten) : m.besluiten || [],
    openVragen: typeof m.openVragen === "string" ? JSON.parse(m.openVragen) : m.openVragen || [],
  };
}

export function useMeetings(klantId?: number, projectId?: number) {
  return useQuery({
    queryKey: ["meetings", klantId, projectId],
    queryFn: () => fetchMeetings(klantId, projectId),
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
