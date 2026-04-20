"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

interface RevolutStatus {
  gekoppeld: boolean;
  laatsteSyncOp?: string | null;
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return "zojuist";
  if (diffMin < 60) return `${diffMin} min geleden`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}u geleden`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d geleden`;
}

export function RevolutSyncIndicator() {
  const { data } = useQuery<RevolutStatus>({
    queryKey: ["revolut-status"],
    queryFn: async () => {
      const res = await fetch("/api/revolut");
      if (!res.ok) return { gekoppeld: false };
      return res.json();
    },
    staleTime: 60_000,
  });

  if (!data?.gekoppeld || !data.laatsteSyncOp) return null;

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-autronis-text-secondary">
      <RefreshCw className="w-3 h-3" />
      <span>Revolut gesynct {formatRelative(data.laatsteSyncOp)}</span>
    </div>
  );
}
