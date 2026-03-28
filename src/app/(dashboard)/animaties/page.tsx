"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Wand2, Link, Package, Copy, Check, Zap, ExternalLink, Image, Clapperboard,
  Layers, Upload, X, RotateCcw, Globe, Code2, ChevronDown, ChevronUp, Play,
  Loader2, Sparkles, Trash2, RefreshCw, FileText, Eye, EyeOff, BookmarkPlus,
  Star, Search, FolderOpen, Tag, CheckSquare, Grid3X3, LayoutList,
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
  videoUrl: string | null;
  lokaalPad: string | null;
  projectId: number | null;
  projectNaam: string | null;
  tags: string | null;
  isFavoriet: number | null;
  aangemaaktOp: string | null;
}

interface ProjectOption {
  id: number;
  naam: string;
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

const VISUELE_STIJLEN = [
  { key: "glass-morphism", label: "Glass Morphism", desc: "Frosted glas, chrome accenten, teal glow", prompt: "Frosted borosilicate glass construction with chrome/brushed stainless steel accents. Translucent ice-blue tinted panels revealing internal components. Teal (#23C6B7) bioluminescent glow from internal elements. Clean white background (#FFFFFF). Premium, futuristic, Apple-meets-laboratory aesthetic." },
  { key: "matte-black", label: "Matte Black", desc: "Premium zwart metaal, gouden accenten", prompt: "Matte black anodized aluminum and dark gunmetal construction. Subtle gold/brass accent lines and details. Dark charcoal background with dramatic rim lighting. Premium, luxury, stealth aesthetic. Soft specular highlights on edges." },
  { key: "neon-cyberpunk", label: "Neon Cyberpunk", desc: "Donker + felle neon, futuristisch", prompt: "Dark matte carbon fiber and black polycarbonate base materials. Vivid neon accent lighting in hot pink (#FF2D78), electric blue (#00D4FF), and acid green (#39FF14). Glitch-effect edges, holographic stickers, LED strip accents. Dark background with neon reflections. Cyberpunk, futuristic, high-tech rave aesthetic." },
  { key: "minimal-white", label: "Minimal White", desc: "Wit keramiek, Apple-stijl", prompt: "Pure white matte ceramic and frosted glass construction. No color accents — monochrome white, off-white, and light grey only. Ultra-soft shadows, diffused lighting. Clean white background. Apple product photography style — minimal, elegant, pristine." },
  { key: "industrial", label: "Industrial", desc: "Ruw staal, koper, steampunk", prompt: "Raw brushed steel, aged copper with green patina, and cast iron construction. Visible hex bolts, weld seams, and rivets. Exposed mechanical components and piping. Warm workshop lighting. Steampunk-industrial aesthetic with functional, utilitarian beauty." },
  { key: "holographic", label: "Holographic", desc: "Iriserende/regenboog, prisma", prompt: "Iridescent holographic materials shifting between rainbow colors. Prismatic glass panels casting spectrum light. Chrome mirror surfaces with rainbow reflections. Transparent and semi-transparent layered construction. Clean white background. Ethereal, otherworldly, futuristic fashion aesthetic." },
  { key: "wooden-craft", label: "Wooden Craft", desc: "Hout, leer, messing, warm", prompt: "Rich walnut and oak wood with visible grain texture. Saddle-brown leather panels and straps. Polished brass fittings, hinges, and accents. Warm amber lighting. Artisanal, handcrafted, premium workshop aesthetic. Natural materials, organic warmth." },
  { key: "custom", label: "Custom", desc: "Eigen stijl beschrijving" },
] as const;

const ANIMATIE_CHIPS = [
  "Opstijgen", "Vleugels flappen", "360° draai", "Oplichten",
  "Zweven", "Landen", "Particle build-up", "Materiaal transformatie", "Schudden",
] as const;

const VIDEO_TRANSITIE_PRESETS = [
  {
    key: "assembly",
    label: "Mechanische assembly",
    desc: "Onderdelen glijden stuk voor stuk naar hun positie",
    prompt: "Each individual component floats independently and glides precisely into its correct position, snapping into place one by one with mechanical precision. Parts maintain their exact shape — no morphing, no dissolving. Assembly order: base frame first, then internal components, then outer panels last. Satisfying click sound implied. Static locked-off camera, pure white background, photorealistic product photography lighting.",
  },
  {
    key: "magnetic",
    label: "Magnetische aantrekking",
    desc: "Onderdelen worden magnetisch naar het centrum getrokken",
    prompt: "All floating components simultaneously begin drifting toward the center as if pulled by a magnetic force. Movement starts slow then accelerates. Each piece finds its exact position and locks in with a satisfying snap. Larger pieces move slower, smaller pieces zip into place. No morphing or shape changes — every component keeps its original form. Static camera, white background, photorealistic.",
  },
  {
    key: "cascade",
    label: "Cascade van boven",
    desc: "Onderdelen vallen van boven en klikken op hun plek",
    prompt: "Components fall gracefully from above, one after another in a cascading sequence. Each piece descends with slight rotation, then precisely clicks into its correct position. First the base, then middle components, then the top shell. Gravity-driven but precise — like a 3D puzzle assembling itself. Static camera, white background, photorealistic product photography.",
  },
  {
    key: "spiral",
    label: "Spiraal naar binnen",
    desc: "Onderdelen spiralen naar het centrum en assembleren",
    prompt: "Deconstructed components orbit in a wide spiral pattern, gradually tightening toward the center. Each piece follows a smooth curved path inward. As pieces reach the center they lock into position. The spiral contracts over the duration until the product is fully assembled. Elegant, orbital motion. Static camera, white background, photorealistic.",
  },
  {
    key: "freeze-reverse",
    label: "Reverse explosie",
    desc: "Alsof je een explosie terugdraait in slow-motion",
    prompt: "A freeze-frame explosion played in perfect reverse. Scattered fragments and debris hang frozen in mid-air, then begin moving backward — slowly at first, then accelerating. Each shard, gear, panel, and component traces its path back to its original position. The product reassembles with increasing speed until the final piece snaps into place. Reverse high-speed photography effect. Static camera, white background.",
  },
  {
    key: "grow",
    label: "Groeien vanuit kern",
    desc: "Product groeit van binnenuit naar buiten",
    prompt: "Starting from a tiny core at the center, the product grows outward layer by layer. Internal components materialize first — circuit board, gears, wiring. Then the structural frame builds around them. Finally the outer shell and panels form as the last layer. Like watching a product being 3D-printed from the inside out. Static camera, white background, photorealistic.",
  },
  {
    key: "teleport",
    label: "Materialiseren / Teleport",
    desc: "Onderdelen verschijnen met een lichtflits op hun plek",
    prompt: "Components materialize one by one with brief flashes of light, each appearing instantly in its correct assembled position. Small sparkle effects at each materialization point. Order: base first, internals, then exterior. Between each appearance there is a brief pause. The final piece triggers a subtle pulse of light across the completed product. Static camera, white background, sci-fi photorealistic.",
  },
  {
    key: "custom",
    label: "Eigen prompt",
    desc: "Schrijf je eigen transitie beschrijving",
  },
] as const;

// ─── Gallery Card ────────────────────────────────────────────────────────────

function GalleryCard({ item, selected, onSelect, onFav, onDelete, onLoad, onProjectChange, projects }: {
  item: GalleryItem;
  selected: boolean;
  onSelect: (id: number) => void;
  onFav: (id: number, current: number | null) => void;
  onDelete: (id: number) => void;
  onLoad: (item: GalleryItem) => void;
  onProjectChange: (id: number, projectId: number | null) => void;
  projects: ProjectOption[];
}) {
  const tags = item.tags ? item.tags.split(",").map(t => t.trim()).filter(Boolean) : [];

  return (
    <div className={`group bg-autronis-card border rounded-xl overflow-hidden transition-all ${selected ? "border-autronis-accent ring-1 ring-autronis-accent/30" : "border-autronis-border hover:border-autronis-accent/30"}`}>
      {/* Thumbnail */}
      <div className="relative">
        {item.videoUrl ? (
          <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="block aspect-video bg-black">
            <video src={item.videoUrl} className="w-full h-full object-contain" muted />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
              <Play className="w-8 h-8 text-white opacity-60 group-hover:opacity-100 transition-all" />
            </div>
            <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded bg-purple-500/80 text-white font-bold">VIDEO</span>
          </a>
        ) : item.afbeeldingUrl ? (
          <a href={item.afbeeldingUrl} target="_blank" rel="noopener noreferrer" className="block aspect-video bg-white">
            <img src={item.afbeeldingUrl} alt={item.productNaam} className="w-full h-full object-contain" />
          </a>
        ) : (
          <div className="aspect-video bg-autronis-bg flex items-center justify-center cursor-pointer" onClick={() => onLoad(item)}>
            <Image className="w-8 h-8 text-autronis-text-tertiary" />
          </div>
        )}
        {/* Select checkbox */}
        <button onClick={() => onSelect(item.id)} className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border flex items-center justify-center transition-all ${selected ? "bg-autronis-accent border-autronis-accent" : "bg-black/30 border-white/40 opacity-0 group-hover:opacity-100"}`}>
          {selected && <Check className="w-3 h-3 text-white" />}
        </button>
        {/* Favoriet */}
        <button onClick={() => onFav(item.id, item.isFavoriet)} className="absolute top-1.5 right-1.5 p-1 rounded transition-all opacity-0 group-hover:opacity-100 hover:scale-110">
          <Star className={`w-4 h-4 ${item.isFavoriet ? "fill-yellow-400 text-yellow-400" : "text-white/70 hover:text-yellow-400"}`} />
        </button>
      </div>
      {/* Info */}
      <div className="p-2.5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${item.type === "scroll-stop" ? "bg-autronis-accent/10 text-autronis-accent" : "bg-purple-500/10 text-purple-400"}`}>
              {item.type}
            </span>
            {item.isFavoriet ? <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> : null}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button onClick={() => onLoad(item)} title="Laad in generator" className="p-1 text-autronis-text-tertiary hover:text-autronis-accent">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(item.id)} title="Verwijderen" className="p-1 text-autronis-text-tertiary hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-xs font-semibold text-autronis-text-primary truncate">{item.productNaam}</p>
        {/* Project badge */}
        {item.projectNaam && (
          <p className="text-[10px] text-autronis-accent mt-0.5 truncate flex items-center gap-1">
            <FolderOpen className="w-2.5 h-2.5" /> {item.projectNaam}
          </p>
        )}
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.map(t => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-autronis-bg border border-autronis-border text-autronis-text-tertiary">{t}</span>
            ))}
          </div>
        )}
        {/* Project dropdown (on hover) */}
        <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-all">
          <select value={item.projectId ? String(item.projectId) : ""} onChange={e => onProjectChange(item.id, e.target.value ? Number(e.target.value) : null)}
            className="w-full px-1.5 py-1 bg-autronis-bg border border-autronis-border rounded text-[10px] text-autronis-text-secondary focus:outline-none">
            <option value="">Geen project</option>
            {projects.map(p => <option key={p.id} value={String(p.id)}>{p.naam}</option>)}
          </select>
        </div>
        <p className="text-[10px] text-autronis-text-tertiary mt-0.5">
          {item.aangemaaktOp ? new Date(item.aangemaaktOp + "Z").toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : ""}
        </p>
      </div>
    </div>
  );
}

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
  const [prompts, setPrompts] = useState<ScrollStopPrompts | null>(() => {
    if (typeof window === "undefined") return null;
    try { const s = localStorage.getItem("scrollstop-prompts"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "A";
    return (localStorage.getItem("scrollstop-tab") as Tab) || "A";
  });
  const [uploadedImage, setUploadedImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null);
  const [productRefImage, setProductRefImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null);
  const [eindEffect, setEindEffect] = useState(() => {
    if (typeof window === "undefined") return "exploded";
    return localStorage.getItem("scrollstop-effect") ?? "exploded";
  });
  const [effectDropdownOpen, setEffectDropdownOpen] = useState(false);
  const [stijl, setStijl] = useState(() => {
    if (typeof window === "undefined") return "glass-morphism";
    return localStorage.getItem("scrollstop-stijl") ?? "glass-morphism";
  });
  const [stijlDropdownOpen, setStijlDropdownOpen] = useState(false);
  const [customStijl, setCustomStijl] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("scrollstop-custom-stijl") ?? "";
  });
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
  useEffect(() => { localStorage.setItem("scrollstop-stijl", stijl); }, [stijl]);
  useEffect(() => {
    if (customStijl) localStorage.setItem("scrollstop-custom-stijl", customStijl);
    else localStorage.removeItem("scrollstop-custom-stijl");
  }, [customStijl]);
  useEffect(() => {
    if (manifest) localStorage.setItem("scrollstop-manifest", manifest);
    else localStorage.removeItem("scrollstop-manifest");
  }, [manifest]);
  useEffect(() => {
    if (manifestObjectNaam) localStorage.setItem("scrollstop-manifest-naam", manifestObjectNaam);
    else localStorage.removeItem("scrollstop-manifest-naam");
  }, [manifestObjectNaam]);

  // ── Persist prompts, tab, images to localStorage
  useEffect(() => {
    if (prompts) localStorage.setItem("scrollstop-prompts", JSON.stringify(prompts));
    else localStorage.removeItem("scrollstop-prompts");
  }, [prompts]);
  useEffect(() => { localStorage.setItem("scrollstop-tab", activeTab); }, [activeTab]);

  // ── Kie.ai image tweaks
  const [kieCleanBg, setKieCleanBg] = useState(true);
  const [kieExtraPrompt, setKieExtraPrompt] = useState("");
  const [kieRefStrength, setKieRefStrength] = useState(0.85);

  // ── Kie.ai video prompt (editable)
  const [kieVideoPrompt, setKieVideoPrompt] = useState("");
  const [videoTransitiePreset, setVideoTransitiePreset] = useState("assembly");
  const [videoTransitieDropdownOpen, setVideoTransitieDropdownOpen] = useState(false);

  // ── Kie.ai state
  const [kieStartFrame, setKieStartFrame] = useState("");
  const [kieEndFrame, setKieEndFrame] = useState("");
  const [kieDuration, setKieDuration] = useState(5);
  const [kieLoading, setKieLoading] = useState(false);
  const [kieVideoUrl, setKieVideoUrl] = useState<string | null>(null);
  const [kieError, setKieError] = useState("");
  const kiePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [kieImgLoading, setKieImgLoading] = useState<Record<"A" | "B", boolean>>({ A: false, B: false });
  const [kieImgUrl, setKieImgUrl] = useState<Record<"A" | "B", string | null>>(() => {
    if (typeof window === "undefined") return { A: null, B: null };
    try { const s = localStorage.getItem("scrollstop-kie-imgs"); return s ? JSON.parse(s) : { A: null, B: null }; } catch { return { A: null, B: null }; }
  });
  const [kieImgError, setKieImgError] = useState<Record<"A" | "B", string>>({ A: "", B: "" });
  const kieImgPollingRef = useRef<Record<"A" | "B", ReturnType<typeof setInterval> | null>>({ A: null, B: null });

  // Persist kieImgUrl to localStorage
  useEffect(() => { localStorage.setItem("scrollstop-kie-imgs", JSON.stringify(kieImgUrl)); }, [kieImgUrl]);

  // Auto-fill video frame URLs when images are generated
  // Video flow: B → A, so B = start frame, A = end frame
  useEffect(() => { if (kieImgUrl.A) setKieEndFrame(kieImgUrl.A); }, [kieImgUrl.A]);
  useEffect(() => { if (kieImgUrl.B) setKieStartFrame(kieImgUrl.B); }, [kieImgUrl.B]);

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
  const [gallerySearch, setGallerySearch] = useState("");
  const [galleryTagFilter, setGalleryTagFilter] = useState("");
  const [galleryProjectFilter, setGalleryProjectFilter] = useState("");
  const [galleryFavFilter, setGalleryFavFilter] = useState(false);
  const [galleryView, setGalleryView] = useState<"grid" | "project">("grid");
  const [galleryAllTags, setGalleryAllTags] = useState<string[]>([]);
  const [gallerySelected, setGallerySelected] = useState<Set<number>>(new Set());
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);

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
        const data = await res.json() as { items: GalleryItem[]; allTags: string[] };
        setGallery(data.items);
        setGalleryAllTags(data.allTags ?? []);
      }
    } catch { /* ignore */ }
    setGalleryLoading(false);
  }, []);

  // Load projects for dropdown
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projecten");
      if (res.ok) {
        const data = await res.json() as { projecten: ProjectOption[] };
        setProjectOptions(data.projecten ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadGallery(); loadProjects(); }, [loadGallery, loadProjects]);

  // Resume FAL video polling after refresh (with 15 min timeout)
  useEffect(() => {
    const pending = localStorage.getItem("fal-video-pending");
    if (pending) {
      try {
        const parsed = JSON.parse(pending) as { statusUrl: string; responseUrl: string; startedAt?: number };
        const age = Date.now() - (parsed.startedAt ?? 0);
        if (age > 15 * 60 * 1000) {
          // Older than 15 minutes — clean up, it's stuck
          localStorage.removeItem("fal-video-pending");
        } else if (parsed.statusUrl && parsed.responseUrl) {
          startFalPolling(parsed.statusUrl, parsed.responseUrl);
        }
      } catch {
        localStorage.removeItem("fal-video-pending");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume Logo Kie.ai video polling after refresh (with 15 min timeout)
  useEffect(() => {
    const pending = localStorage.getItem("logo-video-pending");
    if (pending) {
      try {
        const parsed = JSON.parse(pending) as { taskId: string; startedAt?: number };
        const age = Date.now() - (parsed.startedAt ?? 0);
        if (age > 15 * 60 * 1000) {
          localStorage.removeItem("logo-video-pending");
        } else if (parsed.taskId) {
          setMode("logo-animatie");
          startLogoVideoPolling(parsed.taskId);
        }
      } catch {
        localStorage.removeItem("logo-video-pending");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume Kie.ai image polling after refresh (with 10 min timeout)
  useEffect(() => {
    for (const tab of ["A", "B"] as const) {
      const raw = localStorage.getItem(`kie-img-pending-${tab}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { taskId: string; startedAt?: number };
          const age = Date.now() - (parsed.startedAt ?? 0);
          if (age > 10 * 60 * 1000) {
            localStorage.removeItem(`kie-img-pending-${tab}`);
          } else {
            startKieImgPolling(tab, parsed.taskId);
          }
        } catch {
          // Old format — just taskId string
          startKieImgPolling(tab, raw);
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save to gallery (use ref to avoid stale closure in setInterval callbacks)
  const [gallerySaveStatus, setGallerySaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveToGallery = useCallback(async (url: string, type: "scroll-stop" | "logo-animatie", isVideo = false) => {
    setGallerySaveStatus("saving");
    const body: Record<string, string | undefined> = {
      type,
      productNaam: type === "scroll-stop" ? (prompts?.objectNaam ?? (input || "Scroll-Stop")) : (logoResult?.objectNaam ?? "Logo"),
    };
    if (isVideo) {
      body.videoUrl = url;
    } else {
      body.afbeeldingUrl = url;
    }
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

  // ── Save video to gallery
  const saveVideoToGallery = useCallback(async (videoUrl: string) => {
    const body: Record<string, string | undefined> = {
      type: "scroll-stop",
      productNaam: prompts?.objectNaam ?? (input || "Scroll-Stop Video"),
      videoUrl,
    };
    if (prompts) {
      body.eindEffect = eindEffect;
      body.promptVideo = prompts.promptC;
    }
    try {
      await fetch("/api/assets/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      loadGallery();
    } catch { /* ignore */ }
  }, [prompts, eindEffect, input, loadGallery]);
  const saveVideoToGalleryRef = useRef(saveVideoToGallery);
  useEffect(() => { saveVideoToGalleryRef.current = saveVideoToGallery; }, [saveVideoToGallery]);

  // ── Delete from gallery
  const deleteGalleryItem = useCallback(async (id: number) => {
    try {
      await fetch(`/api/assets/gallery?id=${id}`, { method: "DELETE" });
      setGallery(prev => prev.filter(item => item.id !== id));
      setGallerySelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch { /* ignore */ }
  }, []);

  const toggleFavoriet = useCallback(async (id: number, current: number | null) => {
    const newVal = current ? 0 : 1;
    try {
      await fetch("/api/assets/gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isFavoriet: newVal }),
      });
      setGallery(prev => prev.map(item => item.id === id ? { ...item, isFavoriet: newVal } : item));
    } catch { /* ignore */ }
  }, []);

  const updateGalleryProject = useCallback(async (id: number, projectId: number | null) => {
    try {
      await fetch("/api/assets/gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, projectId }),
      });
      loadGallery();
    } catch { /* ignore */ }
  }, [loadGallery]);

  const bulkAction = useCallback(async (action: "delete" | "project" | "tag", value?: string | number) => {
    const ids = Array.from(gallerySelected);
    if (ids.length === 0) return;
    if (action === "delete") {
      await fetch(`/api/assets/gallery?ids=${ids.join(",")}`, { method: "DELETE" });
    } else if (action === "project") {
      await fetch("/api/assets/gallery", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, projectId: value }) });
    } else if (action === "tag") {
      await fetch("/api/assets/gallery", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, addTag: value }) });
    }
    setGallerySelected(new Set());
    loadGallery();
  }, [gallerySelected, loadGallery]);

  const toggleSelect = useCallback((id: number) => {
    setGallerySelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
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

  // ── Reset: clear all state, keep gallery
  const resetScrollStop = () => {
    setInput("");
    setPrompts(null);
    setError("");
    setManifest("");
    setManifestObjectNaam("");
    setManifestStep("idle");
    setManifestOpen(true);
    setUploadedImage(null);
    setProductRefImage(null);
    setEindEffect("exploded");
    setOptimizing(false);
    setKieImgUrl({ A: null, B: null });
    setKieImgLoading({ A: false, B: false });
    setKieImgError({ A: "", B: "" });
    setKieStartFrame("");
    setKieEndFrame("");
    setKieVideoUrl(null);
    setKieError("");
    setKieExtraPrompt("");
    setGallerySaveStatus("idle");
    setActiveTab("A");
    setStijl("glass-morphism");
    setCustomStijl("");
    localStorage.removeItem("scrollstop-input");
    localStorage.removeItem("scrollstop-manifest");
    localStorage.removeItem("scrollstop-manifest-naam");
    localStorage.removeItem("scrollstop-stijl");
    localStorage.removeItem("scrollstop-custom-stijl");
  };

  // ── Get current style prompt text
  const getStijlPrompt = (): string => {
    if (stijl === "custom") return customStijl.trim();
    const found = VISUELE_STIJLEN.find(s => s.key === stijl);
    return found && "prompt" in found ? found.prompt : "";
  };

  // ── AI OPTIMIZE: Enrich input prompt + generate manifest in one call
  const optimizePrompt = async () => {
    if (!input.trim() && !uploadedImage) return;
    setOptimizing(true); setError("");
    const body: Record<string, string> = {};
    if (input.trim()) body.description = input;
    const stijlPrompt = getStijlPrompt();
    if (stijlPrompt) body.stylePrompt = stijlPrompt;
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

    const stijlPrompt = getStijlPrompt();
    let body: Record<string, string> = { eindEffect };
    if (stijlPrompt) body.stylePrompt = stijlPrompt;
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
    let prompt = tab === "A" ? prompts.promptA : prompts.promptB;
    // Append clean background instruction if enabled
    if (kieCleanBg) {
      prompt += "\n\nIMPORTANT: Pure clean white background (#FFFFFF). No shadows on background, no reflections, no other objects, no environment. Only the product itself on a perfectly white seamless backdrop.";
    }
    // Append user's extra instructions
    if (kieExtraPrompt.trim()) {
      prompt += `\n\nExtra instructions: ${kieExtraPrompt.trim()}`;
    }
    // When generating B, use A's image as reference for component consistency
    const refImageUrl = tab === "B" ? kieImgUrl.A : null;
    if (tab === "B") {
      prompt += "\n\nCRITICAL MATERIAL & COLOR CONSISTENCY:\n- Use EXACTLY the same materials as the assembled shot (same glass type, same metal finish, same colors)\n- The overall color palette, lighting temperature, and material finishes must be IDENTICAL to the assembled version\n- Do NOT change the material style — if assembled is frosted glass with chrome, the B view must also be frosted glass with chrome\n- Keep the same camera angle, perspective, and studio lighting setup\n- White background (#FFFFFF) must remain clean and consistent";
      if (refImageUrl) {
        prompt += "\n- Match the reference image EXACTLY in terms of component shapes, sizes, proportions, and colors\n- Each piece must look like it was carefully removed from the original — intact, not reshaped\n- Think of a real product being disassembled by a technician";
      }
    }
    setKieImgLoading(prev => ({ ...prev, [tab]: true }));
    setKieImgError(prev => ({ ...prev, [tab]: "" }));
    setKieImgUrl(prev => ({ ...prev, [tab]: null }));
    try {
      const body: Record<string, string | number> = { prompt };
      if (refImageUrl) {
        body.referenceImageUrl = refImageUrl;
        body.refStrength = kieRefStrength;
      }
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
      // Persist taskId for refresh recovery
      localStorage.setItem(`kie-img-pending-${tab}`, JSON.stringify({ taskId: data.taskId, startedAt: Date.now() }));
      startKieImgPolling(tab, data.taskId!);
    } catch {
      setKieImgError(prev => ({ ...prev, [tab]: "Er ging iets mis." }));
      setKieImgLoading(prev => ({ ...prev, [tab]: false }));
    }
  };

  const startKieImgPolling = (tab: "A" | "B", taskId: string) => {
    setKieImgLoading(prev => ({ ...prev, [tab]: true }));
    kieImgPollingRef.current[tab] = setInterval(async () => {
      try {
        const poll = await fetch(`/api/animaties/kie-image-status?taskId=${taskId}`);
        const result = await poll.json() as { status: string; imageUrl?: string; error?: string };
        if (result.status === "done" && result.imageUrl) {
          clearInterval(kieImgPollingRef.current[tab]!);
          setKieImgUrl(prev => ({ ...prev, [tab]: result.imageUrl! }));
          setKieImgLoading(prev => ({ ...prev, [tab]: false }));
          localStorage.removeItem(`kie-img-pending-${tab}`);
          saveToGalleryRef.current(result.imageUrl!, "scroll-stop");
        } else if (result.status === "failed") {
          clearInterval(kieImgPollingRef.current[tab]!);
          setKieImgError(prev => ({ ...prev, [tab]: result.error ?? "Generatie mislukt." }));
          setKieImgLoading(prev => ({ ...prev, [tab]: false }));
          localStorage.removeItem(`kie-img-pending-${tab}`);
        }
      } catch { /* retry next interval */ }
    }, 4000);
  };

  // ── FAL: Video generation (Kling O3 — start + end frame)
  const stopAllPolling = () => {
    if (kiePollingRef.current) { clearInterval(kiePollingRef.current); kiePollingRef.current = null; }
    if (logoKiePollingRef.current) { clearInterval(logoKiePollingRef.current); logoKiePollingRef.current = null; }
    if (kieImgPollingRef.current.A) { clearInterval(kieImgPollingRef.current.A); kieImgPollingRef.current.A = null; }
    if (kieImgPollingRef.current.B) { clearInterval(kieImgPollingRef.current.B); kieImgPollingRef.current.B = null; }
    setKieLoading(false);
    setLogoKieLoading(false);
    setKieImgLoading({ A: false, B: false });
    localStorage.removeItem("fal-video-pending");
    localStorage.removeItem("logo-video-pending");
    localStorage.removeItem("kie-img-pending-A");
    localStorage.removeItem("kie-img-pending-B");
  };

  const generateKieVideo = async () => {
    if (!kieStartFrame.trim() || !kieEndFrame.trim()) {
      setKieError("Genereer eerst afbeelding A en B. De video gaat van B (start) → A (eind).");
      return;
    }
    // Get prompt from preset or custom input
    let videoPrompt: string;
    if (kieVideoPrompt.trim()) {
      videoPrompt = kieVideoPrompt.trim();
    } else {
      const preset = VIDEO_TRANSITIE_PRESETS.find(p => p.key === videoTransitiePreset);
      videoPrompt = (preset && "prompt" in preset) ? preset.prompt : "Each component glides precisely into its correct position, mechanical snap-fit assembly. Static camera, white background, photorealistic.";
    }
    setKieLoading(true); setKieError(""); setKieVideoUrl(null);
    try {
      const res = await fetch("/api/animaties/fal-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: videoPrompt,
          startFrameUrl: kieStartFrame.trim(),
          endFrameUrl: kieEndFrame.trim(),
          duration: String(kieDuration),
        }),
      });
      const data = await res.json() as { requestId?: string; statusUrl?: string; responseUrl?: string; error?: string };
      if (!res.ok || data.error) { setKieError(data.error ?? "Fout."); setKieLoading(false); return; }
      // Save to localStorage so polling survives refresh
      const falReq = { statusUrl: data.statusUrl, responseUrl: data.responseUrl, startedAt: Date.now() };
      localStorage.setItem("fal-video-pending", JSON.stringify(falReq));
      startFalPolling(falReq.statusUrl!, falReq.responseUrl!);
    } catch {
      setKieError("Er ging iets mis."); setKieLoading(false);
    }
  };

  // Reusable FAL polling function
  const startFalPolling = (statusUrl: string, responseUrl: string) => {
    setKieLoading(true);
    const encodedStatus = encodeURIComponent(statusUrl);
    const encodedResponse = encodeURIComponent(responseUrl);
    kiePollingRef.current = setInterval(async () => {
      try {
        const poll = await fetch(`/api/animaties/fal-video-status?statusUrl=${encodedStatus}&responseUrl=${encodedResponse}`);
        const result = await poll.json() as { status: string; videoUrl?: string; error?: string };
        if (result.status === "done" && result.videoUrl) {
          clearInterval(kiePollingRef.current!);
          setKieVideoUrl(result.videoUrl);
          setKieLoading(false);
          localStorage.removeItem("fal-video-pending");
          saveVideoToGalleryRef.current(result.videoUrl);
        } else if (result.status === "failed") {
          clearInterval(kiePollingRef.current!);
          setKieError(result.error ?? "Generatie mislukt.");
          setKieLoading(false);
          localStorage.removeItem("fal-video-pending");
        }
      } catch { /* keep polling */ }
    }, 5000);
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

  // ── LOGO KIE: Video generation (image-to-video via Kie.ai runway with imageUrl)
  const generateLogoKieVideo = async () => {
    if (!logoResult) return;
    setLogoKieLoading(true); setLogoKieError(""); setLogoKieVideoUrl(null);
    try {
      // Get start frame URL — from manual input, uploaded image, or gallery pick
      let startFrameUrl = logoKieFirstFrame.trim();
      if (!startFrameUrl && logoImage?.base64) {
        // Upload the base64 image to get a public URL
        const uploadRes = await fetch("/api/assets/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: logoImage.base64, mediaType: logoImage.mediaType }),
        });
        const uploadData = await uploadRes.json() as { url?: string };
        if (uploadData.url) startFrameUrl = uploadData.url;
      }
      if (!startFrameUrl && logoImage?.preview?.startsWith("http")) {
        startFrameUrl = logoImage.preview;
      }

      const finalPrompt = `${logoResult.videoPrompt.slice(0, 450)}. CRITICAL: Clean white background (#FFFFFF) throughout. The object must match the reference image exactly.`;

      const res = await fetch("/api/animaties/kie-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          ...(startFrameUrl && { imageUrl: startFrameUrl }),
        }),
      });
      const data = await res.json() as { taskId?: string; error?: string };
      if (!res.ok || data.error) { setLogoKieError(data.error ?? "Fout."); setLogoKieLoading(false); return; }
      // Persist task for page refresh recovery
      localStorage.setItem("logo-video-pending", JSON.stringify({ taskId: data.taskId, startedAt: Date.now() }));
      startLogoVideoPolling(data.taskId!);
    } catch {
      setLogoKieError("Er ging iets mis."); setLogoKieLoading(false);
    }
  };

  const startLogoVideoPolling = (taskId: string) => {
    setLogoKieLoading(true);
    logoKiePollingRef.current = setInterval(async () => {
      try {
        const poll = await fetch(`/api/animaties/kie-video-status?taskId=${taskId}`);
        const result = await poll.json() as { status: string; videoUrl?: string; error?: string };
        if (result.status === "done" && result.videoUrl) {
          clearInterval(logoKiePollingRef.current!);
          setLogoKieVideoUrl(result.videoUrl);
          setLogoKieLoading(false);
          localStorage.removeItem("logo-video-pending");
          saveToGalleryRef.current(result.videoUrl, "logo-animatie", true);
        } else if (result.status === "failed") {
          clearInterval(logoKiePollingRef.current!);
          setLogoKieError(result.error ?? "Generatie mislukt.");
          setLogoKieLoading(false);
          localStorage.removeItem("logo-video-pending");
        }
      } catch { /* retry next interval */ }
    }, 4000);
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

  // Build B prompt based on selected end effect
  const buildBPrompt = (productDesc: string, stijlP: string, componentManifest?: string) => {
    const components = componentManifest ? `\n\nComponents:\n${componentManifest}\n` : "";
    const cleanBg = kieCleanBg ? " Pure white seamless backdrop, no shadows on background." : "";
    const consistency = " CRITICAL: Use EXACTLY the same materials, colors, finishes, and lighting as the assembled version. Do NOT change the material style or color palette — only change the arrangement/structure.";
    const base = `Professional product photography on pure white background (#FFFFFF). ${stijlP} Photorealistic, 16:9 aspect ratio.${cleanBg}${consistency}`;

    switch (eindEffect) {
      case "buildup":
        return `${base} Scattered particles, dust, and micro-fragments of ${productDesc} floating chaotically in space. Raw materials dispersed artistically. Some particles glow faintly with the object's colors.${components}`;
      case "xray":
        return `${base} X-ray cutaway view of ${productDesc}. Outer shell rendered as translucent glass/crystal, revealing complete internal structure. Cross-section showing internal mechanics. Internal parts in full color, outer shell ghostly translucent with blue-white tint.${components}`;
      case "wireframe":
        return `${base} ${productDesc} dissolving into wireframe mesh. 60% wireframe, 40% solid. Clean geometric mesh with glowing teal/cyan (#23C6B7) wireframe lines. Dissolve edge with floating triangular fragments.${components}`;
      case "glowup":
        return `${base} ${productDesc} glowing intensely from within. Warm golden/amber light radiates from every seam, joint, and gap. Surface details silhouetted against internal glow. Light rays emanate from gaps between components.${components}`;
      case "liquid":
        return `${base} ${productDesc} in liquid/melted state. Melted into beautiful liquid puddle retaining original colors and materials. Chrome-like liquid reflections, viscous drips and pools. Surface tension creates reflective pools.${components}`;
      case "scatter":
        return `${base} ${productDesc} shattered into hundreds of small pieces. Fragments radiate outward from center in freeze-frame explosion. Each shard retains color and material of its origin. High-speed photography aesthetic.${components}`;
      case "context":
        return `${base} ${productDesc} placed in its natural workspace/environment. Sitting on a real desk/workbench in realistic setting. Warm natural lighting, subtle depth of field with background bokeh. Product is the clear hero.${components}`;
      case "material":
        return `${base} ${productDesc} transformed into warm wood material with visible grain texture. Exact same shape and form, but every component is now rich wood. All details preserved but in organic wood material.${components}`;
      default: // exploded
        return componentManifest
          ? `${base} The following components are floating separated in space, each maintaining its EXACT original shape, size, color, and material:${components}Every component listed above must be visible, separated, and floating in an exploded view — spread apart along a vertical/diagonal axis.`
          : `${base} Professional exploded-view of ${productDesc}. Every component separated and floating — EXACT same shapes, sizes, proportions as assembled version.`;
    }
  };
  const tabConfig = {
    A: { label: prompts?.tabANaam ?? "Assembled Shot", icon: Image, instruction: "Genereer afbeelding A eerst (16:9)" },
    B: { label: prompts?.tabBNaam ?? effectLabel, icon: Layers, instruction: kieImgUrl.A ? "Afbeelding A wordt automatisch als referentie gebruikt" : "Genereer eerst afbeelding A als referentie" },
    C: { label: "Video Transitie", icon: Clapperboard, instruction: kieStartFrame && kieEndFrame ? "B → A: Kling O3 animeert van start naar eindframe" : "Genereer eerst afbeelding A en B" },
  } as const;

  const activePrompt = prompts
    ? activeTab === "A" ? prompts.promptA : activeTab === "B" ? prompts.promptB : prompts.promptC
    : "";

  const assetSteps = [
    { n: "1", icon: Image, label: "Genereer assembled shot (A)", sub: "AI optimaliseert je input → genereer afbeelding" },
    { n: "2", icon: Layers, label: `Genereer ${effectLabel.toLowerCase()} (B)`, sub: "A wordt automatisch als referentie meegegeven" },
    { n: "3", icon: Clapperboard, label: "Genereer video", sub: "A + B als start/end frame → video (5-10s)" },
    { n: "4", icon: Globe, label: "Download assets", sub: "Sla afbeeldingen en video op" },
  ];
  const websiteSteps = [
    { n: "5", icon: Code2, label: "VSCode → scroll-stop build", sub: "Zeg in Claude Code: \"scroll-stop build\" + geef het videobestand" },
    { n: "6", icon: Globe, label: "Website live", sub: "Skill bouwt automatisch de Apple-stijl scroll-website" },
  ];

  const canGenerateManifest = (inputType === "product" && input.trim()) || (inputType === "image" && uploadedImage);

  // ── Gallery filtered
  const filteredGallery = gallery.filter(g => {
    if (galleryFilter !== "all" && g.type !== galleryFilter) return false;
    if (galleryFavFilter && !g.isFavoriet) return false;
    if (galleryProjectFilter && String(g.projectId) !== galleryProjectFilter) return false;
    if (galleryTagFilter && !(g.tags ?? "").toLowerCase().includes(galleryTagFilter.toLowerCase())) return false;
    if (gallerySearch && !g.productNaam.toLowerCase().includes(gallerySearch.toLowerCase())) return false;
    return true;
  });

  const galleryByProject = filteredGallery.reduce<Record<string, GalleryItem[]>>((acc, item) => {
    const key = item.projectNaam ?? "Geen project";
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

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

      {/* Stappenplan — only scroll-stop */}
      {mode === "scroll-stop" && (
        <div className="mb-5 space-y-2">
          {/* Blok 1: Assets genereren (altijd zichtbaar) */}
          <div className="bg-autronis-card border border-autronis-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-autronis-border">
              <span className="flex items-center gap-2 text-sm font-semibold text-autronis-text-primary">
                <Zap className="w-4 h-4 text-autronis-accent" />
                Assets genereren
              </span>
            </div>
            <div className="px-4 py-3 grid grid-cols-4 gap-3">
              {assetSteps.map(({ n, icon: Icon, label, sub }) => (
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
          </div>

          {/* Blok 2: Website bouwen (inklapbaar, standaard dicht) */}
          <div className="border border-dashed border-autronis-border rounded-xl overflow-hidden opacity-60 hover:opacity-100 transition-opacity">
            <button
              onClick={() => setStepsOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-autronis-text-tertiary hover:text-autronis-text-secondary transition-all"
            >
              <span className="flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5" />
                Optioneel: bouw scroll-website
              </span>
              {stepsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {stepsOpen && (
              <div className="px-4 pb-3 grid grid-cols-2 gap-3 border-t border-dashed border-autronis-border pt-3">
                {websiteSteps.map(({ n, icon: Icon, label, sub }) => (
                  <div key={n} className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-md bg-autronis-border/50 flex items-center justify-center flex-shrink-0 text-xs font-black text-autronis-text-tertiary">{n}</div>
                    <div>
                      <p className="text-xs font-semibold text-autronis-text-secondary flex items-center gap-1">
                        <Icon className="w-3 h-3 text-autronis-text-tertiary" /> {label}
                      </p>
                      <p className="text-xs text-autronis-text-tertiary mt-0.5 leading-snug">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                <div className="space-y-2">
                  <button
                    onClick={() => logoFileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 py-5 bg-autronis-bg border border-dashed border-autronis-border rounded-lg text-autronis-text-tertiary hover:border-autronis-accent/50 hover:text-autronis-accent transition-all"
                  >
                    <Upload className="w-6 h-6" />
                    <span className="text-sm">Upload je logo, icoon of product afbeelding</span>
                    <span className="text-xs opacity-60">PNG, JPG, WEBP</span>
                  </button>
                  {/* URL input */}
                  <div className="flex gap-2">
                    <input
                      placeholder="Of plak een afbeelding URL..."
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const url = (e.target as HTMLInputElement).value.trim();
                          if (url) {
                            setLogoImage({ base64: "", mediaType: "image/png", preview: url });
                            (e.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                      className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50"
                    />
                    <button
                      onClick={() => {
                        const input = document.querySelector<HTMLInputElement>('input[placeholder="Of plak een afbeelding URL..."]');
                        const url = input?.value.trim();
                        if (url) {
                          setLogoImage({ base64: "", mediaType: "image/png", preview: url });
                          if (input) input.value = "";
                        }
                      }}
                      className="px-3 py-2 bg-autronis-bg border border-autronis-border rounded-lg text-xs text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/50 transition-all"
                    >
                      <Link className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Pick from gallery */}
                  {gallery.filter(g => g.afbeeldingUrl && !g.videoUrl).length > 0 && (
                    <div>
                      <p className="text-[10px] text-autronis-text-tertiary font-medium mb-1">Of kies uit galerij:</p>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {gallery.filter(g => g.afbeeldingUrl && !g.videoUrl).slice(0, 10).map(g => (
                          <button key={g.id} onClick={() => {
                            // Fetch the image and convert to base64 for the logo flow
                            const img = new window.Image();
                            img.crossOrigin = "anonymous";
                            img.onload = () => {
                              const canvas = document.createElement("canvas");
                              canvas.width = img.width;
                              canvas.height = img.height;
                              canvas.getContext("2d")?.drawImage(img, 0, 0);
                              const dataUrl = canvas.toDataURL("image/png");
                              setLogoImage({ base64: dataUrl.split(",")[1], mediaType: "image/png", preview: g.afbeeldingUrl! });
                            };
                            img.onerror = () => {
                              // Fallback: just set preview URL
                              setLogoImage({ base64: "", mediaType: "image/png", preview: g.afbeeldingUrl! });
                            };
                            img.src = g.afbeeldingUrl!;
                          }}
                            className="shrink-0 w-16 h-10 rounded border border-autronis-border hover:border-autronis-accent overflow-hidden transition-all">
                            <img src={g.afbeeldingUrl!} alt="" className="w-full h-full object-contain bg-white" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description + AI Optimize */}
            <div className="relative mb-3">
              <textarea
                value={logoInput}
                onChange={e => setLogoInput(e.target.value)}
                rows={3}
                placeholder="Beschrijf kort wat je wilt... bijv. 'de kabels moeten bewegen' of 'logo draait en licht op'"
                className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-4 py-3 pr-28 text-sm text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 transition-colors resize-none"
              />
              <button
                onClick={async () => {
                  if (!logoInput.trim() && !logoImage) return;
                  setOptimizing(true);
                  try {
                    const res = await fetch("/api/animaties/optimize-logo-prompt", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        description: logoInput.trim(),
                        tags: logoTags,
                        ...(logoImage?.base64 && { imageBase64: logoImage.base64, mediaType: logoImage.mediaType }),
                      }),
                    });
                    const data = await res.json() as { optimizedPrompt?: string; error?: string };
                    if (data.optimizedPrompt) setLogoInput(data.optimizedPrompt);
                  } catch { /* ignore */ }
                  setOptimizing(false);
                }}
                disabled={optimizing || (!logoInput.trim() && !logoImage)}
                className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-semibold hover:bg-purple-500/25 transition-all disabled:opacity-40"
              >
                {optimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                AI Optimize
              </button>
            </div>

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

            {/* Generate buttons */}
            <div className="flex justify-end gap-2">
              {logoLoading ? (
                <button onClick={stopGenerate} className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-all">
                  <X className="w-4 h-4" /> Stop
                </button>
              ) : (
                <>
                  <button onClick={generateLogo} disabled={!logoInput.trim() && !logoImage}
                    className="flex items-center gap-2 px-4 py-2.5 bg-autronis-bg border border-autronis-border text-autronis-text-secondary rounded-lg text-sm font-semibold hover:text-autronis-text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    <FileText className="w-4 h-4" /> Genereer prompt
                  </button>
                  <button
                    onClick={async () => {
                      if (!logoInput.trim() && !logoImage) return;
                      // First optimize the prompt if it's short
                      let videoPrompt = logoInput.trim();
                      if (videoPrompt.length < 100) {
                        setOptimizing(true);
                        try {
                          const optRes = await fetch("/api/animaties/optimize-logo-prompt", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              description: videoPrompt,
                              tags: logoTags,
                              ...(logoImage?.base64 && { imageBase64: logoImage.base64, mediaType: logoImage.mediaType }),
                            }),
                          });
                          const optData = await optRes.json() as { optimizedPrompt?: string };
                          if (optData.optimizedPrompt) {
                            videoPrompt = optData.optimizedPrompt;
                            setLogoInput(videoPrompt);
                          }
                        } catch { /* continue with original */ }
                        setOptimizing(false);
                      }
                      // Then generate the video directly via Kie.ai
                      setLogoKieLoading(true); setLogoKieError(""); setLogoKieVideoUrl(null);
                      try {
                        // Upload image to get a public URL for Kie.ai
                        let startFrameUrl = logoKieFirstFrame.trim();
                        if (!startFrameUrl && logoImage?.base64) {
                          const uploadRes = await fetch("/api/assets/upload", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ base64: logoImage.base64, mediaType: logoImage.mediaType }),
                          });
                          const uploadData = await uploadRes.json() as { url?: string };
                          if (uploadData.url) startFrameUrl = uploadData.url;
                        }
                        if (!startFrameUrl && logoImage?.preview?.startsWith("http")) {
                          startFrameUrl = logoImage.preview;
                        }

                        // Add white background + reference instruction to prompt
                        const finalPrompt = `${videoPrompt.slice(0, 450)}. CRITICAL: Clean white background (#FFFFFF) throughout. The object must match the reference image exactly — same shape, colors, materials, proportions.`;

                        const res = await fetch("/api/animaties/kie-video", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            prompt: finalPrompt,
                            ...(startFrameUrl && { imageUrl: startFrameUrl }),
                          }),
                        });
                        const data = await res.json() as { taskId?: string; error?: string };
                        if (!res.ok || data.error) { setLogoKieError(data.error ?? "Fout."); setLogoKieLoading(false); return; }
                        localStorage.setItem("logo-video-pending", JSON.stringify({ taskId: data.taskId, startedAt: Date.now() }));
                        startLogoVideoPolling(data.taskId!);
                      } catch {
                        setLogoKieError("Er ging iets mis."); setLogoKieLoading(false);
                      }
                    }}
                    disabled={logoKieLoading || (!logoInput.trim() && !logoImage)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-white rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {logoKieLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Video genereren...</> : <><Play className="w-4 h-4" /> Genereer video</>}
                  </button>
                </>
              )}
            </div>
            {logoError && <p className="mt-3 text-sm text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">{logoError}</p>}
            {logoKieError && <p className="mt-3 text-sm text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">{logoKieError}</p>}
            {logoKieVideoUrl && (
              <div className="mt-3 bg-autronis-card border border-autronis-border rounded-xl overflow-hidden p-4">
                <video src={logoKieVideoUrl} controls className="w-full rounded-lg border border-autronis-border" onError={() => setLogoKieVideoUrl(null)} />
                <a href={logoKieVideoUrl} download className="mt-2 flex items-center gap-1.5 text-xs text-autronis-accent hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /> Download video
                </a>
              </div>
            )}
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
                  <Play className="w-3.5 h-3.5 text-autronis-accent" /> Genereer video via Kie.ai (image-to-video)
                </p>
                <div className="mb-2">
                  <label className="text-[10px] text-autronis-text-tertiary font-medium mb-1 block">Start frame (je logo/product afbeelding)</label>
                  {logoKieFirstFrame ? (
                    <div className="relative group mb-1">
                      <img src={logoKieFirstFrame} alt="Start frame" className="w-full max-h-32 object-contain bg-white rounded-lg border border-green-500/50" />
                      <button onClick={() => setLogoKieFirstFrame("")} className="absolute top-1 right-1 p-1 bg-black/60 rounded-md text-white opacity-0 group-hover:opacity-100 transition-all">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 mb-1">
                      <input value={logoKieFirstFrame} onChange={e => setLogoKieFirstFrame(e.target.value)}
                        placeholder="Plak URL of kies uit galerij hieronder"
                        className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                      {gallery.filter(g => g.afbeeldingUrl && !g.videoUrl).length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {gallery.filter(g => g.afbeeldingUrl && !g.videoUrl).slice(0, 8).map(g => (
                            <button key={g.id} onClick={() => setLogoKieFirstFrame(g.afbeeldingUrl!)}
                              className="shrink-0 w-14 h-9 rounded border border-autronis-border hover:border-autronis-accent overflow-hidden transition-all">
                              <img src={g.afbeeldingUrl!} alt="" className="w-full h-full object-contain bg-white" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-autronis-text-tertiary mt-1">
                    De AI animeert vanuit deze afbeelding. Video duurt ~10 seconden en wordt automatisch opgeslagen.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={generateLogoKieVideo} disabled={logoKieLoading || !logoKieFirstFrame.trim()}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-autronis-accent text-white rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {logoKieLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Genereren...</> : <><Zap className="w-4 h-4" /> Genereer video</>}
                  </button>
                </div>
                {logoKieError && <p className="mt-2 text-xs text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">{logoKieError}</p>}
                {logoKieVideoUrl && (
                  <div className="mt-3">
                    <video src={logoKieVideoUrl} controls className="w-full rounded-lg border border-autronis-border" onError={() => setLogoKieVideoUrl(null)} />
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
                  onClick={() => { setEffectDropdownOpen(v => !v); setStijlDropdownOpen(false); }}
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

              {/* Stijl dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setStijlDropdownOpen(v => !v); setEffectDropdownOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 bg-autronis-bg border border-autronis-border rounded-lg text-sm text-autronis-text-primary hover:border-autronis-accent/50 transition-all"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-semibold">{VISUELE_STIJLEN.find(s => s.key === stijl)?.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-autronis-text-tertiary" />
                </button>
                {stijlDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-80 bg-autronis-card border border-autronis-border rounded-xl shadow-xl z-40 py-1 max-h-80 overflow-y-auto">
                    {VISUELE_STIJLEN.map(s => (
                      <button
                        key={s.key}
                        onClick={() => { setStijl(s.key); setStijlDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-autronis-bg transition-all ${
                          stijl === s.key ? "bg-purple-500/10" : ""
                        }`}
                      >
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${stijl === s.key ? "text-purple-400" : "text-autronis-text-primary"}`}>{s.label}</p>
                          <p className="text-xs text-autronis-text-tertiary">{s.desc}</p>
                        </div>
                        {stijl === s.key && <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom stijl tekstveld */}
              {stijl === "custom" && (
                <input
                  value={customStijl}
                  onChange={e => setCustomStijl(e.target.value)}
                  placeholder="Beschrijf je eigen stijl (materialen, kleuren, sfeer...)"
                  className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-purple-400/50"
                />
              )}

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

              {/* Generate prompts + reset buttons (right side) */}
              <div className="ml-auto flex gap-2">
                {(input.trim() || prompts || manifest) && (
                  <button onClick={resetScrollStop} className="flex items-center gap-2 px-4 py-2.5 bg-autronis-bg border border-autronis-border text-autronis-text-secondary rounded-lg text-sm font-semibold hover:text-autronis-text-primary hover:border-autronis-text-tertiary transition-all">
                    <RotateCcw className="w-4 h-4" /> Reset
                  </button>
                )}
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
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 bg-autronis-card border border-autronis-border text-autronis-text-secondary rounded-lg text-xs font-semibold hover:text-autronis-text-primary transition-all cursor-pointer">
                        <Upload className="w-3.5 h-3.5" /> Upload eigen
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = URL.createObjectURL(file);
                          setKieImgUrl(prev => ({ ...prev, [activeTab]: url }));
                          // Also save the file to gallery via upload
                          const reader = new FileReader();
                          reader.onload = () => {
                            const dataUrl = reader.result as string;
                            setKieImgUrl(prev => ({ ...prev, [activeTab]: dataUrl }));
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }} />
                      </label>
                      <button onClick={() => generateKieImage(activeTab)} disabled={kieImgLoading[activeTab]}
                        className="flex items-center gap-2 px-3 py-1.5 bg-autronis-accent text-white rounded-lg text-xs font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {kieImgLoading[activeTab] ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Genereren...</> : <><Zap className="w-3.5 h-3.5" /> Genereer</>}
                      </button>
                    </div>
                  </div>
                  {/* Tweaks: clean bg toggle + extra prompt */}
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => setKieCleanBg(!kieCleanBg)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${kieCleanBg ? "bg-white/10 border-white/20 text-white" : "bg-autronis-bg border-autronis-border text-autronis-text-tertiary hover:text-autronis-text-secondary"}`}
                    >
                      <span className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-all ${kieCleanBg ? "bg-autronis-accent border-autronis-accent" : "border-autronis-border"}`}>
                        {kieCleanBg && <Check className="w-2 h-2 text-white" />}
                      </span>
                      Witte achtergrond
                    </button>
                    <input
                      value={kieExtraPrompt}
                      onChange={(e) => setKieExtraPrompt(e.target.value)}
                      placeholder="Aanpassingen (bijv. meer detail, andere hoek, kleiner...)"
                      className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-1.5 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50"
                    />
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
                    <Play className="w-3.5 h-3.5 text-autronis-accent" /> Genereer video via FAL.ai (Kling O3 Pro)
                  </p>
                  {/* Start + End frame */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[10px] text-autronis-text-tertiary font-medium mb-1 block">Start frame (B — {EIND_EFFECTEN.find(e => e.key === eindEffect)?.label})</label>
                      <div className="flex items-center gap-2">
                        <input value={kieStartFrame} onChange={e => setKieStartFrame(e.target.value)}
                          placeholder="URL afbeelding B"
                          className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                        {kieStartFrame && <Check className="w-4 h-4 text-green-400 shrink-0" />}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-autronis-text-tertiary font-medium mb-1 block">Eind frame (A — Assembled)</label>
                      <div className="flex items-center gap-2">
                        <input value={kieEndFrame} onChange={e => setKieEndFrame(e.target.value)}
                          placeholder="URL afbeelding A"
                          className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                        {kieEndFrame && <Check className="w-4 h-4 text-green-400 shrink-0" />}
                      </div>
                    </div>
                  </div>
                  {/* Transitie preset dropdown */}
                  <div className="mb-2">
                    <label className="text-[10px] text-autronis-text-tertiary font-medium mb-1 block">Transitie stijl</label>
                    <div className="relative">
                      <button onClick={() => setVideoTransitieDropdownOpen(v => !v)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-autronis-bg border border-autronis-border rounded-lg text-xs text-autronis-text-primary hover:border-autronis-accent/50 transition-all">
                        <span className="font-semibold">{VIDEO_TRANSITIE_PRESETS.find(p => p.key === videoTransitiePreset)?.label}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-autronis-text-tertiary" />
                      </button>
                      {videoTransitieDropdownOpen && (
                        <div className="absolute bottom-full left-0 mb-1 w-full bg-autronis-card border border-autronis-border rounded-xl shadow-xl z-40 py-1 max-h-72 overflow-y-auto">
                          {VIDEO_TRANSITIE_PRESETS.map(p => (
                            <button key={p.key} onClick={() => { setVideoTransitiePreset(p.key); setVideoTransitieDropdownOpen(false); setKieVideoPrompt(""); }}
                              className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-autronis-bg transition-all ${videoTransitiePreset === p.key ? "bg-autronis-accent/10" : ""}`}>
                              <div className="flex-1">
                                <p className={`text-sm font-semibold ${videoTransitiePreset === p.key ? "text-autronis-accent" : "text-autronis-text-primary"}`}>{p.label}</p>
                                <p className="text-xs text-autronis-text-tertiary">{p.desc}</p>
                              </div>
                              {videoTransitiePreset === p.key && <Check className="w-4 h-4 text-autronis-accent shrink-0" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {videoTransitiePreset === "custom" && (
                    <div className="mb-2">
                      <input value={kieVideoPrompt} onChange={e => setKieVideoPrompt(e.target.value)}
                        placeholder="Beschrijf je eigen transitie..."
                        className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[5, 10].map(d => (
                        <button key={d} onClick={() => setKieDuration(d)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${kieDuration === d ? "bg-autronis-accent text-white" : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"}`}>
                          {d}s {d === 5 ? "(~€0,52)" : "(~€1,04)"}
                        </button>
                      ))}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {kieLoading && (
                        <button onClick={stopAllPolling} className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-all">
                          <X className="w-4 h-4" /> Stop
                        </button>
                      )}
                      <button onClick={generateKieVideo} disabled={kieLoading || !kieStartFrame.trim() || !kieEndFrame.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-autronis-accent text-white rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {kieLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Genereren...</> : <><Zap className="w-4 h-4" /> Genereer video</>}
                      </button>
                    </div>
                  </div>
                  {kieError && <p className="mt-2 text-xs text-autronis-danger bg-autronis-danger/10 border border-autronis-danger/20 rounded-lg px-3 py-2">{kieError}</p>}
                  {kieVideoUrl && (
                    <div className="mt-3">
                      <video src={kieVideoUrl} controls className="w-full rounded-lg border border-autronis-border" onError={() => setKieVideoUrl(null)} />
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
            <div className="space-y-5">
              <div className="flex-1 flex items-center justify-center py-6">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-xl bg-autronis-card border border-autronis-border flex items-center justify-center mx-auto mb-3">
                    <Wand2 className="w-6 h-6 text-autronis-text-tertiary" />
                  </div>
                  <p className="text-autronis-text-tertiary text-sm">Voer een product of URL in om te beginnen</p>
                </div>
              </div>

              {/* Quick image generator — generate A and B without full prompt flow */}
              <div className="bg-autronis-card border border-autronis-border rounded-xl p-4">
                <p className="text-sm font-semibold text-autronis-text-primary mb-1 flex items-center gap-2">
                  <Image className="w-4 h-4 text-autronis-accent" />
                  Snelle foto generator
                </p>
                <p className="text-xs text-autronis-text-tertiary mb-3">
                  Beschrijf je product kort → genereer A (assembled) en B ({EIND_EFFECTEN.find(e => e.key === eindEffect)?.label ?? "effect"}) direct.
                </p>
                <div className="flex gap-2 mb-3">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Bijv: glass morphism automation cube with chrome buttons and teal cables"
                    className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50"
                  />
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] text-autronis-text-tertiary">Referentie sterkte:</span>
                  <input type="range" min="0.5" max="0.95" step="0.01" value={kieRefStrength}
                    onChange={e => setKieRefStrength(parseFloat(e.target.value))}
                    className="w-32 h-1 accent-autronis-accent" />
                  <span className="text-[10px] font-mono text-autronis-text-secondary w-8">{kieRefStrength.toFixed(2)}</span>
                  <span className="text-[9px] text-autronis-text-tertiary">← meer uit elkaar | meer zoals origineel →</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* A — Assembled: select from gallery, paste URL, or generate */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-autronis-text-secondary">A — Assembled (referentie)</span>
                      <div className="flex items-center gap-1">
                        {kieImgUrl.A && (
                          <button onClick={() => setKieImgUrl(prev => ({ ...prev, A: null }))}
                            className="text-[10px] text-autronis-text-tertiary hover:text-red-400 transition-all">Wis</button>
                        )}
                        <button
                          onClick={async () => {
                            const productDesc = input.trim() || manifestObjectNaam || "product";
                            const stijlP = getStijlPrompt();
                            const fullPrompt = `Professional product photography of ${productDesc} centered in frame, shot from a 3/4 angle. Clean white background (#FFFFFF), fully assembled, pristine. ${stijlP} Photorealistic, 16:9, sharp focus, Apple-style product photography. No text, no other objects.${kieCleanBg ? " Pure white seamless backdrop." : ""}`;
                            const currentRef = kieImgUrl.A;
                            setKieImgLoading(prev => ({ ...prev, A: true }));
                            setKieImgError(prev => ({ ...prev, A: "" }));
                            const body: Record<string, string | number> = { prompt: fullPrompt };
                            if (currentRef) { body.referenceImageUrl = currentRef; body.refStrength = kieRefStrength; }
                            const res = await fetch("/api/animaties/kie-image", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(body),
                            });
                            const data = await res.json() as { taskId?: string; error?: string };
                            if (!res.ok || data.error) { setKieImgError(prev => ({ ...prev, A: data.error ?? "Fout" })); setKieImgLoading(prev => ({ ...prev, A: false })); return; }
                            kieImgPollingRef.current.A = setInterval(async () => {
                              const poll = await fetch(`/api/animaties/kie-image-status?taskId=${data.taskId}`);
                              const result = await poll.json() as { status: string; imageUrl?: string; error?: string };
                              if (result.status === "done" && result.imageUrl) {
                                clearInterval(kieImgPollingRef.current.A!);
                                setKieImgUrl(prev => ({ ...prev, A: result.imageUrl! }));
                                setKieImgLoading(prev => ({ ...prev, A: false }));
                                saveToGalleryRef.current(result.imageUrl!, "scroll-stop");
                              } else if (result.status === "failed") {
                                clearInterval(kieImgPollingRef.current.A!);
                                setKieImgError(prev => ({ ...prev, A: result.error ?? "Mislukt" }));
                                setKieImgLoading(prev => ({ ...prev, A: false }));
                              }
                            }, 4000);
                          }}
                          disabled={kieImgLoading.A}
                          className="flex items-center gap-1 px-2 py-1 bg-autronis-accent text-white rounded-md text-[10px] font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-40"
                        >
                          {kieImgLoading.A ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Genereer
                        </button>
                      </div>
                    </div>
                    {kieImgError.A && <p className="text-[10px] text-red-400 mb-1">{kieImgError.A}</p>}
                    {kieImgUrl.A ? (
                      <div className="relative group">
                        <img src={kieImgUrl.A} alt="A" className="w-full aspect-video object-contain bg-white rounded-lg border border-green-500/50" />
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-green-500/80 rounded text-[8px] font-bold text-white">REFERENTIE</div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <input
                          placeholder="Plak URL of kies uit galerij"
                          onChange={e => { if (e.target.value.trim()) setKieImgUrl(prev => ({ ...prev, A: e.target.value.trim() })); }}
                          className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-1.5 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                        <div className="flex gap-1 overflow-x-auto pb-1">
                          {gallery.filter(g => g.afbeeldingUrl && !g.videoUrl).slice(0, 6).map(g => (
                            <button key={g.id} onClick={() => setKieImgUrl(prev => ({ ...prev, A: g.afbeeldingUrl! }))}
                              className="shrink-0 w-14 h-9 rounded border border-autronis-border hover:border-autronis-accent overflow-hidden transition-all">
                              <img src={g.afbeeldingUrl!} alt="" className="w-full h-full object-contain bg-white" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Generate B */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="relative">
                        <button onClick={() => setEffectDropdownOpen(v => !v)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-autronis-text-secondary hover:text-autronis-accent transition-all">
                          B — {EIND_EFFECTEN.find(e => e.key === eindEffect)?.label ?? "Effect"}
                          <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                        {effectDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 w-64 bg-autronis-card border border-autronis-border rounded-xl shadow-xl z-40 py-1 max-h-56 overflow-y-auto">
                            {EIND_EFFECTEN.map(effect => (
                              <button key={effect.key} onClick={() => { setEindEffect(effect.key); setEffectDropdownOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-autronis-bg transition-all ${eindEffect === effect.key ? "bg-autronis-accent/10" : ""}`}>
                                <div className="flex-1">
                                  <p className={`text-[11px] font-semibold ${eindEffect === effect.key ? "text-autronis-accent" : "text-autronis-text-primary"}`}>{effect.label}</p>
                                  <p className="text-[9px] text-autronis-text-tertiary">{effect.desc}</p>
                                </div>
                                {eindEffect === effect.key && <Check className="w-3 h-3 text-autronis-accent flex-shrink-0" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          if (!input.trim() && !kieImgUrl.A) return;
                          setKieImgLoading(prev => ({ ...prev, B: true }));
                          setKieImgError(prev => ({ ...prev, B: "" }));

                          // Step 1: If we have image A, analyze it to get a component manifest
                          let componentManifest = manifest;
                          if (kieImgUrl.A && !componentManifest) {
                            try {
                              const manifestRes = await fetch("/api/animaties/generate-manifest", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ product: input.trim() || "product from reference image", imageUrl: kieImgUrl.A }),
                              });
                              const manifestData = await manifestRes.json() as { manifest?: string; objectNaam?: string };
                              if (manifestData.manifest) {
                                componentManifest = manifestData.manifest;
                                setManifest(manifestData.manifest);
                                setManifestObjectNaam(manifestData.objectNaam ?? "");
                                setManifestStep("ready");
                              }
                            } catch { /* continue without manifest */ }
                          }

                          // Step 2: Build a very specific B prompt using the manifest
                          const stijlP = getStijlPrompt();
                          const fullPrompt = buildBPrompt(input.trim() || "product", stijlP, componentManifest || undefined);

                          const body: Record<string, string | number> = { prompt: fullPrompt };
                          if (kieImgUrl.A) { body.referenceImageUrl = kieImgUrl.A; body.refStrength = kieRefStrength; }
                          const res = await fetch("/api/animaties/kie-image", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body),
                          });
                          const data = await res.json() as { taskId?: string; error?: string };
                          if (!res.ok || data.error) { setKieImgError(prev => ({ ...prev, B: data.error ?? "Fout" })); setKieImgLoading(prev => ({ ...prev, B: false })); return; }
                          kieImgPollingRef.current.B = setInterval(async () => {
                            const poll = await fetch(`/api/animaties/kie-image-status?taskId=${data.taskId}`);
                            const result = await poll.json() as { status: string; imageUrl?: string; error?: string };
                            if (result.status === "done" && result.imageUrl) {
                              clearInterval(kieImgPollingRef.current.B!);
                              setKieImgUrl(prev => ({ ...prev, B: result.imageUrl! }));
                              setKieImgLoading(prev => ({ ...prev, B: false }));
                              saveToGalleryRef.current(result.imageUrl!, "scroll-stop");
                            } else if (result.status === "failed") {
                              clearInterval(kieImgPollingRef.current.B!);
                              setKieImgError(prev => ({ ...prev, B: result.error ?? "Mislukt" }));
                              setKieImgLoading(prev => ({ ...prev, B: false }));
                            }
                          }, 4000);
                        }}
                        disabled={kieImgLoading.B || (!input.trim() && !kieImgUrl.A)}
                        className="flex items-center gap-1 px-2 py-1 bg-purple-500 text-white rounded-md text-[10px] font-semibold hover:bg-purple-600 transition-all disabled:opacity-40"
                      >
                        {kieImgLoading.B ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Genereer B
                      </button>
                    </div>
                    {kieImgError.B && <p className="text-[10px] text-red-400 mb-1">{kieImgError.B}</p>}
                    {kieImgUrl.B ? (
                      <img src={kieImgUrl.B} alt="B" className="w-full aspect-video object-contain bg-white rounded-lg border border-autronis-border" />
                    ) : (
                      <div className="w-full aspect-video bg-autronis-bg rounded-lg border border-dashed border-autronis-border flex items-center justify-center">
                        <span className="text-[10px] text-autronis-text-tertiary">{kieImgUrl.A ? "Klaar — genereer B met A als referentie" : "Genereer eerst A"}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Standalone video generator — always accessible */}
              <div className="bg-autronis-card border border-autronis-border rounded-xl p-4">
                <p className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
                  <Clapperboard className="w-4 h-4 text-autronis-accent" />
                  Direct video genereren (FAL.ai — Kling O3)
                </p>
                <p className="text-xs text-autronis-text-tertiary mb-3">
                  Klik op een foto uit je galerij of plak een URL.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {/* Start frame picker */}
                  <div>
                    <label className="text-[10px] text-autronis-text-tertiary font-medium mb-1 block">Start frame (B — effect)</label>
                    {kieStartFrame ? (
                      <div className="relative group">
                        <img src={kieStartFrame} alt="Start frame" className="w-full aspect-video object-contain bg-white rounded-lg border border-autronis-accent" />
                        <button onClick={() => setKieStartFrame("")} className="absolute top-1 right-1 p-1 bg-black/60 rounded-md text-white opacity-0 group-hover:opacity-100 transition-all">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <input value={kieStartFrame} onChange={e => setKieStartFrame(e.target.value)}
                          placeholder="Plak URL of klik een foto hieronder"
                          className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                        <div className="flex gap-1 overflow-x-auto pb-1">
                          {gallery.filter(g => g.afbeeldingUrl && !g.videoUrl).slice(0, 8).map(g => (
                            <button key={g.id} onClick={() => setKieStartFrame(g.afbeeldingUrl!)}
                              className="shrink-0 w-16 h-10 rounded border border-autronis-border hover:border-autronis-accent overflow-hidden transition-all">
                              <img src={g.afbeeldingUrl!} alt="" className="w-full h-full object-contain bg-white" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* End frame picker */}
                  <div>
                    <label className="text-[10px] text-autronis-text-tertiary font-medium mb-1 block">Eind frame (A — assembled)</label>
                    {kieEndFrame ? (
                      <div className="relative group">
                        <img src={kieEndFrame} alt="End frame" className="w-full aspect-video object-contain bg-white rounded-lg border border-green-500/50" />
                        <button onClick={() => setKieEndFrame("")} className="absolute top-1 right-1 p-1 bg-black/60 rounded-md text-white opacity-0 group-hover:opacity-100 transition-all">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <input value={kieEndFrame} onChange={e => setKieEndFrame(e.target.value)}
                          placeholder="Plak URL of klik een foto hieronder"
                          className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                        <div className="flex gap-1 overflow-x-auto pb-1">
                          {gallery.filter(g => g.afbeeldingUrl && !g.videoUrl).slice(0, 8).map(g => (
                            <button key={g.id} onClick={() => setKieEndFrame(g.afbeeldingUrl!)}
                              className="shrink-0 w-16 h-10 rounded border border-autronis-border hover:border-green-500 overflow-hidden transition-all">
                              <img src={g.afbeeldingUrl!} alt="" className="w-full h-full object-contain bg-white" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Transitie preset dropdown */}
                <div className="mb-2">
                  <label className="text-[10px] text-autronis-text-tertiary font-medium mb-1 block">Transitie stijl</label>
                  <div className="relative">
                    <button onClick={() => setVideoTransitieDropdownOpen(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-autronis-bg border border-autronis-border rounded-lg text-xs text-autronis-text-primary hover:border-autronis-accent/50 transition-all">
                      <span className="font-semibold">{VIDEO_TRANSITIE_PRESETS.find(p => p.key === videoTransitiePreset)?.label}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-autronis-text-tertiary" />
                    </button>
                    {videoTransitieDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-autronis-card border border-autronis-border rounded-xl shadow-xl z-40 py-1 max-h-72 overflow-y-auto">
                        {VIDEO_TRANSITIE_PRESETS.map(p => (
                          <button key={p.key} onClick={() => { setVideoTransitiePreset(p.key); setVideoTransitieDropdownOpen(false); setKieVideoPrompt(""); }}
                            className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-autronis-bg transition-all ${videoTransitiePreset === p.key ? "bg-autronis-accent/10" : ""}`}>
                            <div className="flex-1">
                              <p className={`text-sm font-semibold ${videoTransitiePreset === p.key ? "text-autronis-accent" : "text-autronis-text-primary"}`}>{p.label}</p>
                              <p className="text-xs text-autronis-text-tertiary">{p.desc}</p>
                            </div>
                            {videoTransitiePreset === p.key && <Check className="w-4 h-4 text-autronis-accent shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Custom prompt input (only for "custom" preset or to override) */}
                {videoTransitiePreset === "custom" && (
                  <div className="mb-2">
                    <input value={kieVideoPrompt} onChange={e => setKieVideoPrompt(e.target.value)}
                      placeholder="Beschrijf je eigen transitie..."
                      className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[5, 10].map(d => (
                      <button key={d} onClick={() => setKieDuration(d)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${kieDuration === d ? "bg-autronis-accent text-white" : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"}`}>
                        {d}s {d === 5 ? "(~€0,52)" : "(~€1,04)"}
                      </button>
                    ))}
                  </div>
                  <button onClick={generateKieVideo} disabled={kieLoading || !kieStartFrame.trim() || !kieEndFrame.trim()}
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
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* GALLERY                                                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mt-8 border-t border-autronis-border pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-autronis-accent" />
            <h2 className="text-lg font-bold">Galerij</h2>
            <span className="text-xs text-autronis-text-tertiary">({filteredGallery.length} items)</span>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-autronis-bg border border-autronis-border rounded-lg overflow-hidden">
              <button onClick={() => setGalleryView("grid")} className={`p-1.5 ${galleryView === "grid" ? "bg-autronis-accent text-white" : "text-autronis-text-tertiary hover:text-autronis-text-primary"}`}>
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setGalleryView("project")} className={`p-1.5 ${galleryView === "project" ? "bg-autronis-accent text-white" : "text-autronis-text-tertiary hover:text-autronis-text-primary"}`}>
                <LayoutList className="w-3.5 h-3.5" />
              </button>
            </div>
            <button onClick={loadGallery} className="p-1.5 text-autronis-text-tertiary hover:text-autronis-accent transition-all">
              <RefreshCw className={`w-4 h-4 ${galleryLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-autronis-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={gallerySearch} onChange={e => setGallerySearch(e.target.value)} placeholder="Zoek op naam..."
              className="pl-8 pr-3 py-1.5 bg-autronis-bg border border-autronis-border rounded-lg text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 w-44" />
          </div>
          {/* Type filter */}
          {(["all", "scroll-stop", "logo-animatie"] as const).map(filter => (
            <button key={filter} onClick={() => setGalleryFilter(filter)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${galleryFilter === filter ? "bg-autronis-accent text-white" : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"}`}>
              {filter === "all" ? "Alles" : filter === "scroll-stop" ? "Scroll-Stop" : "Logo"}
            </button>
          ))}
          {/* Favoriet filter */}
          <button onClick={() => setGalleryFavFilter(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${galleryFavFilter ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"}`}>
            <Star className={`w-3 h-3 ${galleryFavFilter ? "fill-yellow-400" : ""}`} /> Favorieten
          </button>
          {/* Project filter */}
          {projectOptions.length > 0 && (
            <select value={galleryProjectFilter} onChange={e => setGalleryProjectFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-autronis-bg border border-autronis-border rounded-lg text-xs text-autronis-text-primary focus:outline-none focus:border-autronis-accent/50">
              <option value="">Alle projecten</option>
              {projectOptions.map(p => <option key={p.id} value={String(p.id)}>{p.naam}</option>)}
            </select>
          )}
          {/* Tag filter */}
          {galleryAllTags.length > 0 && (
            <select value={galleryTagFilter} onChange={e => setGalleryTagFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-autronis-bg border border-autronis-border rounded-lg text-xs text-autronis-text-primary focus:outline-none focus:border-autronis-accent/50">
              <option value="">Alle tags</option>
              {galleryAllTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        {/* Bulk actions */}
        {gallerySelected.size > 0 && (
          <div className="flex items-center gap-2 mb-3 bg-autronis-accent/5 border border-autronis-accent/20 rounded-lg px-3 py-2">
            <CheckSquare className="w-4 h-4 text-autronis-accent" />
            <span className="text-xs font-semibold text-autronis-accent">{gallerySelected.size} geselecteerd</span>
            <div className="ml-auto flex items-center gap-2">
              {projectOptions.length > 0 && (
                <select onChange={e => { if (e.target.value) bulkAction("project", Number(e.target.value)); e.target.value = ""; }}
                  className="px-2 py-1 bg-autronis-bg border border-autronis-border rounded text-xs text-autronis-text-primary">
                  <option value="">Verplaats naar project...</option>
                  {projectOptions.map(p => <option key={p.id} value={String(p.id)}>{p.naam}</option>)}
                </select>
              )}
              <input placeholder="Tag toevoegen..." className="px-2 py-1 bg-autronis-bg border border-autronis-border rounded text-xs text-autronis-text-primary w-28 placeholder:text-autronis-text-tertiary"
                onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLInputElement).value) { bulkAction("tag", (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }} />
              <button onClick={() => bulkAction("delete")} className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs font-semibold text-red-400 hover:bg-red-500/20">
                <Trash2 className="w-3 h-3" /> Verwijder
              </button>
              <button onClick={() => setGallerySelected(new Set())} className="p-1 text-autronis-text-tertiary hover:text-autronis-text-primary">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {filteredGallery.length === 0 ? (
          <div className="text-center py-10 bg-autronis-card border border-autronis-border rounded-xl">
            <Image className="w-8 h-8 text-autronis-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-autronis-text-tertiary">Nog geen gegenereerde afbeeldingen</p>
            <p className="text-xs text-autronis-text-tertiary mt-1">Afbeeldingen worden automatisch opgeslagen als je ze genereert via Kie.ai</p>
          </div>
        ) : galleryView === "project" ? (
          /* Per-project grouped view */
          <div className="space-y-4">
            {Object.entries(galleryByProject).map(([projectName, items]) => (
              <details key={projectName} open className="bg-autronis-card border border-autronis-border rounded-xl overflow-hidden">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-autronis-bg/30 transition-all">
                  <FolderOpen className="w-4 h-4 text-autronis-accent" />
                  <span className="text-sm font-semibold text-autronis-text-primary">{projectName}</span>
                  <span className="text-xs text-autronis-text-tertiary">({items.length})</span>
                </summary>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3 border-t border-autronis-border">
                  {items.map(item => <GalleryCard key={item.id} item={item} selected={gallerySelected.has(item.id)} onSelect={toggleSelect} onFav={toggleFavoriet} onDelete={deleteGalleryItem} onLoad={loadGalleryItem} onProjectChange={updateGalleryProject} projects={projectOptions} />)}
                </div>
              </details>
            ))}
          </div>
        ) : (
          /* Grid view */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredGallery.map(item => <GalleryCard key={item.id} item={item} selected={gallerySelected.has(item.id)} onSelect={toggleSelect} onFav={toggleFavoriet} onDelete={deleteGalleryItem} onLoad={loadGalleryItem} onProjectChange={updateGalleryProject} projects={projectOptions} />)}
          </div>
        )}
      </div>
    </div>
  );
}
