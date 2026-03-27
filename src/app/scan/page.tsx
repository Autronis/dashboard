"use client";

import { useState, useRef } from "react";
import { Camera, Upload, Check, Loader2, AlertCircle, Receipt } from "lucide-react";

const API_KEY_STORAGE = "autronis-scan-key";

export default function ScanPage() {
  const [apiKey, setApiKey] = useState(() => typeof window !== "undefined" ? localStorage.getItem(API_KEY_STORAGE) || "" : "");
  const [keyInput, setKeyInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ leverancier?: string; bedrag?: number; categorie?: string; omschrijving?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const saveKey = () => {
    localStorage.setItem(API_KEY_STORAGE, keyInput);
    setApiKey(keyInput);
  };

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    setPreview(URL.createObjectURL(file));
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("bon", file);

      const res = await fetch("/api/v1/scan", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Upload mislukt");
      }

      const data = await res.json();
      setResult(data.extracted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setIsUploading(false);
    }
  };

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <Receipt className="w-10 h-10 text-teal-400 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-white">Autronis Scanner</h1>
            <p className="text-sm text-gray-400 mt-1">Voer je API key in om te beginnen</p>
          </div>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveKey()}
            placeholder="aut_..."
            className="w-full bg-[#111827] border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-teal-500"
            autoFocus
          />
          <button
            onClick={saveKey}
            disabled={!keyInput.startsWith("aut_")}
            className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Opslaan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-2 pb-6">
        <h1 className="text-lg font-bold">Bonnetje Scannen</h1>
        <p className="text-xs text-gray-400 mt-1">Maak een foto of kies een bestand</p>
      </div>

      {/* Preview */}
      {preview && (
        <div className="mb-4 rounded-2xl overflow-hidden border border-gray-700">
          <img src={preview} alt="Preview" className="w-full max-h-64 object-contain bg-gray-900" />
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mb-4 bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-teal-400 font-medium text-sm">
            <Check className="w-4 h-4" />
            Uitgave opgeslagen
          </div>
          <div className="space-y-1 text-sm">
            {result.leverancier && <p><span className="text-gray-400">Leverancier:</span> {result.leverancier}</p>}
            {result.bedrag && <p><span className="text-gray-400">Bedrag:</span> €{result.bedrag.toFixed(2)}</p>}
            {result.categorie && <p><span className="text-gray-400">Categorie:</span> {result.categorie}</p>}
            {result.omschrijving && <p><span className="text-gray-400">Omschrijving:</span> {result.omschrijving}</p>}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {isUploading && (
        <div className="mb-4 bg-gray-800 rounded-2xl p-6 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
          <p className="text-sm text-gray-400">AI analyseert bonnetje...</p>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

      {/* Action buttons — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a0f1a] border-t border-gray-800">
        <div className="flex gap-3 max-w-sm mx-auto">
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={isUploading}
            className="flex-1 flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white font-medium py-4 rounded-2xl transition-colors"
          >
            <Camera className="w-5 h-5" />
            Foto
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-medium py-4 rounded-2xl transition-colors"
          >
            <Upload className="w-5 h-5" />
            Bestand
          </button>
        </div>
      </div>
    </div>
  );
}
