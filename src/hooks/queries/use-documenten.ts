import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DocumentBase, DocumentPayload, AiDraftRequest, AiDraftResponse } from "@/types/documenten";

interface DocumentenResponse {
  documenten: DocumentBase[];
}

async function fetchDocumenten(): Promise<DocumentBase[]> {
  const res = await fetch("/api/documenten");
  if (!res.ok) throw new Error("Kon documenten niet ophalen");
  const data: DocumentenResponse = await res.json();
  return data.documenten;
}

export function useDocumenten() {
  return useQuery({
    queryKey: ["documenten"],
    queryFn: fetchDocumenten,
    staleTime: 60_000,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DocumentPayload) => {
      const res = await fetch("/api/documenten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon document niet aanmaken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documenten"] });
    },
  });
}

export function useGenerateDraft() {
  return useMutation({
    mutationFn: async (request: AiDraftRequest): Promise<AiDraftResponse> => {
      const res = await fetch("/api/documenten/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon draft niet genereren");
      }
      const data = await res.json();
      return data.draft;
    },
  });
}
