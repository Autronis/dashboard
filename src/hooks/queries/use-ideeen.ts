import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============ TYPES ============

export interface Idee {
  id: number;
  nummer: number | null;
  naam: string;
  categorie: string | null;
  status: string;
  omschrijving: string | null;
  uitwerking: string | null;
  prioriteit: string;
  projectId: number | null;
  notionPageId: string | null;
  aangemaaktOp: string;
  bijgewerktOp: string;
  aiScore: number | null;
  aiHaalbaarheid: number | null;
  aiMarktpotentie: number | null;
  aiFitAutronis: number | null;
  doelgroep: string | null;
  verdienmodel: string | null;
  isAiSuggestie: number;
  gepromoveerd: number;
  impact: number | null;
  effort: number | null;
  revenuePotential: number | null;
}

// ============ FETCH FUNCTIONS ============

async function fetchIdeeen(filters?: {
  status?: string;
  categorie?: string;
}): Promise<Idee[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.categorie) params.set("categorie", filters.categorie);
  const res = await fetch(`/api/ideeen?${params}`);
  if (!res.ok) throw new Error("Kon ideeën niet laden");
  const data = await res.json();
  return data.ideeen || [];
}

// ============ QUERY HOOKS ============

export function useIdeeen(filters?: {
  status?: string;
  categorie?: string;
}) {
  return useQuery({
    queryKey: ["ideeen", filters],
    queryFn: () => fetchIdeeen(filters),
    staleTime: 30_000,
  });
}

// ============ MUTATION HOOKS ============

export function useCreateIdee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      naam: string;
      nummer?: number | null;
      categorie?: string | null;
      status?: string;
      omschrijving?: string | null;
      uitwerking?: string | null;
      prioriteit?: string;
    }) => {
      const res = await fetch("/api/ideeen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon idee niet aanmaken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideeen"] });
    },
  });
}

export function useUpdateIdee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: number;
      body: {
        naam?: string;
        nummer?: number | null;
        categorie?: string | null;
        status?: string;
        omschrijving?: string | null;
        uitwerking?: string | null;
        prioriteit?: string;
        impact?: number;
        effort?: number;
        revenuePotential?: number;
        gepromoveerd?: number;
        isAiSuggestie?: number;
      };
    }) => {
      const res = await fetch(`/api/ideeen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon idee niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideeen"] });
    },
  });
}

export function useDeleteIdee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/ideeen/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kon idee niet verwijderen");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideeen"] });
    },
  });
}

export function useStartProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/ideeen/${id}/start-project`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon project niet starten");
      }
      return res.json() as Promise<{ project: { id: number; naam: string } }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideeen"] });
    },
  });
}

export function useGenereerIdeeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ideeen/genereer", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Fout bij genereren");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideeen"] });
    },
  });
}

export function usePromoveerIdee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/ideeen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gepromoveerd: 1, isAiSuggestie: 0 }),
      });
      if (!res.ok) throw new Error("Promoveren mislukt");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideeen"] });
    },
  });
}

export function useRegenereerPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/ideeen/${id}/regenereer-plan`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Regenereren mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideeen"] });
    },
  });
}

export function useSyncBacklog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ideeen/sync-backlog", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon backlog niet synchroniseren");
      }
      return res.json() as Promise<{ nieuw: number; bijgewerkt: number; totaal: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideeen"] });
    },
  });
}
