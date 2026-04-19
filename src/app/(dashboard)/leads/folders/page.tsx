"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X,
  Linkedin,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

interface Folder {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  leadCountLinkedin: number;
  leadCountGoogleMaps: number;
  leadCountTotal: number;
}

export default function LeadsFoldersPage() {
  const { addToast } = useToast();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads/folders");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setFolders(data.folders ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusyId("new");
    try {
      const res = await fetch("/api/leads/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      addToast(`Folder "${newName.trim()}" aangemaakt`, "succes");
      setNewName("");
      setIsCreating(false);
      load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Aanmaken mislukt", "fout");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/leads/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editingName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      addToast("Folder hernoemd", "succes");
      setEditingId(null);
      setEditingName("");
      load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Hernoemen mislukt", "fout");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/leads/folders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      addToast("Folder verwijderd", "succes");
      setDeletingId(null);
      load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Verwijderen mislukt", "fout");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Folders"
        description="Beheer je lead-categorieën. Rename of delete update automatisch de onderliggende leads."
        actions={
          !isCreating ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nieuwe folder
            </button>
          ) : undefined
        }
      />

      <AnimatePresence>
        {isCreating && (
          <motion.div
            key="create-row"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="rounded-2xl border border-autronis-accent/40 bg-autronis-card p-3 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Folder naam..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewName("");
                }
              }}
              autoFocus
              className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={busyId === "new"}
              className="p-2 rounded-lg bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25 transition-colors disabled:opacity-50"
              title="Opslaan"
            >
              {busyId === "new" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewName("");
              }}
              className="p-2 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/50 transition-colors"
              title="Annuleren"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && folders.length === 0 && (
        <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Folders laden...
        </div>
      )}

      {error && folders.length === 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <p className="font-medium">Kon folders niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {!loading && !error && folders.length === 0 && !isCreating && (
        <EmptyState
          titel="Nog geen folders"
          beschrijving="Folders groeperen je leads per thema (industrie, regio, intake-bron). Begin met één."
          actieLabel="Nieuwe folder"
          onActie={() => setIsCreating(true)}
          icoon={<FolderOpen className="h-7 w-7 text-autronis-accent" />}
        />
      )}

      {folders.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {folders.map((folder, i) => {
            const isEditing = editingId === folder.id;
            const isDeleting = deletingId === folder.id;
            const busy = busyId === folder.id;
            return (
              <motion.div
                key={folder.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                className={cn(
                  "rounded-2xl border bg-autronis-card p-4 transition-all",
                  isEditing || isDeleting
                    ? "border-autronis-accent/40"
                    : "border-autronis-border hover:border-autronis-accent/30 hover:bg-autronis-card/80"
                )}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(folder.id);
                        if (e.key === "Escape") {
                          setEditingId(null);
                          setEditingName("");
                        }
                      }}
                      autoFocus
                      className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-2 py-1.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(folder.id)}
                      disabled={busy}
                      className="p-1.5 rounded-md bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25 transition-colors disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditingName("");
                      }}
                      className="p-1.5 rounded-md text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : isDeleting ? (
                  <div className="space-y-3">
                    <p className="text-sm text-autronis-text-primary">
                      Folder <span className="font-semibold">&ldquo;{folder.name}&rdquo;</span> verwijderen?
                    </p>
                    <p className="text-[10px] text-autronis-text-secondary/70">
                      {folder.leadCountTotal} leads raken hun folder toewijzing kwijt (maar blijven bestaan).
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(folder.id)}
                        disabled={busy}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Verwijder"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/50 transition-colors"
                      >
                        Annuleer
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Link
                        href={`/leads/folders/${encodeURIComponent(folder.name)}`}
                        className="flex items-center gap-2 min-w-0 flex-1 group"
                      >
                        <div className="h-8 w-8 rounded-lg bg-autronis-accent/15 flex items-center justify-center flex-shrink-0 group-hover:bg-autronis-accent/25 transition-colors">
                          <FolderOpen className="w-4 h-4 text-autronis-accent" />
                        </div>
                        <h3 className="text-sm font-semibold text-autronis-text-primary group-hover:text-autronis-accent truncate transition-colors">
                          {folder.name}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(folder.id);
                            setEditingName(folder.name);
                          }}
                          className="p-1.5 rounded-md text-autronis-text-secondary/60 hover:text-autronis-text-primary hover:bg-autronis-border/50 transition-colors"
                          title="Hernoemen"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(folder.id)}
                          className="p-1.5 rounded-md text-autronis-text-secondary/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Verwijderen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-autronis-text-secondary">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/20">
                        <Linkedin className="w-2.5 h-2.5" />
                        {folder.leadCountLinkedin}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-autronis-accent/10 text-autronis-accent ring-1 ring-inset ring-autronis-accent/20">
                        <MapPin className="w-2.5 h-2.5" />
                        {folder.leadCountGoogleMaps}
                      </span>
                      <span className="ml-auto text-autronis-text-primary font-semibold tabular-nums text-xs">
                        {folder.leadCountTotal}{" "}
                        <span className="text-autronis-text-secondary/60 font-normal text-[10px]">totaal</span>
                      </span>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
