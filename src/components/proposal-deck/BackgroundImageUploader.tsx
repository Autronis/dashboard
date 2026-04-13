// src/components/proposal-deck/BackgroundImageUploader.tsx
"use client";

import { useRef, useState } from "react";
import { Upload, X, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function BackgroundImageUploader({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (url: string | undefined) => void;
}) {
  const { addToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/proposals/upload-image", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Upload mislukt");
      onChange(data.url);
      addToast("Afbeelding geüpload", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Upload mislukt", "fout");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary">
        Achtergrondafbeelding
      </div>
      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-autronis-border bg-autronis-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-16 h-10 object-cover rounded" />
          <div className="flex-1 text-xs text-autronis-text-secondary truncate">{value}</div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="p-2 text-autronis-text-secondary hover:text-red-400 rounded"
            title="Verwijderen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-autronis-border bg-autronis-bg hover:bg-autronis-card text-sm text-autronis-text-primary disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Uploaden..." : "Upload afbeelding"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-autronis-text-secondary" />
              <input
                type="url"
                placeholder="of plak URL"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-sm text-autronis-text-primary"
              />
            </div>
            <button
              type="button"
              disabled={!urlInput}
              onClick={() => {
                onChange(urlInput);
                setUrlInput("");
              }}
              className="px-3 py-2 rounded-lg bg-autronis-accent text-autronis-bg text-sm font-semibold disabled:opacity-30"
            >
              Zet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
