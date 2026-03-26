"use client";

export function PageSkeleton({ cards = 4, showHeader = true }: { cards?: number; showHeader?: boolean }) {
  return (
    <div className="animate-pulse space-y-6">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 rounded-lg bg-[#192225]" />
          <div className="flex gap-3">
            <div className="h-10 w-32 rounded-xl bg-[#192225]" />
            <div className="h-10 w-10 rounded-xl bg-[#192225]" />
          </div>
        </div>
      )}
      {cards > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-[#192225] border border-[#2A3538]" />
          ))}
        </div>
      )}
      <div className="space-y-4">
        <div className="h-64 rounded-2xl bg-[#192225] border border-[#2A3538]" />
        <div className="h-48 rounded-2xl bg-[#192225] border border-[#2A3538]" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-lg bg-[#192225]" />
        <div className="flex gap-3">
          <div className="h-10 w-64 rounded-xl bg-[#192225]" />
          <div className="h-10 w-32 rounded-xl bg-[#192225]" />
        </div>
      </div>
      <div className="rounded-2xl bg-[#192225] border border-[#2A3538] overflow-hidden">
        <div className="h-12 bg-[#1a2629] border-b border-[#2A3538]" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 border-b border-[#2A3538] last:border-b-0" />
        ))}
      </div>
    </div>
  );
}
