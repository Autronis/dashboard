"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Video, Send, Loader2, Play, Download, RotateCcw, Sparkles,
  Upload, X, Film, ChevronDown, Zap, MessageSquare, Code,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";

interface ChatBericht {
  rol: "gebruiker" | "ai";
  tekst: string;
  script?: { scenes: Scene[] } | null;
}

interface Scene {
  tekst: string[];
  accentRegel?: number;
  accentKleur?: "turquoise" | "geel";
  icon?: string;
  duur?: number;
  isCta?: boolean;
}

type VideoFormaat = "square" | "reels" | "feed" | "youtube";

const FORMAAT_LABELS: Record<VideoFormaat, string> = {
  square: "Instagram (1:1)",
  reels: "Reels (9:16)",
  feed: "Feed (4:5)",
  youtube: "YouTube (16:9)",
};

export default function VideoStudioPage() {
  const { addToast } = useToast();
  const [berichten, setBerichten] = useState<ChatBericht[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState<{ scenes: Scene[] } | null>(null);
  const [formaat, setFormaat] = useState<VideoFormaat>("square");
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showScript, setShowScript] = useState(false);
  const [referentieVideos, setReferentieVideos] = useState<string[]>([]);
  const [refImage, setRefImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null);
  const [gallery, setGallery] = useState<{ id: number; afbeeldingUrl: string | null; productNaam: string }[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Load gallery items
  useEffect(() => {
    fetch("/api/assets/gallery").then(r => r.json()).then((d: { items: typeof gallery }) => {
      setGallery((d.items ?? []).filter(g => g.afbeeldingUrl && !g.afbeeldingUrl.includes("video")));
    }).catch(() => {});
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const sendMessage = async (tekst?: string) => {
    const bericht = tekst ?? input.trim();
    if (!bericht || loading) return;
    setInput("");
    const berichtTekst = refImage ? `${bericht} [afbeelding bijgevoegd als referentie]` : bericht;
    setBerichten(prev => [...prev, { rol: "gebruiker", tekst: berichtTekst }]);
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/content/videos/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bericht,
          geschiedenis: berichten,
          referentieVideos,
          huidigeScript: script,
          ...(refImage && { imageBase64: refImage.base64, mediaType: refImage.mediaType }),
        }),
      });
      // Clear image after sending
      setRefImage(null);
      const data = await res.json() as { antwoord?: string; script?: { scenes: Scene[] }; fout?: string };
      if (data.antwoord) {
        const nieuwBericht: ChatBericht = { rol: "ai", tekst: data.antwoord, script: data.script };
        setBerichten(prev => [...prev, nieuwBericht]);
        if (data.script?.scenes) {
          setScript(data.script);
          setVideoUrl(null);
        }
      }
    } catch {
      addToast("Er ging iets mis", "fout");
    }
    setLoading(false);
    scrollToBottom();
  };

  const renderVideo = async () => {
    if (!script) return;
    setRendering(true);
    setVideoUrl(null);

    try {
      // First save as content video
      const saveRes = await fetch("/api/content/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel: script.scenes[0]?.tekst?.[0] ?? "Video Studio",
          script: JSON.stringify(script),
          formaat,
        }),
      });
      const saveData = await saveRes.json() as { video?: { id: number } };
      if (!saveData.video?.id) { addToast("Opslaan mislukt", "fout"); setRendering(false); return; }

      // Then render
      const renderRes = await fetch(`/api/content/videos/${saveData.video.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formaat }),
      });
      const renderData = await renderRes.json() as { videoPath?: string; fout?: string };
      if (renderData.videoPath) {
        setVideoUrl(renderData.videoPath);
        addToast("Video gerenderd!", "succes");
      } else {
        addToast(renderData.fout ?? "Rendering mislukt", "fout");
      }
    } catch {
      addToast("Rendering mislukt", "fout");
    }
    setRendering(false);
  };

  // Scene preview
  const totalDuur = script?.scenes.reduce((s, sc) => s + (sc.duur ?? 3), 0) ?? 0;

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-2">
              <Film className="w-6 h-6 text-autronis-accent" /> Video Studio
            </h1>
            <p className="text-sm text-autronis-text-secondary mt-1">
              Spar met AI over je video concept → genereer script → render met Remotion
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Remotion Studio link */}
            <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-xs font-medium text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30 transition-all">
              <Code className="w-3.5 h-3.5" /> Remotion Studio
            </a>
            {script && (
              <>
                <select value={formaat} onChange={e => setFormaat(e.target.value as VideoFormaat)}
                  className="bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2 text-sm text-autronis-text-primary focus:outline-none">
                  {Object.entries(FORMAAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button onClick={renderVideo} disabled={rendering}
                  className="flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-white rounded-xl text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-50">
                  {rendering ? <><Loader2 className="w-4 h-4 animate-spin" /> Renderen...</> : <><Play className="w-4 h-4" /> Render video</>}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Chat panel — left side */}
          <div className="lg:col-span-3 bg-autronis-card border border-autronis-border rounded-2xl flex flex-col" style={{ minHeight: "70vh" }}>
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {berichten.length === 0 && (
                <div className="text-center py-16">
                  <MessageSquare className="w-10 h-10 text-autronis-text-tertiary mx-auto mb-3" />
                  <p className="text-sm text-autronis-text-secondary">Beschrijf je video idee of kies een starter</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {[
                      "Maak een video over waarom bedrijven automatisering nodig hebben",
                      "Video: 5 tekenen dat je processen moet automatiseren",
                      "Scroll-stop video over AI voor MKB",
                      "Before/after video van handmatig vs geautomatiseerd werk",
                    ].map(q => (
                      <button key={q} onClick={() => sendMessage(q)}
                        className="text-xs px-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-tertiary hover:text-autronis-accent hover:border-autronis-accent/30 transition-all text-left max-w-[250px]">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {berichten.map((b, i) => (
                <div key={i} className={cn("text-sm rounded-xl p-3", b.rol === "gebruiker" ? "bg-autronis-accent/10 text-autronis-text-primary ml-12" : "bg-autronis-bg text-autronis-text-secondary mr-6")}>
                  <span className="text-[10px] font-medium block mb-1 opacity-40">{b.rol === "gebruiker" ? "Jij" : "AI Studio"}</span>
                  <div className="whitespace-pre-wrap">{b.tekst.replace(/```json[\s\S]*?```/g, "").trim()}</div>
                  {b.script && (
                    <div className="mt-2 p-2 bg-autronis-accent/5 border border-autronis-accent/20 rounded-lg">
                      <p className="text-[10px] font-medium text-autronis-accent mb-1">Script gegenereerd — {b.script.scenes.length} scenes</p>
                      <button onClick={() => { setScript(b.script!); setShowScript(true); setVideoUrl(null); }}
                        className="text-[10px] text-autronis-accent hover:underline">
                        Bekijk & bewerk script →
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-sm text-autronis-accent p-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> Nadenken...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Referentie uploads */}
            {referentieVideos.length > 0 && (
              <div className="px-4 py-2 border-t border-autronis-border flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-autronis-text-tertiary">Referenties:</span>
                {referentieVideos.map((v, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded flex items-center gap-1">
                    <Video className="w-2.5 h-2.5" /> {v.split("/").pop()?.slice(0, 20)}
                    <button onClick={() => setReferentieVideos(prev => prev.filter((_, j) => j !== i))}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Image ref preview */}
            {refImage && (
              <div className="px-3 py-2 border-t border-autronis-border flex items-center gap-2">
                <img src={refImage.preview} alt="ref" className="w-10 h-10 object-contain rounded-lg border border-autronis-accent/30" />
                <span className="text-[10px] text-autronis-accent">Afbeelding als referentie</span>
                <button onClick={() => setRefImage(null)} className="text-autronis-text-tertiary hover:text-red-400 ml-auto">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Gallery picker */}
            {showGallery && (
              <div className="px-3 py-2 border-t border-autronis-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-autronis-text-secondary">Kies uit galerij</span>
                  <button onClick={() => setShowGallery(false)} className="text-autronis-text-tertiary hover:text-autronis-text-primary">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {gallery.slice(0, 20).map(g => (
                    <button key={g.id} onClick={async () => {
                      // Fetch image and convert to base64
                      try {
                        const imgRes = await fetch(g.afbeeldingUrl!);
                        if (!imgRes.ok) return;
                        const blob = await imgRes.blob();
                        const reader = new FileReader();
                        reader.onload = () => {
                          const dataUrl = reader.result as string;
                          setRefImage({ base64: dataUrl.split(",")[1], mediaType: blob.type || "image/png", preview: g.afbeeldingUrl! });
                          setShowGallery(false);
                        };
                        reader.readAsDataURL(blob);
                      } catch { /* ignore */ }
                    }}
                      className="shrink-0 w-14 h-14 rounded-lg border border-autronis-border hover:border-autronis-accent overflow-hidden transition-all">
                      <img src={g.afbeeldingUrl!} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-autronis-border">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder={refImage ? "Beschrijf wat je wilt met deze afbeelding als stijl..." : "Beschrijf je video idee of geef feedback..."}
                  className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50"
                />
                {/* Image upload */}
                <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const result = ev.target?.result as string;
                      setRefImage({ base64: result.split(",")[1], mediaType: file.type, preview: result });
                    };
                    reader.readAsDataURL(file);
                  }} />
                <button onClick={() => setShowGallery(v => !v)}
                  className={cn("p-2.5 bg-autronis-bg border rounded-xl transition-all", showGallery ? "border-autronis-accent text-autronis-accent" : "border-autronis-border text-autronis-text-tertiary hover:text-autronis-accent hover:border-autronis-accent/30")}
                  title="Kies afbeelding uit galerij">
                  <Film className="w-4 h-4" />
                </button>
                <button onClick={() => imgInputRef.current?.click()}
                  className="p-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-tertiary hover:text-purple-400 hover:border-purple-500/30 transition-all"
                  title="Upload afbeelding als referentie">
                  <Upload className="w-4 h-4" />
                </button>
                {/* Video ref upload */}
                <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setReferentieVideos(prev => [...prev, file.name]);
                  }} />
                <button onClick={() => sendMessage()} disabled={(!input.trim() && !refImage) || loading}
                  className="p-2.5 bg-autronis-accent text-white rounded-xl hover:bg-autronis-accent-hover transition-all disabled:opacity-40">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Preview panel — right side */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video result */}
            {videoUrl && (
              <div className="bg-autronis-card border border-green-500/30 rounded-2xl p-4">
                <p className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-1.5">
                  <Play className="w-4 h-4" /> Video klaar
                </p>
                <video src={videoUrl} controls className="w-full rounded-xl" />
                <div className="flex items-center gap-3 mt-2">
                  <a href={videoUrl} download className="flex items-center gap-1.5 text-xs text-autronis-accent hover:underline">
                    <Download className="w-3.5 h-3.5" /> Download MP4
                  </a>
                  <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-autronis-text-tertiary hover:text-autronis-accent">
                    <Code className="w-3.5 h-3.5" /> Open in Remotion Studio
                  </a>
                </div>
              </div>
            )}

            {/* Script preview */}
            {script && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-autronis-text-primary flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-autronis-accent" /> Script Preview
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-autronis-text-tertiary">{script.scenes.length} scenes · {totalDuur}s</span>
                    <button onClick={() => setShowScript(v => !v)} className="text-[10px] text-autronis-accent hover:underline">
                      {showScript ? "Verberg" : "Toon"} JSON
                    </button>
                  </div>
                </div>

                {/* Scene cards */}
                <div className="space-y-2">
                  {script.scenes.map((scene, i) => (
                    <div key={i} className={cn(
                      "border rounded-xl p-3 text-xs",
                      scene.isCta ? "border-autronis-accent/30 bg-autronis-accent/5" : "border-autronis-border bg-autronis-bg"
                    )}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-medium text-autronis-text-tertiary">
                          Scene {i + 1} {scene.isCta && "· CTA"} · {scene.duur ?? 3}s
                        </span>
                        {scene.icon && <span className="text-[10px] text-autronis-accent">{scene.icon}</span>}
                      </div>
                      {scene.tekst.map((line, j) => (
                        <p key={j} className={cn(
                          "leading-relaxed",
                          j === scene.accentRegel ? "font-bold text-autronis-accent" : "text-autronis-text-primary"
                        )}>
                          {line}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Raw JSON */}
                {showScript && (
                  <div className="mt-2">
                    <textarea
                      value={JSON.stringify(script, null, 2)}
                      onChange={e => { try { setScript(JSON.parse(e.target.value)); setVideoUrl(null); } catch { /* ignore */ } }}
                      rows={12}
                      className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2 text-[11px] font-mono text-autronis-text-secondary focus:outline-none focus:border-autronis-accent/50 resize-y"
                    />
                  </div>
                )}

                {/* Quick feedback buttons */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-autronis-border">
                  {[
                    "Maak de hook pakkender",
                    "Voeg meer urgentie toe",
                    "Korter en sneller",
                    "Andere invalshoek",
                    "Meer emoji/visueel",
                  ].map(fb => (
                    <button key={fb} onClick={() => sendMessage(fb)}
                      className="text-[10px] px-2 py-1 bg-autronis-bg border border-autronis-border rounded-lg text-autronis-text-tertiary hover:text-autronis-accent hover:border-autronis-accent/30 transition-all">
                      {fb}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!script && !videoUrl && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-8 text-center">
                <Film className="w-10 h-10 text-autronis-text-tertiary mx-auto mb-3" />
                <p className="text-sm text-autronis-text-tertiary">Script verschijnt hier zodra de AI het genereert</p>
                <p className="text-xs text-autronis-text-tertiary mt-1">Beschrijf je video idee in de chat</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
