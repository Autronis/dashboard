"use client";

import { useState, useRef, useCallback } from "react";
import { Wand2, Link, Package, Copy, Check, Zap, ExternalLink, Image, Clapperboard, Layers, Upload, X, RotateCcw, Globe, Code2, ChevronDown, ChevronUp, Play, Loader2 } from "lucide-react";

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
type Mode = "scroll-stop" | "logo-animatie";


export default function AnimatiesPage() {
  const [mode, setMode] = useState<Mode>("scroll-stop");
  const [input, setInput] = useState("");
  const [inputType, setInputType] = useState<"url" | "product" | "image">("product");
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<Prompts | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("A");
  const [copied, setCopied] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null);
  const [logoInput, setLogoInput] = useState(
    "Autronis butterfly logo sculpture: black matte gear body, translucent glass wings with silver circuit traces and nodes, teal (#23C6B7) ring, white orb center, two black curved antennae.\n\nAnimatie: begint als exploded view met alle losse onderdelen zwevend → onderdelen komen logisch en clean samen → logo kantelt rechtop → vleugels flappen zachtjes."
  );
  const [logoImage, setLogoImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [kieStartFrame, setKieStartFrame] = useState("");
  const [kieEndFrame, setKieEndFrame] = useState("");
  const [kieDuration, setKieDuration] = useState(5);
  const [kieLoading, setKieLoading] = useState(false);
  const [kieVideoUrl, setKieVideoUrl] = useState<string | null>(null);
  const [kieError, setKieError] = useState("");
  const kiePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [kieImgLoading, setKieImgLoading] = useState<Record<"A" | "B", boolean>>({ A: false, B: false });
  const [kieImgUrl, setKieImgUrl] = useState<Record<"A" | "B", string | null>>({ A: null, B: null });
  const [kieImgError, setKieImgError] = useState<Record<"A" | "B", string>>({ A: "", B: "" });
  const kieImgPollingRef = useRef<Record<"A" | "B", ReturnType<typeof setInterval> | null>>({ A: null, B: null });
  const [productRefImage, setProductRefImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const productRefInputRef = useRef<HTMLInputElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const launchConfetti = useCallback(() => {
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#23C6B7", "#4DD9CC", "#22C55E", "#F97316", "#E2E8F0"];
    const pieces = Array.from({ length: 120 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 18, vy: -(Math.random() * 16 + 5),
      w: Math.random() * 10 + 4, h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 12,
      gravity: 0.35, opacity: 1, decay: 0.01 + Math.random() * 0.008,
    }));
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of pieces) {
        if (p.opacity <= 0) continue;
        alive++;
        p.x += p.vx; p.vy += p.gravity; p.y += p.vy; p.vx *= 0.99;
        p.rotation += p.rotationSpeed; p.opacity -= p.decay;
        ctx.save(); ctx.translate(p.x, p.y);
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

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setUploadedImage({ base64: result.split(",")[1], mediaType: file.type, preview: result });
    };
    reader.readAsDataURL(file);
  };

  const stopGenerate = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const generate = async () => {
    if (inputType === "image" && !uploadedImage) return;
    if (inputType !== "image" && !input.trim()) return;
    abortRef.current = new AbortController();
    setLoading(true); setError(""); setPrompts(null);

    let body: Record<string, string> = {};
    if (inputType === "url") body = { url: input };
    else if (inputType === "product") {
      body = { product: input };
      if (productRefImage) { body.imageBase64 = productRefImage.base64; body.mediaType = productRefImage.mediaType; }
    }
    else if (inputType === "image" && uploadedImage) body = { imageBase64: uploadedImage.base64, mediaType: uploadedImage.mediaType };

    try {
      const res = await fetch("/api/animaties/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });
      const data = await res.json() as Prompts & { error?: string };
      setLoading(false);
      if (!res.ok || data.error) { setError(data.error ?? "Er ging iets mis."); return; }
      setPrompts(data); setActiveTab("A");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setLoading(false);
      setError("Er ging iets mis.");
    }
  };

  const generateKieVideo = async () => {
    if (!prompts) return;
    setKieLoading(true); setKieError(""); setKieVideoUrl(null);
    try {
      const res = await fetch("/api/animaties/kie-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompts.promptC,
          duration: kieDuration,
          ...(kieStartFrame.trim() && { firstFrameImage: kieStartFrame.trim() }),
          ...(kieEndFrame.trim() && { lastFrameImage: kieEndFrame.trim() }),
        }),
      });
      const data = await res.json() as { taskId?: string; error?: string };
      if (!res.ok || data.error) { setKieError(data.error ?? "Fout."); setKieLoading(false); return; }
      // Poll for result
      kiePollingRef.current = setInterval(async () => {
        const poll = await fetch(`/api/animaties/kie-video-status?taskId=${data.taskId}`);
        const result = await poll.json() as { status: string; videoUrl?: string; error?: string };
        if (result.status === "done" && result.videoUrl) {
          clearInterval(kiePollingRef.current!);
          setKieVideoUrl(result.videoUrl);
          setKieLoading(false);
        } else if (result.status === "failed") {
          clearInterval(kiePollingRef.current!);
          setKieError(result.error ?? "Generatie mislukt.");
          setKieLoading(false);
        }
      }, 4000);
    } catch {
      setKieError("Er ging iets mis."); setKieLoading(false);
    }
  };

  const generateKieImage = async (tab: "A" | "B") => {
    if (!prompts) return;
    const prompt = tab === "A" ? prompts.promptA : prompts.promptB;
    setKieImgLoading(prev => ({ ...prev, [tab]: true }));
    setKieImgError(prev => ({ ...prev, [tab]: "" }));
    setKieImgUrl(prev => ({ ...prev, [tab]: null }));
    try {
      const res = await fetch("/api/animaties/kie-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json() as { taskId?: string; error?: string };
      if (!res.ok || data.error) {
        setKieImgError(prev => ({ ...prev, [tab]: data.error ?? "Fout." }));
        setKieImgLoading(prev => ({ ...prev, [tab]: false }));
        return;
      }
      kieImgPollingRef.current[tab] = setInterval(async () => {
        const poll = await fetch(`/api/animaties/kie-image-status?taskId=${data.taskId}`);
        const result = await poll.json() as { status: string; imageUrl?: string; error?: string };
        if (result.status === "done" && result.imageUrl) {
          clearInterval(kieImgPollingRef.current[tab]!);
          setKieImgUrl(prev => ({ ...prev, [tab]: result.imageUrl! }));
          setKieImgLoading(prev => ({ ...prev, [tab]: false }));
        } else if (result.status === "failed") {
          clearInterval(kieImgPollingRef.current[tab]!);
          setKieImgError(prev => ({ ...prev, [tab]: result.error ?? "Generatie mislukt." }));
          setKieImgLoading(prev => ({ ...prev, [tab]: false }));
        }
      }, 4000);
    } catch {
      setKieImgError(prev => ({ ...prev, [tab]: "Er ging iets mis." }));
      setKieImgLoading(prev => ({ ...prev, [tab]: false }));
    }
  };

  const generateLogo = async () => {
    if (!logoInput.trim() && !logoImage) return;
    abortRef.current = new AbortController();
    setLoading(true); setError(""); setPrompts(null);
    const body: Record<string, string> = logoImage
      ? { imageBase64: logoImage.base64, mediaType: logoImage.mediaType, description: logoInput }
      : { description: logoInput };
    try {
      const res = await fetch("/api/animaties/generate-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });
      const data = await res.json() as Prompts & { error?: string };
      setLoading(false);
      if (!res.ok || data.error) { setError(data.error ?? "Er ging iets mis."); return; }
      setPrompts(data); setActiveTab("A");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setLoading(false);
      setError("Er ging iets mis.");
    }
  };

  const copyPrompt = (openHiggsfield = false) => {
    if (!prompts) return;
    const text = activeTab === "A" ? prompts.promptA : activeTab === "B" ? prompts.promptB : prompts.promptC;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); launchConfetti();
      setTimeout(() => setCopied(false), 2000);
      if (openHiggsfield) window.open("https://higgsfield.ai", "_blank");
    });
  };

  const tabConfig = {
    A: { label: prompts?.tabANaam ?? "Assembled Shot", icon: Image, instruction: "Plak in Higgsfield → genereer afbeelding (16:9)" },
    B: { label: prompts?.tabBNaam ?? "Deconstructed View", icon: Layers, instruction: "Upload afbeelding A als referentie → genereer afbeelding (16:9)" },
    C: { label: "Video Transitie", icon: Clapperboard, instruction: "Upload A als start frame + B als end frame → genereer video (5s)" },
  } as const;

  const activePrompt = prompts
    ? activeTab === "A" ? prompts.promptA : activeTab === "B" ? prompts.promptB : prompts.promptC
    : "";

  const allSteps = [
    { n: "1", icon: Image, label: "Copy A → Higgsfield", sub: "Genereer assembled shot (afbeelding)" },
    { n: "2", icon: Layers, label: "Copy B → Higgsfield", sub: "Upload A als referentie → genereer exploded view" },
    { n: "3", icon: Clapperboard, label: "Copy C → Higgsfield", sub: "Upload A + B als frames → genereer video (5s)" },
    { n: "4", icon: Globe, label: "Download video", sub: "Sla de video op van Higgsfield" },
    { n: "5", icon: Code2, label: "VSCode → scroll-stop build", sub: "Zeg in Claude Code: \"scroll-stop build\" + geef het videobestand" },
    { n: "6", icon: Globe, label: "Website live", sub: "Skill bouwt automatisch de Apple-stijl scroll-website" },
  ];

  return (
    <div className="flex flex-col h-full min-h-screen p-6 relative bg-autronis-bg text-autronis-text-primary">
      <canvas ref={confettiRef} className="fixed inset-0 pointer-events-none z-50" />

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-autronis-accent/10 flex items-center justify-center">
            <Wand2 className="w-3.5 h-3.5 text-autronis-accent" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-autronis-accent">Asset Generator</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight">
          Animatie <span className="text-autronis-text-secondary">Prompts</span>
        </h1>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setMode("scroll-stop")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "scroll-stop" ? "bg-autronis-accent text-white" : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
          }`}
        >
          <Clapperboard className="w-4 h-4" /> Scroll-Stop (3 prompts)
        </button>
        <button
          onClick={() => setMode("logo-animatie")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "logo-animatie" ? "bg-autronis-accent text-white" : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
          }`}
        >
          <RotateCcw className="w-4 h-4" /> Logo Animatie
        </button>
      </div>

      {/* Stappenplan (collapsible) */}
      <div className="bg-autronis-card border border-autronis-border rounded-xl mb-5 overflow-hidden">
        <button
          onClick={() => setStepsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-autronis-text-primary hover:bg-autronis-card-hover transition-all"
        >
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-autronis-accent" />
            Volledig stappenplan — van prompt tot website
          </span>
          {stepsOpen ? <ChevronUp className="w-4 h-4 text-autronis-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-autronis-text-tertiary" />}
        </button>
        {stepsOpen && (
          <div className="px-4 pb-4 grid grid-cols-3 gap-3 border-t border-autronis-border pt-3">
            {allSteps.map(({ n, icon: Icon, label, sub }) => (
              <div key={n} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-md bg-autronis-accent/10 flex items-center justify-center flex-shrink-0 text-xs font-black text-autronis-accent">{n}</div>
                <div>
                  <p className="text-xs font-semibold text-autronis-text-primary flex items-center gap-1">
                    <Icon className="w-3 h-3 text-autronis-accent" /> {label}
                  </p>
                  <p className="text-xs text-autronis-text-tertiary mt-0.5 leading-snug">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LOGO ANIMATIE MODE */}
      {mode === "logo-animatie" && (
        <>
          <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 mb-5">
            {/* Description textarea */}
            <textarea
              value={logoInput}
              onChange={e => setLogoInput(e.target.value)}
              rows={4}
              placeholder="Beschrijf je logo en wat de animatie moet doen..."
              className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 transition-colors resize-none mb-3"
            />
            {/* Optional image reference + generate */}
            <div className="flex gap-3 items-center">
              <input ref={logoFileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { const res = ev.target?.result as string; setLogoImage({ base64: res.split(",")[1], mediaType: f.type, preview: res }); }; r.readAsDataURL(f); }} />
              {logoImage ? (
                <div className="flex items-center gap-2 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2">
                  <img src={logoImage.preview} alt="ref" className="w-7 h-7 object-contain rounded" />
                  <span className="text-xs text-autronis-text-secondary">Referentie</span>
                  <button onClick={() => setLogoImage(null)} className="text-autronis-text-tertiary hover:text-autronis-text-primary ml-1"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button onClick={() => logoFileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-autronis-bg border border-dashed border-autronis-border rounded-lg text-xs text-autronis-text-tertiary hover:border-autronis-accent/50 hover:text-autronis-accent transition-all">
                  <Upload className="w-3.5 h-3.5" /> Referentie afbeelding (optioneel)
                </button>
              )}
              <div className="ml-auto flex gap-2">
                {loading ? (
                  <button onClick={stopGenerate} className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-all">
                    <X className="w-4 h-4" /> Stop
                  </button>
                ) : (
                  <button onClick={generateLogo} disabled={!logoInput.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-white rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    <Zap className="w-4 h-4" /> Genereer prompts
                  </button>
                )}
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">{error}</p>}
          </div>

          {prompts && (
            <div className="flex-1 flex flex-col min-h-0 bg-autronis-card border border-autronis-border rounded-xl overflow-hidden">
              <div className="flex gap-2 p-3 border-b border-autronis-border flex-wrap">
                {(["A", "B", "C"] as Tab[]).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? "bg-autronis-accent text-white" : "bg-autronis-bg text-autronis-text-secondary hover:text-autronis-text-primary border border-autronis-border"}`}
                  >
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-black ${activeTab === tab ? "bg-white/20" : "bg-autronis-border"}`}>{tab}</span>
                    {tabConfig[tab].label}
                  </button>
                ))}
                <div className="ml-auto flex gap-2">
                  <button onClick={() => copyPrompt(false)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${copied ? "bg-autronis-accent text-white border-autronis-accent" : "bg-autronis-bg text-autronis-text-secondary border-autronis-border hover:text-autronis-text-primary"}`}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Gekopieerd!" : "Copy"}
                  </button>
                  <button onClick={() => copyPrompt(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-autronis-accent/10 text-autronis-accent border border-autronis-accent/20 hover:bg-autronis-accent hover:text-white transition-all">
                    <ExternalLink className="w-4 h-4" /> Copy + Open Higgsfield
                  </button>
                </div>
              </div>
              <div className="px-4 py-2 border-b border-autronis-border flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-autronis-accent/10 text-autronis-accent">Stap {activeTab === "A" ? "1" : activeTab === "B" ? "2" : "3"}</span>
                <span className="text-xs text-autronis-text-tertiary">{tabConfig[activeTab].instruction}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <pre className="font-mono text-sm text-autronis-text-secondary whitespace-pre-wrap leading-relaxed">{activePrompt}</pre>
              </div>
              {(activeTab === "A" || activeTab === "B") && (
                <div className="border-t border-autronis-border p-4 bg-autronis-bg/40">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-autronis-text-primary flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5 text-autronis-accent" /> Genereer afbeelding via Kie.ai (Nano Banana 2)
                    </p>
                    <button onClick={() => generateKieImage(activeTab)} disabled={kieImgLoading[activeTab]}
                      className="flex items-center gap-2 px-3 py-1.5 bg-autronis-accent text-white rounded-lg text-xs font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {kieImgLoading[activeTab] ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Genereren...</> : <><Zap className="w-3.5 h-3.5" /> Genereer</>}
                    </button>
                  </div>
                  {kieImgError[activeTab] && <p className="text-xs text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">{kieImgError[activeTab]}</p>}
                  {kieImgUrl[activeTab] && (
                    <div className="mt-2">
                      <img src={kieImgUrl[activeTab]!} alt="gegenereerde afbeelding" className="w-full rounded-lg border border-autronis-border" />
                      <a href={kieImgUrl[activeTab]!} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-center gap-1.5 text-xs text-autronis-accent hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" /> Open afbeelding
                      </a>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "C" && (
                <div className="border-t border-autronis-border p-4 bg-autronis-bg/40">
                  <p className="text-xs font-semibold text-autronis-text-primary mb-3 flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-autronis-accent" /> Genereer video via Kie.ai
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input value={kieStartFrame} onChange={e => setKieStartFrame(e.target.value)}
                      placeholder="Start frame URL (afbeelding A)"
                      className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                    <input value={kieEndFrame} onChange={e => setKieEndFrame(e.target.value)}
                      placeholder="End frame URL (afbeelding B)"
                      className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[5, 8, 10].map(d => (
                        <button key={d} onClick={() => setKieDuration(d)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${kieDuration === d ? "bg-autronis-accent text-white" : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"}`}>
                          {d}s
                        </button>
                      ))}
                    </div>
                    <button onClick={generateKieVideo} disabled={kieLoading}
                      className="ml-auto flex items-center gap-2 px-4 py-2 bg-autronis-accent text-white rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {kieLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Genereren...</> : <><Zap className="w-4 h-4" /> Genereer video</>}
                    </button>
                  </div>
                  {kieError && <p className="mt-2 text-xs text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">{kieError}</p>}
                  {kieVideoUrl && (
                    <div className="mt-3">
                      <video src={kieVideoUrl} controls className="w-full rounded-lg border border-autronis-border" />
                      <a href={kieVideoUrl} download className="mt-2 flex items-center gap-1.5 text-xs text-autronis-accent hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" /> Download video
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!prompts && !loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-xl bg-autronis-card border border-autronis-border flex items-center justify-center mx-auto mb-3">
                  <RotateCcw className="w-6 h-6 text-autronis-text-tertiary" />
                </div>
                <p className="text-autronis-text-tertiary text-sm">Beschrijf wat je wilt en klik Genereer</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* SCROLL-STOP MODE */}
      {mode === "scroll-stop" && (
        <>
          {/* Input */}
          <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 mb-5">
            <div className="flex gap-2 mb-3">
              {(["product", "url", "image"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setInputType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    inputType === type
                      ? "bg-autronis-accent text-white"
                      : "bg-autronis-bg text-autronis-text-secondary hover:text-autronis-text-primary border border-autronis-border"
                  }`}
                >
                  {type === "product" && <><Package className="w-3.5 h-3.5" /> Product</>}
                  {type === "url" && <><Link className="w-3.5 h-3.5" /> URL scrapen</>}
                  {type === "image" && <><Upload className="w-3.5 h-3.5" /> Afbeelding</>}
                </button>
              ))}
            </div>

            {inputType === "image" ? (
              <div className="flex gap-3 items-start">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                {uploadedImage ? (
                  <div className="flex-1 flex items-center gap-3 bg-autronis-bg border border-autronis-border rounded-lg px-4 py-2.5">
                    <img src={uploadedImage.preview} alt="upload" className="w-10 h-10 object-contain rounded" />
                    <span className="text-sm text-autronis-text-primary flex-1">Afbeelding geladen</span>
                    <button onClick={() => setUploadedImage(null)} className="text-autronis-text-tertiary hover:text-autronis-text-primary">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center gap-2 py-6 bg-autronis-bg border border-dashed border-autronis-border rounded-lg text-autronis-text-tertiary hover:border-autronis-accent/50 hover:text-autronis-accent transition-all"
                  >
                    <Upload className="w-6 h-6" />
                    <span className="text-sm">Klik om een afbeelding te uploaden</span>
                    <span className="text-xs opacity-60">PNG, JPG, WEBP</span>
                  </button>
                )}
                {loading ? (
                  <button
                    onClick={stopGenerate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-all"
                  >
                    <X className="w-4 h-4" /> Stop
                  </button>
                ) : (
                  <button
                    onClick={generate}
                    disabled={!uploadedImage}
                    className="flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-white rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Zap className="w-4 h-4" /> Genereer
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-3">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !loading && generate()}
                    placeholder={inputType === "url" ? "https://nike.com/air-max-90" : "bijv. Nike Air Max, Autronis logo, iPhone 15 Pro"}
                    className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-4 py-2.5 text-sm placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 transition-colors text-autronis-text-primary"
                  />
                  {loading ? (
                    <button
                      onClick={stopGenerate}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-all"
                    >
                      <X className="w-4 h-4" /> Stop
                    </button>
                  ) : (
                    <button
                      onClick={generate}
                      disabled={!input.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-white rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Zap className="w-4 h-4" /> Genereer
                    </button>
                  )}
                </div>
                {inputType === "product" && (
                  <div className="flex items-center gap-2">
                    <input ref={productRefInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { const res = ev.target?.result as string; setProductRefImage({ base64: res.split(",")[1], mediaType: f.type, preview: res }); }; r.readAsDataURL(f); }} />
                    {productRefImage ? (
                      <div className="flex items-center gap-2 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-1.5">
                        <img src={productRefImage.preview} alt="ref" className="w-6 h-6 object-contain rounded" />
                        <span className="text-xs text-autronis-text-secondary">Referentie afbeelding</span>
                        <button onClick={() => setProductRefImage(null)} className="text-autronis-text-tertiary hover:text-autronis-text-primary ml-1"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => productRefInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-autronis-bg border border-dashed border-autronis-border rounded-lg text-xs text-autronis-text-tertiary hover:border-autronis-accent/50 hover:text-autronis-accent transition-all">
                        <Upload className="w-3.5 h-3.5" /> Referentie afbeelding toevoegen (optioneel)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {error && (
              <p className="mt-3 text-sm text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Result */}
          {prompts && (
            <div className="flex-1 flex flex-col min-h-0 bg-autronis-card border border-autronis-border rounded-xl overflow-hidden">
              <div className="flex gap-2 p-3 border-b border-autronis-border flex-wrap">
                {(["A", "B", "C"] as Tab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      activeTab === tab
                        ? "bg-autronis-accent text-white"
                        : "bg-autronis-bg text-autronis-text-secondary hover:text-autronis-text-primary border border-autronis-border"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-black ${activeTab === tab ? "bg-white/20" : "bg-autronis-border"}`}>{tab}</span>
                    {tabConfig[tab].label}
                  </button>
                ))}
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => copyPrompt(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
                      copied ? "bg-autronis-accent text-white border-autronis-accent" : "bg-autronis-bg text-autronis-text-secondary border-autronis-border hover:text-autronis-text-primary"
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Gekopieerd!" : "Copy"}
                  </button>
                  <button
                    onClick={() => copyPrompt(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-autronis-accent/10 text-autronis-accent border border-autronis-accent/20 hover:bg-autronis-accent hover:text-white transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Copy + Open Higgsfield
                  </button>
                </div>
              </div>
              <div className="px-4 py-2 border-b border-autronis-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-autronis-accent/10 text-autronis-accent">
                    Stap {activeTab === "A" ? "1" : activeTab === "B" ? "2" : "3"}
                  </span>
                  <span className="text-xs text-autronis-text-tertiary">{tabConfig[activeTab].instruction}</span>
                </div>
                <span className="text-xs text-autronis-text-tertiary truncate max-w-[200px]">{prompts.bron}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <pre className="font-mono text-sm text-autronis-text-secondary whitespace-pre-wrap leading-relaxed">{activePrompt}</pre>
              </div>
              {/* Kie.ai image generator — Tab A and B */}
              {(activeTab === "A" || activeTab === "B") && (
                <div className="border-t border-autronis-border p-4 bg-autronis-bg/40">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-autronis-text-primary flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5 text-autronis-accent" /> Genereer afbeelding via Kie.ai (Nano Banana 2)
                    </p>
                    <button onClick={() => generateKieImage(activeTab)} disabled={kieImgLoading[activeTab]}
                      className="flex items-center gap-2 px-3 py-1.5 bg-autronis-accent text-white rounded-lg text-xs font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {kieImgLoading[activeTab] ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Genereren...</> : <><Zap className="w-3.5 h-3.5" /> Genereer</>}
                    </button>
                  </div>
                  {kieImgError[activeTab] && <p className="text-xs text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">{kieImgError[activeTab]}</p>}
                  {kieImgUrl[activeTab] && (
                    <div className="mt-2">
                      <img src={kieImgUrl[activeTab]!} alt="gegenereerde afbeelding" className="w-full rounded-lg border border-autronis-border" />
                      <a href={kieImgUrl[activeTab]!} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-center gap-1.5 text-xs text-autronis-accent hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" /> Open afbeelding
                      </a>
                    </div>
                  )}
                </div>
              )}
              {/* Kie.ai video generator — only on Tab C */}
              {activeTab === "C" && (
                <div className="border-t border-autronis-border p-4 bg-autronis-bg/40">
                  <p className="text-xs font-semibold text-autronis-text-primary mb-3 flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-autronis-accent" /> Genereer video via Kie.ai
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input value={kieStartFrame} onChange={e => setKieStartFrame(e.target.value)}
                      placeholder="Start frame URL (afbeelding A)"
                      className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                    <input value={kieEndFrame} onChange={e => setKieEndFrame(e.target.value)}
                      placeholder="End frame URL (afbeelding B)"
                      className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[5, 8, 10].map(d => (
                        <button key={d} onClick={() => setKieDuration(d)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${kieDuration === d ? "bg-autronis-accent text-white" : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"}`}>
                          {d}s
                        </button>
                      ))}
                    </div>
                    <button onClick={generateKieVideo} disabled={kieLoading}
                      className="ml-auto flex items-center gap-2 px-4 py-2 bg-autronis-accent text-white rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {kieLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Genereren...</> : <><Zap className="w-4 h-4" /> Genereer video</>}
                    </button>
                  </div>
                  {kieError && <p className="mt-2 text-xs text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">{kieError}</p>}
                  {kieVideoUrl && (
                    <div className="mt-3">
                      <video src={kieVideoUrl} controls className="w-full rounded-lg border border-autronis-border" />
                      <a href={kieVideoUrl} download className="mt-2 flex items-center gap-1.5 text-xs text-autronis-accent hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" /> Download video
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!prompts && !loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-xl bg-autronis-card border border-autronis-border flex items-center justify-center mx-auto mb-3">
                  <Wand2 className="w-6 h-6 text-autronis-text-tertiary" />
                </div>
                <p className="text-autronis-text-tertiary text-sm">Voer een product of URL in om te beginnen</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
