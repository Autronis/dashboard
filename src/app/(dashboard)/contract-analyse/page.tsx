"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle, Loader2, X, RotateCcw, ShieldAlert, Calendar, Euro, ClipboardList } from "lucide-react";
import { marked } from "marked";

interface AnalyseResultaat {
  analyse: string;
}

export default function ContractAnalysePage() {
  const [bestand, setBestand] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultaat, setResultaat] = useState<AnalyseResultaat | null>(null);
  const [fout, setFout] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const verwerkBestand = useCallback((file: File) => {
    if (file.type !== "application/pdf") {
      setFout("Alleen PDF-bestanden zijn ondersteund.");
      return;
    }
    if (file.size > 32 * 1024 * 1024) {
      setFout("Bestand is te groot (max. 32MB).");
      return;
    }
    setBestand(file);
    setResultaat(null);
    setFout("");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) verwerkBestand(file);
    },
    [verwerkBestand]
  );

  const analyseer = useCallback(async () => {
    if (!bestand) return;
    setLoading(true);
    setFout("");
    setResultaat(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(bestand);
      });

      const res = await fetch("/api/contract-analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64,
          mediaType: "application/pdf",
          bestandsnaam: bestand.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.fout ?? "Analyse mislukt");
      setResultaat(data as AnalyseResultaat);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, [bestand]);

  const reset = useCallback(() => {
    setBestand(null);
    setResultaat(null);
    setFout("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const sectieIcons: Record<string, React.ReactNode> = {
    "SAMENVATTING": <FileText className="w-4 h-4" />,
    "KERNPUNTEN": <CheckCircle className="w-4 h-4 text-blue-400" />,
    "RISICO": <ShieldAlert className="w-4 h-4 text-red-400" />,
    "VERPLICHTINGEN": <ClipboardList className="w-4 h-4 text-orange-400" />,
    "FINANCIEEL": <Euro className="w-4 h-4 text-green-400" />,
    "DEADLINES": <Calendar className="w-4 h-4 text-purple-400" />,
    "WAT TE CONTROLEREN": <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  };

  function getSectieIcon(titel: string) {
    for (const [key, icon] of Object.entries(sectieIcons)) {
      if (titel.toUpperCase().includes(key)) return icon;
    }
    return <FileText className="w-4 h-4" />;
  }

  function parseerAnalyse(tekst: string) {
    const secties: { titel: string; inhoud: string }[] = [];
    const regels = tekst.split("\n");
    let huidigeTitel = "";
    let huidigeInhoud: string[] = [];

    for (const regel of regels) {
      const kopMatch = regel.match(/^\*\*(\d+\.\s+.+?)\*\*/);
      if (kopMatch) {
        if (huidigeTitel) {
          secties.push({ titel: huidigeTitel, inhoud: huidigeInhoud.join("\n").trim() });
        }
        huidigeTitel = kopMatch[1].replace(/^\d+\.\s+/, "");
        huidigeInhoud = [];
      } else {
        huidigeInhoud.push(regel);
      }
    }
    if (huidigeTitel) {
      secties.push({ titel: huidigeTitel, inhoud: huidigeInhoud.join("\n").trim() });
    }
    return secties;
  }

  const secties = resultaat ? parseerAnalyse(resultaat.analyse) : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contract Analyzer</h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload een contract of overeenkomst — AI analyseert risico&apos;s, verplichtingen en adders.
          </p>
        </div>
        {(bestand || resultaat) && (
          <button
            onClick={reset}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Opnieuw
          </button>
        )}
      </div>

      {/* Upload zone */}
      {!resultaat && (
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragOver
              ? "border-teal-400 bg-teal-400/10"
              : bestand
              ? "border-teal-500/50 bg-teal-500/5"
              : "border-slate-600 hover:border-slate-500 bg-slate-800/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !bestand && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) verwerkBestand(f);
            }}
          />

          {bestand ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-teal-400" />
                <div className="text-left">
                  <p className="font-medium text-white">{bestand.name}</p>
                  <p className="text-sm text-slate-400">
                    {(bestand.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="ml-2 p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); void analyseer(); }}
                disabled={loading}
                className="mt-4 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-2 mx-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyseren...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    Analyseer contract
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-10 h-10 text-slate-500 mx-auto" />
              <div>
                <p className="text-white font-medium">Sleep een PDF hierheen</p>
                <p className="text-slate-400 text-sm">of klik om te uploaden</p>
              </div>
              <p className="text-xs text-slate-500">Huurovereenkomst, arbeidscontract, samenwerkingsovereenkomst, NDA... Max 32MB</p>
            </div>
          )}
        </div>
      )}

      {/* Foutmelding */}
      {fout && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{fout}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-4 py-12 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
          <div className="text-center">
            <p className="font-medium text-white">Contract wordt geanalyseerd...</p>
            <p className="text-sm mt-1">Claude leest het document en zoekt adders, risico&apos;s en verplichtingen.</p>
          </div>
        </div>
      )}

      {/* Resultaat */}
      {resultaat && secties.length > 0 && (
        <div className="space-y-4">
          {/* Bestandsnaam header */}
          <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700">
            <FileText className="w-5 h-5 text-teal-400" />
            <div>
              <p className="font-medium text-white">{bestand?.name}</p>
              <p className="text-xs text-slate-400">Analyse voltooid</p>
            </div>
          </div>

          {/* Secties */}
          {secties.map((sectie) => {
            const isRisico = sectie.titel.toUpperCase().includes("RISICO");
            const isChecklist = sectie.titel.toUpperCase().includes("CONTROLEREN");

            return (
              <div
                key={sectie.titel}
                className={`rounded-xl border p-5 ${
                  isRisico
                    ? "bg-red-950/30 border-red-500/30"
                    : isChecklist
                    ? "bg-yellow-950/30 border-yellow-500/30"
                    : "bg-slate-800 border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  {getSectieIcon(sectie.titel)}
                  <h2 className="font-semibold text-white text-sm uppercase tracking-wide">
                    {sectie.titel}
                  </h2>
                </div>
                <div
                  className="prose prose-invert prose-sm max-w-none text-slate-300 [&_strong]:text-white [&_ul]:space-y-1 [&_li]:text-slate-300"
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(sectie.inhoud) as string,
                  }}
                />
              </div>
            );
          })}

          {/* Fallback: toon raw analyse als parsing mislukt */}
          {secties.length === 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div
                className="prose prose-invert prose-sm max-w-none text-slate-300"
                dangerouslySetInnerHTML={{ __html: marked.parse(resultaat.analyse) as string }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
