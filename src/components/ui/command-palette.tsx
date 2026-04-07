"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  Clock,
  Users,
  Euro,
  BarChart3,
  Target,
  Calendar,
  CheckSquare,
  Settings,
  Building2,
  FolderOpen,
  FileText,
  History,
  Loader2,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface ZoekResultaat {
  type: "klant" | "project" | "factuur" | "taak" | "lead" | "document" | "second-brain";
  id: number | string;
  titel: string;
  subtitel: string | null;
  link?: string;
  externalUrl?: string;
}

interface RecentSearch {
  query: string;
  timestamp: number;
}

const RECENT_KEY = "autronis-recent-searches";
const MAX_RECENT = 5;
const DEBOUNCE_MS = 250;

const pages = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Tijd", icon: Clock, href: "/tijd" },
  { label: "Klanten", icon: Users, href: "/klanten" },
  { label: "Financiën", icon: Euro, href: "/financien" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Sales Engine", icon: Target, href: "/sales-engine" },
  { label: "Agenda", icon: Calendar, href: "/agenda" },
  { label: "Taken", icon: CheckSquare, href: "/taken" },
  { label: "Instellingen", icon: Settings, href: "/instellingen" },
  { label: "Documenten", icon: FileText, href: "/documenten" },
];

const typeIcons: Record<ZoekResultaat["type"], typeof Building2> = {
  klant: Building2,
  project: FolderOpen,
  factuur: FileText,
  taak: CheckSquare,
  lead: Target,
  document: FileText,
  "second-brain": Brain,
};

const typeLabels: Record<ZoekResultaat["type"], string> = {
  klant: "Klant",
  project: "Project",
  factuur: "Factuur",
  taak: "Taak",
  lead: "Lead",
  document: "Document",
  "second-brain": "Second Brain",
};

const typeLabelsMeervoud: Record<ZoekResultaat["type"], string> = {
  klant: "Klanten",
  project: "Projecten",
  factuur: "Facturen",
  taak: "Taken",
  lead: "Leads",
  document: "Documenten",
  "second-brain": "Second Brain",
};

function loadRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSearch[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (!query.trim()) return;
  const existing = loadRecentSearches().filter((r) => r.query !== query);
  const updated = [{ query, timestamp: Date.now() }, ...existing].slice(
    0,
    MAX_RECENT
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable
  }
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [resultaten, setResultaten] = useState<ZoekResultaat[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Server-side search met debounce
  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const query = search.trim();
    if (query.length < 2) {
      setResultaten([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/zoeken?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const json = await res.json();
          setResultaten(json.resultaten ?? []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, open]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setResultaten([]);
      setRecentSearches(loadRecentSearches());
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
      if (abortRef.current) abortRef.current.abort();
    };
  }, [open]);

  // Filter pagina's client-side (altijd beschikbaar)
  const filteredPages = search.trim()
    ? pages.filter((p) =>
        p.label.toLowerCase().includes(search.trim().toLowerCase())
      )
    : pages;

  function navigate(href: string, searchQuery?: string) {
    if (searchQuery) saveRecentSearch(searchQuery);
    onClose();
    router.push(href);
  }

  function handleSelect(href: string) {
    navigate(href, search);
  }

  const handleSaveToSecondBrain = async () => {
    if (!search.trim()) return;
    try {
      const isUrl = /^https?:\/\//.test(search.trim());
      if (isUrl) {
        await fetch("/api/second-brain/verwerken", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bronUrl: search.trim() }),
        });
      } else {
        await fetch("/api/second-brain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "tekst", inhoud: search.trim() }),
        });
      }
      addToast("Opgeslagen in Second Brain", "succes");
    } catch {
      addToast("Kon niet opslaan in Second Brain", "fout");
    }
    setSearch("");
    onClose();
  };

  function handleResultSelect(result: ZoekResultaat) {
    if (search) saveRecentSearch(search);
    onClose();
    if (result.externalUrl) {
      window.open(result.externalUrl, "_blank");
    } else if (result.link) {
      router.push(result.link);
    }
  }

  // Groepeer resultaten per type
  const grouped = resultaten.reduce(
    (acc, r) => {
      if (!acc[r.type]) acc[r.type] = [];
      acc[r.type].push(r);
      return acc;
    },
    {} as Record<string, ZoekResultaat[]>
  );

  const hasSearch = search.trim().length >= 2;
  const hasResults = resultaten.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className={cn(
              "relative w-full max-w-xl mx-4",
              "bg-autronis-card border border-autronis-border",
              "rounded-2xl shadow-2xl overflow-hidden"
            )}
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
          >
            <Command
              className="flex flex-col"
              shouldFilter={false}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 border-b border-autronis-border">
                {loading ? (
                  <Loader2 className="w-5 h-5 text-autronis-accent flex-shrink-0 animate-spin" />
                ) : (
                  <Search className="w-5 h-5 text-autronis-text-secondary flex-shrink-0" />
                )}
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Zoek pagina's, klanten, taken..."
                  className={cn(
                    "flex-1 py-4 bg-transparent text-autronis-text-primary",
                    "placeholder:text-autronis-text-secondary",
                    "outline-none text-base"
                  )}
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-autronis-border text-autronis-text-secondary text-xs font-mono">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-80 overflow-y-auto p-2">
                {/* Geen resultaten */}
                {hasSearch && !loading && !hasResults && filteredPages.length === 0 && (
                  <div className="py-8 text-center text-autronis-text-secondary text-sm">
                    Geen resultaten gevonden.
                  </div>
                )}

                {/* Recente zoekopdrachten */}
                {!search && recentSearches.length > 0 && (
                  <Command.Group
                    heading={
                      <span className="text-xs font-medium text-autronis-text-secondary px-2">
                        Recente zoekopdrachten
                      </span>
                    }
                    className="mb-2"
                  >
                    {recentSearches.map((recent) => (
                      <Command.Item
                        key={`recent-${recent.timestamp}`}
                        value={`recent: ${recent.query}`}
                        onSelect={() => setSearch(recent.query)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                          "text-autronis-text-secondary text-sm",
                          "data-[selected=true]:bg-autronis-accent/10 data-[selected=true]:text-autronis-accent",
                          "transition-colors"
                        )}
                      >
                        <History className="w-4 h-4 flex-shrink-0" />
                        <span>{recent.query}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Pagina's */}
                {filteredPages.length > 0 && (
                  <Command.Group
                    heading={
                      <span className="text-xs font-medium text-autronis-text-secondary px-2">
                        Pagina&apos;s
                      </span>
                    }
                    className="mb-2"
                  >
                    {filteredPages.map((page) => {
                      const Icon = page.icon;
                      return (
                        <Command.Item
                          key={page.href}
                          value={page.label}
                          onSelect={() => handleSelect(page.href)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                            "text-autronis-text-primary text-sm",
                            "data-[selected=true]:bg-autronis-accent/10 data-[selected=true]:text-autronis-accent",
                            "transition-colors"
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span>{page.label}</span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}

                {/* Server-side zoekresultaten per type */}
                {Object.entries(grouped).map(([type, items]) => {
                  const Icon = typeIcons[type as ZoekResultaat["type"]];
                  const label = typeLabels[type as ZoekResultaat["type"]];
                  return (
                    <Command.Group
                      key={type}
                      heading={
                        <span className="text-xs font-medium text-autronis-text-secondary px-2">
                          {typeLabelsMeervoud[type as ZoekResultaat["type"]] || `${label}en`}
                        </span>
                      }
                      className="mb-2"
                    >
                      {items.map((item) => (
                        <Command.Item
                          key={`${item.type}-${item.id}`}
                          value={`${item.type}-${item.id}`}
                          onSelect={() => handleResultSelect(item)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                            "text-autronis-text-primary text-sm",
                            "data-[selected=true]:bg-autronis-accent/10 data-[selected=true]:text-autronis-accent",
                            "transition-colors"
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0 text-autronis-text-secondary" />
                          <span>{item.titel}</span>
                          {item.subtitel && (
                            <span className="ml-auto text-xs text-autronis-text-secondary">
                              {item.subtitel}
                            </span>
                          )}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
                {/* Second Brain actie */}
                {search.length > 0 && (
                  <Command.Group
                    heading={
                      <span className="text-xs font-medium text-autronis-text-secondary px-2">
                        Acties
                      </span>
                    }
                    className="mb-2"
                  >
                    <Command.Item
                      value="opslaan-second-brain"
                      onSelect={handleSaveToSecondBrain}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                        "text-autronis-text-primary text-sm",
                        "data-[selected=true]:bg-autronis-accent/10 data-[selected=true]:text-autronis-accent",
                        "transition-colors"
                      )}
                    >
                      <Brain className="w-4 h-4 mr-2 text-autronis-accent" />
                      Opslaan in Second Brain
                    </Command.Item>
                  </Command.Group>
                )}
              </Command.List>

              {/* Footer */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-t border-autronis-border text-autronis-text-secondary text-xs">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-autronis-border font-mono">
                    &uarr;&darr;
                  </kbd>
                  navigeren
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-autronis-border font-mono">
                    &crarr;
                  </kbd>
                  openen
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-autronis-border font-mono">
                    esc
                  </kbd>
                  sluiten
                </span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
