"use client";

import { useState, useRef, useCallback } from "react";
import { Wand2, Link, Package, Copy, Check, Loader2, Zap } from "lucide-react";

interface Prompts {
  promptA: string;
  promptB: string;
  promptC: string;
  objectNaam: string;
  tabANaam: string;
  tabBNaam: string;
  bron: string;
}

type Tab = "A" | "B" | "C";

export default function AnimatiesPage() {
  const [input, setInput] = useState("");
  const [inputType, setInputType] = useState<"url" | "product">("product");
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<Prompts | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("A");
  const [copied, setCopied] = useState(false);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  const launchConfetti = useCallback(() => {
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#BFF549", "#00d4ff", "#a855f7", "#f472b6", "#34d399", "#fb923c"];
    const pieces = Array.from({ length: 120 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 18,
      vy: -(Math.random() * 16 + 5),
      w: Math.random() * 10 + 4,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      gravity: 0.35,
      opacity: 1,
      decay: 0.01 + Math.random() * 0.008,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of pieces) {
        if (p.opacity <= 0) continue;
        alive++;
        p.x += p.vx; p.vy += p.gravity; p.y += p.vy; p.vx *= 0.99;
        p.rotation += p.rotationSpeed; p.opacity -= p.decay;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive > 0) requestAnimationFrame(animate);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    animate();
  }, []);

  const generate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setPrompts(null);

    const body = inputType === "url" ? { url: input } : { product: input };

    const res = await fetch("/api/animaties/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json() as Prompts & { error?: string };
    setLoading(false);

    if (!res.ok || data.error) {
      setError(data.error ?? "Er ging iets mis.");
      return;
    }

    setPrompts(data);
    setActiveTab("A");
  };

  const copyPrompt = () => {
    if (!prompts) return;
    const text = activeTab === "A" ? prompts.promptA : activeTab === "B" ? prompts.promptB : prompts.promptC;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      launchConfetti();
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tabConfig = {
    A: { label: prompts?.tabANaam ?? "Assembled Shot", color: "lime" },
    B: { label: prompts?.tabBNaam ?? "Deconstructed View", color: "teal" },
    C: { label: "Video Transitie", color: "purple" },
  } as const;

  const activePrompt = prompts
    ? activeTab === "A" ? prompts.promptA : activeTab === "B" ? prompts.promptB : prompts.promptC
    : "";

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#02040a] text-white p-6 relative">
      <canvas ref={confettiRef} className="fixed inset-0 pointer-events-none z-50" />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#BFF549]/10 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-[#BFF549]" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#BFF549]">Asset Generator</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight">
          Animatie <span className="text-white/40">Prompts</span>
        </h1>
        <p className="text-sm text-white/50 mt-1">Plak een product-URL of typ een productnaam — Claude genereert 3 Higgsfield-klare prompts.</p>
      </div>

      {/* Input */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setInputType("product")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              inputType === "product"
                ? "bg-[#BFF549] text-black"
                : "bg-white/5 text-white/50 hover:text-white"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Product
          </button>
          <button
            onClick={() => setInputType("url")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              inputType === "url"
                ? "bg-[#00d4ff] text-black"
                : "bg-white/5 text-white/50 hover:text-white"
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            URL scrapen
          </button>
        </div>

        <div className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && generate()}
            placeholder={inputType === "url" ? "https://nike.com/air-max-90" : "bijv. Nike Air Max, Autronis logo, iPhone 15 Pro"}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#BFF549]/40 transition-colors"
          />
          <button
            onClick={generate}
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 px-5 py-3 bg-[#BFF549] text-black rounded-xl text-sm font-bold hover:bg-[#d4ff6b] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? "Genereren..." : "Genereer"}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Result */}
      {prompts && (
        <div className="flex-1 flex flex-col min-h-0 bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex gap-2 p-4 border-b border-white/[0.06]">
            {(["A", "B", "C"] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? tab === "A"
                      ? "bg-[#BFF549] text-black"
                      : tab === "B"
                      ? "bg-[#00d4ff] text-black"
                      : "bg-[#a855f7] text-white"
                    : "bg-white/5 text-white/50 hover:text-white"
                }`}
              >
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black ${
                  activeTab === tab ? "bg-black/20" : "bg-white/10"
                }`}>{tab}</span>
                {tabConfig[tab].label}
              </button>
            ))}

            <button
              onClick={copyPrompt}
              className={`ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                copied
                  ? "bg-[#BFF549] text-black border-[#BFF549]"
                  : "bg-transparent text-white/50 border-white/10 hover:text-white hover:border-white/20"
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Gekopieerd!" : "Copy"}
            </button>
          </div>

          {/* Bron */}
          <div className="px-5 py-2 border-b border-white/[0.04] flex items-center gap-2">
            <span className="text-xs text-white/30 uppercase tracking-widest font-bold">Bron</span>
            <span className="text-xs text-white/40 truncate">{prompts.bron}</span>
          </div>

          {/* Prompt tekst */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            <pre className="font-mono text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
              {activePrompt}
            </pre>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!prompts && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <Wand2 className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/30 text-sm">Voer een product of URL in om te beginnen</p>
          </div>
        </div>
      )}
    </div>
  );
}
