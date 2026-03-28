"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Wand2, Link, Package, Copy, Check, Zap, ExternalLink, Image, Clapperboard,
  Layers, Upload, X, RotateCcw, Globe, Code2, ChevronDown, ChevronUp, Play,
  Loader2, Sparkles, Trash2, RefreshCw, FileText, Eye, EyeOff, BookmarkPlus,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScrollStopPrompts {
  promptA: string;
  promptB: string;
  promptC: string;
  objectNaam: string;
  tabANaam: string;
  tabBNaam: string;
  bron: string;
}

interface LogoResult {
  videoPrompt: string;
  objectNaam: string;
  bron: string;
}

interface GalleryItem {
  id: number;
  type: "scroll-stop" | "logo-animatie";
  productNaam: string;
  eindEffect: string | null;
  manifest: string | null;
  promptA: string | null;
  promptB: string | null;
  promptVideo: string | null;
  afbeeldingUrl: string | null;
  lokaalPad: string | null;
  aangemaaktOp: string | null;
}

type Tab = "A" | "B" | "C";
type Mode = "scroll-stop" | "logo-animatie";
type ManifestStep = "idle" | "generating" | "ready" | "editing";

const EIND_EFFECTEN = [
  { key: "exploded", label: "Exploded/Deconstructed", desc: "Onderdelen zweven uit elkaar" },
  { key: "buildup", label: "Build-up", desc: "Particles komen samen en vormen het object" },
  { key: "xray", label: "X-ray/Cutaway", desc: "Doorzicht, binnenkant zichtbaar" },
  { key: "wireframe", label: "Wireframe Dissolve", desc: "Object lost op in wireframe mesh" },
  { key: "glowup", label: "Glow Up", desc: "Object begint donker, licht op van binnenuit" },
  { key: "liquid", label: "Liquid Morph", desc: "Object smelt/morpht naar vloeibare vorm" },
  { key: "scatter", label: "Scatter", desc: "Object valt uiteen in honderden kleine stukjes" },
  { key: "context", label: "Context Placement", desc: "Object verschijnt in een echte werkplek" },
  { key: "material", label: "Materiaal Switch", desc: "Transformeert van glas → metaal → hout" },
] as const;

const ANIMATIE_CHIPS = [
  "Opstijgen", "Vleugels flappen", "360° draai", "Oplichten",
  "Zweven", "Landen", "Particle build-up", "Materiaal transformatie", "Schudden",
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export default function AnimatiesPage() {
  // ── Shared state
  const [mode, setMode] = useState<Mode>("scroll-stop");
  const [stepsOpen, setStepsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Scroll-Stop state (restored from localStorage)
  const [input, setInput] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("scrollstop-input") ?? "";
  });
  const [inputType, setInputType] = useState<"url" | "product" | "image">("product");
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<ScrollStopPrompts | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("A");
  const [uploadedImage, setUploadedImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null);
  const [productRefImage, setProductRefImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null);
  const [eindEffect, setEindEffect] = useState(() => {
    if (typeof window === "undefined") return "exploded";
    return localStorage.getItem("scrollstop-effect") ?? "exploded";
  });
  const [effectDropdownOpen, setEffectDropdownOpen] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // ── Manifest state (restored from localStorage)
  const [manifestStep, setManifestStep] = useState<ManifestStep>(() => {
    if (typeof window === "undefined") return "idle";
    return localStorage.getItem("scrollstop-manifest") ? "ready" : "idle";
  });
  const [manifest, setManifest] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("scrollstop-manifest") ?? "";
  });
  const [manifestObjectNaam, setManifestObjectNaam] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("scrollstop-manifest-naam") ?? "";
  });
  const [manifestOpen, setManifestOpen] = useState(true);

  // ── Persist to localStorage
  useEffect(() => { localStorage.setItem("scrollstop-input", input); }, [input]);
  useEffect(() => { localStorage.setItem("scrollstop-effect", eindEffect); }, [eindEffect]);
  useEffect(() => {
    if (manifest) localStorage.setItem("scrollstop-manifest", manifest);
    else localStorage.removeItem("scrollstop-manifest");
  }, [manifest]);
  useEffect(() => {
    if (manifestObjectNaam) localStorage.setItem("scrollstop-manifest-naam", manifestObjectNaam);
    else localStorage.removeItem("scrollstop-manifest-naam");
  }, [manifestObjectNaam]);

  // ── Kie.ai state
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

  // Auto-fill video frame URLs when images are generated
  useEffect(() => { if (kieImgUrl.A) setKieStartFrame(kieImgUrl.A); }, [kieImgUrl.A]);
  useEffect(() => { if (kieImgUrl.B) setKieEndFrame(kieImgUrl.B); }, [kieImgUrl.B]);

  // ── Logo Animatie state
  const [logoInput, setLogoInput] = useState("");
  const [logoImage, setLogoImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null);
  const [logoTags, setLogoTags] = useState<string[]>([]);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoResult, setLogoResult] = useState<LogoResult | null>(null);
  const [logoError, setLogoError] = useState("");
  const [logoCopied, setLogoCopied] = useState(false);

  // ── Logo Kie.ai video state
  const [logoKieFirstFrame, setLogoKieFirstFrame] = useState("");
  const [logoKieDuration, setLogoKieDuration] = useState(5);
  const [logoKieLoading, setLogoKieLoading] = useState(false);
  const [logoKieVideoUrl, setLogoKieVideoUrl] = useState<string | null>(null);
  const [logoKieError, setLogoKieError] = useState("");
  const logoKiePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Gallery state
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryFilter, setGalleryFilter] = useState<"all" | "scroll-stop" | "logo-animatie">("all");
  const [galleryLoading, setGalleryLoading] = useState(false);

  // ── Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const productRefInputRef = useRef<HTMLInputElement>(null);

  // ── Load gallery
  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    try {
      const res = await fetch("/api/assets/gallery");
      if (res.ok) {
        const data = await res.json() as { items: GalleryItem[] };
        setGallery(data.items);
      }
    } catch { /* ignore */ }
    setGalleryLoading(false);
  }, []);

  useEffect(() => { loadGallery(); }, [loadGallery]);

  // ── Save to gallery (use ref to avoid stale closure in setInterval callbacks)
  const [gallerySaveStatus, setGallerySaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveToGallery = useCallback(async (imageUrl: string, type: "scroll-stop" | "logo-animatie") => {
    setGallerySaveStatus("saving");
    const body: Record<string, string | undefined> = {
      type,
      productNaam: type === "scroll-stop" ? (prompts?.objectNaam ?? (input || "Scroll-Stop")) : (logoResult?.objectNaam ?? "Logo"),
      afbeeldingUrl: imageUrl,
    };
    if (type === "scroll-stop" && prompts) {
      body.eindEffect = eindEffect;
      body.manifest = manifest || undefined;
      body.promptA = prompts.promptA;
      body.promptB = prompts.promptB;
      body.promptVideo = prompts.promptC;
    }
    if (type === "logo-animatie" && logoResult) {
      body.promptVideo = logoResult.videoPrompt;
    }
    try {
      const res = await fetch("/api/assets/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setGallerySaveStatus("saved");
        loadGallery();
      } else {
        setGallerySaveStatus("error");
      }
    } catch {
      setGallerySaveStatus("error");
    }
  }, [prompts, logoResult, eindEffect, manifest, input, loadGallery]);
  const saveToGalleryRef = useRef(saveToGallery);
  useEffect(() => { saveToGalleryRef.current = saveToGallery; }, [saveToGallery]);

  // ── Delete from gallery
  const deleteGalleryItem = useCallback(async (id: number) => {
    try {
      await fetch(`/api/assets/gallery?id=${id}`, { method: "DELETE" });
      setGallery(prev => prev.filter(item => item.id !== id));
    } catch { /* ignore */ }
  }, []);

  // ── Load gallery item into generator
  const loadGalleryItem = useCallback((item: GalleryItem) => {
    if (item.type === "scroll-stop") {
      setMode("scroll-stop");
      setInput(item.productNaam);
      setInputType("product");
      if (item.eindEffect) setEindEffect(item.eindEffect);
      if (item.manifest) { setManifest(item.manifest); setManifestStep("ready"); }
      if (item.promptA && item.promptB && item.promptVideo) {
        setPrompts({
          promptA: item.promptA,
          promptB: item.promptB,
          promptC: item.promptVideo,
          objectNaam: item.productNaam,
          tabANaam: "Assembled Shot",
          tabBNaam: EIND_EFFECTEN.find(e => e.key === item.eindEffect)?.label ?? "Deconstructed View",
          bron: item.productNaam,
        });
      }
    } else {
      setMode("logo-animatie");
      if (item.promptVideo) {
        setLogoResult({ videoPrompt: item.promptVideo, objectNaam: item.productNaam, bron: item.productNaam });
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ── Confetti
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

  // ── File upload handler
  const handleFileUpload = (file: File, setter: (v: { base64: string; mediaType: string; preview: string }) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setter({ base64: result.split(",")[1], mediaType: file.type, preview: result });
    };
    reader.readAsDataURL(file);
  };

  // ── Stop generation
  const stopGenerate = () => {
    abortRef.current?.abort();
    setLoading(false);
    setLogoLoading(false);
  };

  // ── AI OPTIMIZE: Enrich input prompt + generate manifest in one call
  const optimizePrompt = async () => {
    if (!input.trim() && !uploadedImage) return;
    setOptimizing(true); setError("");
    const body: Record<string, string> = {};
    if (input.trim()) body.description = input;
    if (inputType === "image" && uploadedImage) { body.imageBase64 = uploadedImage.base64; body.mediaType = uploadedImage.mediaType; }
    if (inputType === "product" && productRefImage) { body.imageBase64 = productRefImage.base64; body.mediaType = productRefImage.mediaType; if (input.trim()) body.description = input; }
    try {
      const res = await fetch("/api/animaties/optimize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { optimizedPrompt?: string; productName?: string; objectNaam?: string; manifest?: string; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Optimalisatie mislukt."); setOptimizing(false); return; }
      if (data.optimizedPrompt) setInput(data.optimizedPrompt);
      if (data.manifest) {
        setManifest(data.manifest);
        setManifestObjectNaam(data.objectNaam ?? data.productName ?? "");
        setManifestStep("ready");
        setManifestOpen(true);
      }
      setOptimizing(false);
    } catch {
      setError("Optimalisatie mislukt.");
      setOptimizing(false);
    }
  };

  // ── MANIFEST: Generate
  const generateManifest = async () => {
    setManifestStep("generating");
    setManifest("");
    const body: Record<string, string> = {};
    if (inputType === "product") body.product = input;
    if (inputType === "image" && uploadedImage) { body.imageBase64 = uploadedImage.base64; body.mediaType = uploadedImage.mediaType; }
    if (inputType === "product" && productRefImage) { body.imageBase64 = productRefImage.base64; body.mediaType = productRefImage.mediaType; if (input) body.product = input; }
    try {
      const res = await fetch("/api/animaties/generate-manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { manifest?: string; objectNaam?: string; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Manifest generatie mislukt."); setManifestStep("idle"); return; }
      setManifest(data.manifest ?? "");
      setManifestObjectNaam(data.objectNaam ?? "");
      setManifestStep("ready");
      setManifestOpen(true);
    } catch {
      setError("Manifest generatie mislukt.");
      setManifestStep("idle");
    }
  };

  // ── SCROLL-STOP: Generate prompts (with manifest)
  const generate = async () => {
    if (inputType === "image" && !uploadedImage) return;
    if (inputType !== "image" && !input.trim()) return;
    abortRef.current = new AbortController();
    setLoading(true); setError(""); setPrompts(null);

    let body: Record<string, string> = { eindEffect };
    if (manifest) body.manifest = manifest;
    if (inputType === "url") body.url = input;
    else if (inputType === "product") {
      body.product = input;
      if (productRefImage) { body.imageBase64 = productRefImage.base64; body.mediaType = productRefImage.mediaType; }
    } else if (inputType === "image" && uploadedImage) {
      body.imageBase64 = uploadedImage.base64; body.mediaType = uploadedImage.mediaType;
    }

    try {
      const res = await fetch("/api/animaties/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });
      const data = await res.json() as ScrollStopPrompts & { error?: string };
      setLoading(false);
      if (!res.ok || data.error) { setError(data.error ?? "Er ging iets mis."); return; }
      setPrompts(data); setActiveTab("A");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setLoading(false);
      setError("Er ging iets mis.");
    }
  };

  // ── KIE: Image generation
  const generateKieImage = async (tab: "A" | "B") => {
    if (!prompts) return;
    const prompt = tab === "A" ? prompts.promptA : prompts.promptB;
    // When generating B, use A's image as reference for consistency
    const refImageUrl = tab === "B" ? kieImgUrl.A : null;
    setKieImgLoading(prev => ({ ...prev, [tab]: true }));
    setKieImgError(prev => ({ ...prev, [tab]: "" }));
    setKieImgUrl(prev => ({ ...prev, [tab]: null }));
    try {
      const body: Record<string, string> = { prompt };
      if (refImageUrl) body.referenceImageUrl = refImageUrl;
      const res = await fetch("/api/animaties/kie-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          saveToGalleryRef.current(result.imageUrl!, "scroll-stop");
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

  // ── KIE: Video generation
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

  // ── LOGO: Generate
  const generateLogo = async () => {
    if (!logoInput.trim() && !logoImage) return;
    abortRef.current = new AbortController();
    setLogoLoading(true); setLogoError(""); setLogoResult(null);
    const body: Record<string, string | string[]> = {};
    if (logoImage) { body.imageBase64 = logoImage.base64; body.mediaType = logoImage.mediaType; }
    if (logoInput.trim()) body.description = logoInput;
    if (logoTags.length > 0) body.animatieTags = logoTags;
    try {
      const res = await fetch("/api/animaties/generate-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });
      const data = await res.json() as LogoResult & { error?: string };
      setLogoLoading(false);
      if (!res.ok || data.error) { setLogoError(data.error ?? "Er ging iets mis."); return; }
      setLogoResult(data);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setLogoLoading(false);
      setLogoError("Er ging iets mis.");
    }
  };

  // ── LOGO KIE: Video generation
  const generateLogoKieVideo = async () => {
    if (!logoResult) return;
    setLogoKieLoading(true); setLogoKieError(""); setLogoKieVideoUrl(null);
    try {
      const res = await fetch("/api/animaties/kie-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: logoResult.videoPrompt,
          duration: logoKieDuration,
          ...(logoKieFirstFrame.trim() && { firstFrameImage: logoKieFirstFrame.trim() }),
        }),
      });
      const data = await res.json() as { taskId?: string; error?: string };
      if (!res.ok || data.error) { setLogoKieError(data.error ?? "Fout."); setLogoKieLoading(false); return; }
      logoKiePollingRef.current = setInterval(async () => {
        const poll = await fetch(`/api/animaties/kie-video-status?taskId=${data.taskId}`);
        const result = await poll.json() as { status: string; videoUrl?: string; error?: string };
        if (result.status === "done" && result.videoUrl) {
          clearInterval(logoKiePollingRef.current!);
          setLogoKieVideoUrl(result.videoUrl);
          setLogoKieLoading(false);
        } else if (result.status === "failed") {
          clearInterval(logoKiePollingRef.current!);
          setLogoKieError(result.error ?? "Generatie mislukt.");
          setLogoKieLoading(false);
        }
      }, 4000);
    } catch {
      setLogoKieError("Er ging iets mis."); setLogoKieLoading(false);
    }
  };

  // ── Copy helpers
  const copyScrollStop = (openHiggsfield = false) => {
    if (!prompts) return;
    const text = activeTab === "A" ? prompts.promptA : activeTab === "B" ? prompts.promptB : prompts.promptC;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); launchConfetti();
      setTimeout(() => setCopied(false), 2000);
      if (openHiggsfield) window.open("https://higgsfield.ai", "_blank");
    });
  };

  const copyLogoPrompt = (openTarget?: string) => {
    if (!logoResult) return;
    navigator.clipboard.writeText(logoResult.videoPrompt).then(() => {
      setLogoCopied(true); launchConfetti();
      setTimeout(() => setLogoCopied(false), 2000);
      if (openTarget === "runway") window.open("https://app.runwayml.com", "_blank");
      if (openTarget === "higgsfield") window.open("https://higgsfield.ai", "_blank");
    });
  };

  // ── Scroll-stop tab config
  const effectLabel = EIND_EFFECTEN.find(e => e.key === eindEffect)?.label ?? "Deconstructed View";
  const tabConfig = {
    A: { label: prompts?.tabANaam ?? "Assembled Shot", icon: Image, instruction: "Genereer afbeelding A eerst (16:9)" },
    B: { label: prompts?.tabBNaam ?? effectLabel, icon: Layers, instruction: kieImgUrl.A ? "Afbeelding A wordt automatisch als referentie gebruikt" : "Genereer eerst afbeelding A als referentie" },
    C: { label: "Video Transitie", icon: Clapperboard, instruction: "Upload A als start frame + B als end frame → genereer video (5s)" },
  } as const;

  const activePrompt = prompts
    ? activeTab === "A" ? prompts.promptA : activeTab === "B" ? prompts.promptB : prompts.promptC
    : "";

  const allSteps = [
    { n: "1", icon: Image, label: "Copy A → Higgsfield", sub: "Genereer assembled shot (afbeelding)" },
    { n: "2", icon: Layers, label: "Genereer B", sub: `Afbeelding A wordt automatisch als referentie meegegeven` },
    { n: "3", icon: Clapperboard, label: "Copy C → Higgsfield", sub: "Upload A + B als frames → genereer video (5s)" },
    { n: "4", icon: Globe, label: "Download video", sub: "Sla de video op van Higgsfield" },
    { n: "5", icon: Code2, label: "VSCode → scroll-stop build", sub: "Zeg in Claude Code: \"scroll-stop build\" + geef het videobestand" },
    { n: "6", icon: Globe, label: "Website live", sub: "Skill bouwt automatisch de Apple-stijl scroll-website" },
  ];

  const canGenerateManifest = (inputType === "product" && input.trim()) || (inputType === "image" && uploadedImage);

  // ── Gallery filtered
  const filteredGallery = galleryFilter === "all" ? gallery : gallery.filter(g => g.type === galleryFilter);

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

      {/* Stappenplan (collapsible) — only scroll-stop */}
      {mode === "scroll-stop" && (
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
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* LOGO ANIMATIE MODE                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {mode === "logo-animatie" && (
        <>
          <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 mb-5">
            {/* Image upload */}
            <div className="mb-3">
              <input ref={logoFileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, setLogoImage); }} />
              {logoImage ? (
                <div className="flex items-center gap-3 bg-autronis-bg border border-autronis-border rounded-lg px-4 py-2.5">
                  <img src={logoImage.preview} alt="upload" className="w-12 h-12 object-contain rounded" />
                  <span className="text-sm text-autronis-text-primary flex-1">Afbeelding geladen</span>
                  <button onClick={() => setLogoImage(null)} className="text-autronis-text-tertiary hover:text-autronis-text-primary">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => logoFileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 py-5 bg-autronis-bg border border-dashed border-autronis-border rounded-lg text-autronis-text-tertiary hover:border-autronis-accent/50 hover:text-autronis-accent transition-all"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Upload je logo, icoon of product afbeelding</span>
                  <span className="text-xs opacity-60">PNG, JPG, WEBP</span>
                </button>
              )}
            </div>

            {/* Description */}
            <textarea
              value={logoInput}
              onChange={e => setLogoInput(e.target.value)}
              rows={3}
              placeholder="Beschrijf de gewenste animatie... bijv. 'Logo vliegt van links het beeld in, draait 360° en landt in het midden'"
              className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 transition-colors resize-none mb-3"
            />

            {/* Animation chips */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-autronis-text-secondary mb-2">Snelkeuze animaties</p>
              <div className="flex flex-wrap gap-1.5">
                {ANIMATIE_CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => setLogoTags(prev => prev.includes(chip) ? prev.filter(t => t !== chip) : [...prev, chip])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      logoTags.includes(chip)
                        ? "bg-autronis-accent text-white"
                        : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/30"
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <div className="flex justify-end gap-2">
              {logoLoading ? (
                <button onClick={stopGenerate} className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-all">
                  <X className="w-4 h-4" /> Stop
                </button>
              ) : (
                <button onClick={generateLogo} disabled={!logoInput.trim() && !logoImage}
                  className="flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-white rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <Zap className="w-4 h-4" /> Genereer video prompt
                </button>
              )}
            </div>
            {logoError && <p className="mt-3 text-sm text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">{logoError}</p>}
          </div>

          {/* Logo Result */}
          {logoResult && (
            <div className="bg-autronis-card border border-autronis-border rounded-xl overflow-hidden mb-5">
              <div className="flex items-center justify-between p-3 border-b border-autronis-border">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-autronis-accent" />
                  <span className="text-sm font-semibold">Video Prompt — {logoResult.objectNaam}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyLogoPrompt()}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
                      logoCopied ? "bg-autronis-accent text-white border-autronis-accent" : "bg-autronis-bg text-autronis-text-secondary border-autronis-border hover:text-autronis-text-primary"
                    }`}>
                    {logoCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {logoCopied ? "Gekopieerd!" : "Copy"}
                  </button>
                  <button onClick={() => copyLogoPrompt("runway")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-autronis-accent/10 text-autronis-accent border border-autronis-accent/20 hover:bg-autronis-accent hover:text-white transition-all">
                    <ExternalLink className="w-4 h-4" /> Copy + Open Runway
                  </button>
                  <button onClick={() => copyLogoPrompt("higgsfield")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-autronis-accent/10 text-autronis-accent border border-autronis-accent/20 hover:bg-autronis-accent hover:text-white transition-all">
                    <ExternalLink className="w-4 h-4" /> Copy + Open Higgsfield
                  </button>
                </div>
              </div>
              {/* Show uploaded image + prompt */}
              <div className="p-4 flex gap-4">
                {logoImage && (
                  <div className="flex-shrink-0">
                    <img src={logoImage.preview} alt="logo" className="w-32 h-32 object-contain rounded-lg border border-autronis-border bg-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <pre className="font-mono text-sm text-autronis-text-secondary whitespace-pre-wrap leading-relaxed">{logoResult.videoPrompt}</pre>
                </div>
              </div>
              {/* Kie.ai video generator */}
              <div className="border-t border-autronis-border p-4 bg-autronis-bg/40">
                <p className="text-xs font-semibold text-autronis-text-primary mb-3 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-autronis-accent" /> Genereer video via Kie.ai
                </p>
                <div className="flex flex-col gap-2 mb-2">
                  <input value={logoKieFirstFrame} onChange={e => setLogoKieFirstFrame(e.target.value)}
                    placeholder="Start frame URL (je geüploade afbeelding als URL, optioneel)"
                    className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[5, 8, 10].map(d => (
                      <button key={d} onClick={() => setLogoKieDuration(d)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${logoKieDuration === d ? "bg-autronis-accent text-white" : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"}`}>
                        {d}s
                      </button>
                    ))}
                  </div>
                  <button onClick={generateLogoKieVideo} disabled={logoKieLoading}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-autronis-accent text-white rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {logoKieLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Genereren...</> : <><Zap className="w-4 h-4" /> Genereer video</>}
                  </button>
                </div>
                {logoKieError && <p className="mt-2 text-xs text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">{logoKieError}</p>}
                {logoKieVideoUrl && (
                  <div className="mt-3">
                    <video src={logoKieVideoUrl} controls className="w-full rounded-lg border border-autronis-border" />
                    <a href={logoKieVideoUrl} download className="mt-2 flex items-center gap-1.5 text-xs text-autronis-accent hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> Download video
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {!logoResult && !logoLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-xl bg-autronis-card border border-autronis-border flex items-center justify-center mx-auto mb-3">
                  <RotateCcw className="w-6 h-6 text-autronis-text-tertiary" />
                </div>
                <p className="text-autronis-text-tertiary text-sm">Upload een afbeelding, beschrijf de animatie en klik Genereer</p>
              </div>
            </div>
          )}

          {logoLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-3 text-autronis-text-secondary">
                <Loader2 className="w-5 h-5 animate-spin text-autronis-accent" />
                <span className="text-sm">Video prompt genereren...</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SCROLL-STOP MODE                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
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
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], setUploadedImage)} />
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
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {inputType === "url" ? (
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !loading && generate()}
                    placeholder="https://nike.com/air-max-90"
                    className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-4 py-2.5 text-sm placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 transition-colors text-autronis-text-primary"
                  />
                ) : (
                  <div className="flex gap-2">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      rows={input.length > 100 ? 3 : 1}
                      placeholder="bijv. Nike Air Max 90, Autronis logo, iPhone 15 Pro"
                      className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-4 py-2.5 text-sm placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 transition-colors text-autronis-text-primary resize-none"
                    />
                    <button
                      onClick={optimizePrompt}
                      disabled={!input.trim() || optimizing}
                      className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs font-semibold text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed self-start"
                      title="AI optimaliseert je beschrijving met rijke materiaal-, kleur- en vormdetails"
                    >
                      {optimizing ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Optimaliseren...</>
                      ) : (
                        <><Wand2 className="w-3.5 h-3.5" /> AI Optimize</>
                      )}
                    </button>
                  </div>
                )}
                {inputType === "product" && (
                  <div className="flex items-center gap-2">
                    <input ref={productRefInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, setProductRefImage); }} />
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

            {/* Eindeffect dropdown + Manifest button */}
            <div className="flex items-center gap-3 mt-3">
              {/* Eindeffect dropdown */}
              <div className="relative">
                <button
                  onClick={() => setEffectDropdownOpen(v => !v)}
                  className="flex items-center gap-2 px-3 py-2 bg-autronis-bg border border-autronis-border rounded-lg text-sm text-autronis-text-primary hover:border-autronis-accent/50 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-autronis-accent" />
                  <span className="font-semibold">{EIND_EFFECTEN.find(e => e.key === eindEffect)?.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-autronis-text-tertiary" />
                </button>
                {effectDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-80 bg-autronis-card border border-autronis-border rounded-xl shadow-xl z-40 py-1 max-h-72 overflow-y-auto">
                    {EIND_EFFECTEN.map(effect => (
                      <button
                        key={effect.key}
                        onClick={() => { setEindEffect(effect.key); setEffectDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-autronis-bg transition-all ${
                          eindEffect === effect.key ? "bg-autronis-accent/10" : ""
                        }`}
                      >
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${eindEffect === effect.key ? "text-autronis-accent" : "text-autronis-text-primary"}`}>{effect.label}</p>
                          <p className="text-xs text-autronis-text-tertiary">{effect.desc}</p>
                        </div>
                        {eindEffect === effect.key && <Check className="w-4 h-4 text-autronis-accent flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Manifest generate button */}
              {inputType !== "url" && (
                <button
                  onClick={generateManifest}
                  disabled={!canGenerateManifest || manifestStep === "generating"}
                  className="flex items-center gap-2 px-3 py-2 bg-autronis-bg border border-autronis-border rounded-lg text-sm font-semibold text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {manifestStep === "generating" ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Manifest genereren...</>
                  ) : (
                    <><FileText className="w-3.5 h-3.5" /> {manifestStep === "ready" ? "Manifest hergenereren" : "Manifest genereren"}</>
                  )}
                </button>
              )}

              {/* Generate prompts button (right side) */}
              <div className="ml-auto flex gap-2">
                {loading ? (
                  <button onClick={stopGenerate} className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-all">
                    <X className="w-4 h-4" /> Stop
                  </button>
                ) : (
                  <button
                    onClick={generate}
                    disabled={inputType === "image" ? !uploadedImage : !input.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-white rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Zap className="w-4 h-4" /> Genereer prompts
                  </button>
                )}
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Manifest preview (collapsible) */}
          {manifestStep === "ready" && manifest && (
            <div className="bg-autronis-card border border-autronis-border rounded-xl mb-5 overflow-hidden">
              <button
                onClick={() => setManifestOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-autronis-text-primary hover:bg-autronis-card-hover transition-all"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-autronis-accent" />
                  Onderdelen Manifest {manifestObjectNaam && `— ${manifestObjectNaam}`}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-autronis-text-tertiary">Bewerkbaar</span>
                  {manifestOpen ? <EyeOff className="w-4 h-4 text-autronis-text-tertiary" /> : <Eye className="w-4 h-4 text-autronis-text-tertiary" />}
                </div>
              </button>
              {manifestOpen && (
                <div className="px-4 pb-4 border-t border-autronis-border pt-3">
                  <textarea
                    value={manifest}
                    onChange={e => setManifest(e.target.value)}
                    rows={8}
                    className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-4 py-3 text-sm text-autronis-text-primary font-mono leading-relaxed focus:outline-none focus:border-autronis-accent/50 transition-colors resize-y"
                  />
                  <p className="mt-2 text-xs text-autronis-text-tertiary">
                    Review en pas het manifest aan. De prompts worden op basis van dit manifest gegenereerd zodat A en B consistent zijn.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 text-autronis-text-secondary">
                <Loader2 className="w-5 h-5 animate-spin text-autronis-accent" />
                <span className="text-sm">Prompts genereren...</span>
              </div>
            </div>
          )}

          {/* Result */}
          {prompts && (
            <div className="flex-1 flex flex-col min-h-0 bg-autronis-card border border-autronis-border rounded-xl overflow-hidden mb-5">
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
                    onClick={() => copyScrollStop(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
                      copied ? "bg-autronis-accent text-white border-autronis-accent" : "bg-autronis-bg text-autronis-text-secondary border-autronis-border hover:text-autronis-text-primary"
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Gekopieerd!" : "Copy"}
                  </button>
                  <button
                    onClick={() => copyScrollStop(true)}
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
                      <div className="mt-1.5 flex items-center gap-3">
                        <a href={kieImgUrl[activeTab]!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-autronis-accent hover:underline">
                          <ExternalLink className="w-3.5 h-3.5" /> Open afbeelding
                        </a>
                        <button onClick={() => saveToGalleryRef.current(kieImgUrl[activeTab]!, "scroll-stop")} disabled={gallerySaveStatus === "saving"} className="flex items-center gap-1.5 text-xs text-emerald-400 hover:underline disabled:opacity-50">
                          {gallerySaveStatus === "saving" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Opslaan...</> : gallerySaveStatus === "saved" ? <><Check className="w-3.5 h-3.5" /> Opgeslagen</> : gallerySaveStatus === "error" ? <><X className="w-3.5 h-3.5 text-red-400" /> Mislukt — opnieuw</> : <><BookmarkPlus className="w-3.5 h-3.5" /> Opslaan in galerij</>}
                        </button>
                      </div>
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

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* GALLERY                                                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mt-8 border-t border-autronis-border pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-autronis-accent" />
            <h2 className="text-lg font-bold">Galerij</h2>
            <span className="text-xs text-autronis-text-tertiary">({filteredGallery.length} items)</span>
          </div>
          <div className="flex items-center gap-2">
            {(["all", "scroll-stop", "logo-animatie"] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setGalleryFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  galleryFilter === filter
                    ? "bg-autronis-accent text-white"
                    : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                }`}
              >
                {filter === "all" ? "Alles" : filter === "scroll-stop" ? "Scroll-Stop" : "Logo"}
              </button>
            ))}
            <button onClick={loadGallery} className="p-1.5 text-autronis-text-tertiary hover:text-autronis-accent transition-all">
              <RefreshCw className={`w-4 h-4 ${galleryLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {filteredGallery.length === 0 ? (
          <div className="text-center py-10 bg-autronis-card border border-autronis-border rounded-xl">
            <Image className="w-8 h-8 text-autronis-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-autronis-text-tertiary">Nog geen gegenereerde afbeeldingen</p>
            <p className="text-xs text-autronis-text-tertiary mt-1">Afbeeldingen worden automatisch opgeslagen als je ze genereert via Kie.ai</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredGallery.map(item => (
              <div key={item.id} className="group bg-autronis-card border border-autronis-border rounded-xl overflow-hidden hover:border-autronis-accent/30 transition-all">
                {item.afbeeldingUrl ? (
                  <div className="aspect-video bg-white relative cursor-pointer" onClick={() => loadGalleryItem(item)}>
                    <img src={item.afbeeldingUrl} alt={item.productNaam} className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-autronis-bg flex items-center justify-center cursor-pointer" onClick={() => loadGalleryItem(item)}>
                    <Image className="w-8 h-8 text-autronis-text-tertiary" />
                  </div>
                )}
                <div className="p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                      item.type === "scroll-stop" ? "bg-autronis-accent/10 text-autronis-accent" : "bg-purple-500/10 text-purple-400"
                    }`}>
                      {item.type}
                    </span>
                    <button onClick={() => deleteGalleryItem(item.id)}
                      className="p-1 text-autronis-text-tertiary hover:text-red-400 transition-all opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-autronis-text-primary truncate">{item.productNaam}</p>
                  <p className="text-[10px] text-autronis-text-tertiary mt-0.5">
                    {item.aangemaaktOp ? new Date(item.aangemaaktOp + "Z").toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
