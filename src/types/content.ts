export type InzichtCategorie = "projectervaring" | "learning" | "tool_review" | "trend" | "tip";

export const INZICHT_CATEGORIE_LABELS: Record<InzichtCategorie, string> = {
  projectervaring: "Projectervaring",
  learning: "Technische learning",
  tool_review: "Tool review",
  trend: "Trend",
  tip: "Tip",
};

export const INZICHT_CATEGORIE_COLORS: Record<InzichtCategorie, { bg: string; text: string }> = {
  projectervaring: { bg: "bg-blue-500/10", text: "text-blue-400" },
  learning: { bg: "bg-purple-500/10", text: "text-purple-400" },
  tool_review: { bg: "bg-green-500/10", text: "text-green-400" },
  trend: { bg: "bg-orange-500/10", text: "text-orange-400" },
  tip: { bg: "bg-autronis-accent/10", text: "text-autronis-accent" },
};

export interface ProfielEntry {
  id: number;
  onderwerp: string;
  inhoud: string;
  bijgewerktOp: string;
}

export interface Inzicht {
  id: number;
  titel: string;
  inhoud: string;
  categorie: InzichtCategorie;
  klantId?: number;
  projectId?: number;
  klantNaam?: string;
  projectNaam?: string;
  isGebruikt: boolean;
  aangemaaktDoor: number;
  aangemaaktOp: string;
}

// ============ VIDEO TYPES ============

// Duplicated from @/remotion/types to avoid importing remotion in server/type context
export interface Scene {
  tekst: string[];
  accentRegel?: number;
  accentKleur?: "turquoise" | "geel";
  icon?: string;
  duur?: number;
  isCta?: boolean;
}

export type VideoStatus = "script" | "rendering" | "klaar" | "fout";
export type VideoFormaat = "square" | "reels" | "feed" | "youtube";

export const VIDEO_FORMAAT_LABELS: Record<VideoFormaat, string> = {
  square: "Vierkant (1:1)",
  reels: "Reels (9:16)",
  feed: "Feed (4:5)",
  youtube: "YouTube (16:9)",
};

export interface ContentVideo {
  id: number;
  postId: number | null;
  titel?: string | null;
  templateId?: string | null;
  script: Scene[];
  status: VideoStatus;
  videoPath?: string | null;
  formaat?: VideoFormaat | null;
  duurSeconden?: number | null;
  aangemaaktOp: string | null;
  // Joined from post
  postTitel?: string;
  postPlatform?: string;
}

// ============ CONTENT TYPES ============

export type ContentPlatform = "linkedin" | "instagram";
export type ContentFormat = "post" | "caption" | "thought_leadership" | "tip" | "storytelling" | "how_to" | "vraag";
export type ContentStatus = "concept" | "goedgekeurd" | "bewerkt" | "afgewezen" | "gepubliceerd";

export interface ContentPost {
  id: number;
  titel: string;
  inhoud: string;
  platform: ContentPlatform;
  format: ContentFormat;
  status: ContentStatus;
  batchId?: string;
  batchWeek?: string;
  inzichtId?: number;
  bewerkteInhoud?: string;
  afwijsReden?: string;
  hashtags: string[];
  geplandOp?: string;
  gepubliceerdOp?: string;
  aangemaaktOp: string;
}

// ============ BANNER TYPES ============

export type BannerFormaat = "instagram" | "instagram_square" | "instagram_story" | "linkedin";
export type BannerStatus = "concept" | "klaar" | "fout";

export const BANNER_FORMAAT_SIZES: Record<BannerFormaat, { width: number; height: number; label: string }> = {
  instagram: { width: 1080, height: 1350, label: "Instagram (4:5)" },
  instagram_square: { width: 1080, height: 1080, label: "Instagram (1:1)" },
  instagram_story: { width: 1080, height: 1920, label: "Instagram Story (9:16)" },
  linkedin: { width: 1200, height: 627, label: "LinkedIn (1200x627)" },
};

export const BANNER_ICONS = [
  "cog", "brain", "bar-chart", "link", "lightbulb", "target", "git-branch", "zap",
  "plug", "users", "euro", "shield", "database", "mail", "globe", "rocket",
  "clock", "layers", "trending-up", "cpu", "cloud", "calendar", "key", "heart",
  "workflow", "api", "chat", "check", "settings", "search", "star", "diamond",
  "code", "truck", "building", "chart-pie", "filter", "repeat", "send", "wifi",
] as const;
export type BannerIcon = typeof BANNER_ICONS[number];

export const BANNER_ICON_LABELS: Record<BannerIcon, string> = {
  cog: "Tandwiel", brain: "Brein", "bar-chart": "Grafiek", link: "Koppeling",
  lightbulb: "Lamp", target: "Doel", "git-branch": "Vertakking", zap: "Bliksem",
  plug: "Stekker", users: "Gebruikers", euro: "Euro", shield: "Schild",
  database: "Database", mail: "E-mail", globe: "Wereld", rocket: "Raket",
  clock: "Klok", layers: "Lagen", "trending-up": "Stijgend", cpu: "Processor",
  cloud: "Cloud", calendar: "Kalender", key: "Sleutel", heart: "Hart",
  workflow: "Workflow", api: "API", chat: "Chat", check: "Vinkje",
  settings: "Instellingen", search: "Zoeken", star: "Ster", diamond: "Diamant",
  code: "Code", truck: "Transport", building: "Gebouw", "chart-pie": "Taartdiagram",
  filter: "Filter", repeat: "Herhalen", send: "Verzenden", wifi: "Wifi",
};

export const BANNER_ILLUSTRATIONS = [
  "gear", "brain", "nodes", "chart", "target", "flow", "circuit", "lightbulb",
  "puzzle", "cloud", "rocket", "calendar", "magnet", "handshake",
  "globe", "shield", "infinity", "dna", "matrix", "wave",
  "radar", "funnel", "server", "chatbot", "lock", "speedometer",
  "hierarchy", "pipeline", "antenna", "microscope", "diamond",
  "hourglass", "compass", "fingerprint", "telescope",
] as const;
export type BannerIllustration = typeof BANNER_ILLUSTRATIONS[number];

// PNG backgrounds disabled — using clean SVG illustrations instead
export const BANNER_ILLUSTRATION_BACKGROUNDS: Partial<Record<BannerIllustration, string>> = {};

export const BANNER_ILLUSTRATION_LABELS: Record<BannerIllustration, string> = {
  gear: "Mechanisme",
  brain: "Neuraal Netwerk",
  nodes: "Verbonden Netwerk",
  chart: "Data Dashboard",
  target: "Precisie Doel",
  flow: "Procesflow",
  circuit: "Circuit Board",
  lightbulb: "Innovatie",
  puzzle: "Puzzel",
  cloud: "Cloud Platform",
  rocket: "Groei & Lancering",
  calendar: "Planning",
  magnet: "Aantrekkingskracht",
  handshake: "Partnership",
  globe: "Wereldwijd",
  shield: "Beveiliging",
  infinity: "Automatisering",
  dna: "Structuur",
  matrix: "Data Matrix",
  wave: "Signaal",
  radar: "Radar Scan",
  funnel: "Sales Funnel",
  server: "Server Rack",
  chatbot: "Chatbot",
  lock: "Slot & Encryptie",
  speedometer: "Snelheidsmeter",
  hierarchy: "Organogram",
  pipeline: "Pipeline",
  antenna: "Zendmast",
  microscope: "Analyse",
  diamond: "Premium",
  hourglass: "Zandloper",
  compass: "Kompas",
  fingerprint: "Vingerafdruk",
  telescope: "Telescoop",
};

export interface ContentBanner {
  id: number;
  onderwerp: string;
  icon: BannerIcon;
  illustration: BannerIllustration;
  formaat: BannerFormaat;
  imagePath?: string;
  status: BannerStatus;
  aangemaaktOp: string;
}
