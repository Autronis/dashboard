"use client";

import { useEffect, useState } from "react";
import { usePortal } from "../layout";
import { CheckCircle2, Circle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Taak {
  id: number;
  titel: string;
  status: string;
  prioriteit: string;
}

interface Project {
  id: number;
  naam: string;
  omschrijving: string | null;
  status: string;
  voortgangPercentage: number;
  deadline: string | null;
  taken: Taak[];
  voortgang: number;
}

const statusIcon: Record<string, { icon: typeof Circle; color: string }> = {
  open: { icon: Circle, color: "text-[#8A9BA0]" },
  bezig: { icon: Loader2, color: "text-blue-400" },
  afgerond: { icon: CheckCircle2, color: "text-emerald-400" },
};

export default function PortalProjecten() {
  const { token } = usePortal();
  const [projecten, setProjecten] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/${token}/projecten`);
        if (res.ok) {
          const data = await res.json();
          setProjecten(data.projecten || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#17B8A5]" />
      </div>
    );
  }

  if (projecten.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-[#8A9BA0]">Geen projecten gevonden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Projecten</h1>
      {projecten.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const [open, setOpen] = useState(project.status === "actief");
  const afgerond = project.taken.filter((t) => t.status === "afgerond").length;
  const totaal = project.taken.length;

  return (
    <div className="bg-[#192225] border border-[#2A3538] rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 sm:p-6 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-lg font-semibold text-white truncate">{project.naam}</h2>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase",
              project.status === "actief" ? "bg-blue-500/15 text-blue-400" :
              project.status === "afgerond" ? "bg-emerald-500/15 text-emerald-400" :
              "bg-amber-500/15 text-amber-400"
            )}>
              {project.status}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-[#2A3538] rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", project.voortgang === 100 ? "bg-green-400" : "bg-[#17B8A5]")}
                style={{ width: `${project.voortgang}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-[#17B8A5] tabular-nums">{project.voortgang}%</span>
          </div>
          <p className="text-xs text-[#8A9BA0] mt-1">{afgerond}/{totaal} taken afgerond</p>
        </div>
        {open ? <ChevronDown className="w-5 h-5 text-[#8A9BA0] ml-4 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-[#8A9BA0] ml-4 flex-shrink-0" />}
      </button>

      {/* Tasks */}
      {open && (
        <div className="border-t border-[#2A3538] px-5 sm:px-6 py-4 space-y-1.5">
          {project.taken.length === 0 ? (
            <p className="text-sm text-[#8A9BA0] py-2">Geen taken gevonden.</p>
          ) : (
            project.taken.map((taak) => {
              const cfg = statusIcon[taak.status] || statusIcon.open;
              const Icon = cfg.icon;
              return (
                <div
                  key={taak.id}
                  className={cn(
                    "flex items-center gap-3 py-2 px-3 rounded-lg",
                    taak.status === "afgerond" && "opacity-60"
                  )}
                >
                  <Icon className={cn("w-4 h-4 flex-shrink-0", cfg.color)} />
                  <span className={cn(
                    "text-sm flex-1",
                    taak.status === "afgerond" ? "text-[#8A9BA0] line-through" : "text-white"
                  )}>
                    {taak.titel}
                  </span>
                  {taak.prioriteit === "hoog" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">Hoog</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
