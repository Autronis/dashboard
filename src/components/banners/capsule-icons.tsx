import type { BannerIcon } from "@/types/content";

interface CapsuleIconProps {
  icon: BannerIcon;
  size?: number;
}

const NEON = "#2DD4A8";
const SW = "2";

export function CapsuleIcon({ icon, size = 32 }: CapsuleIconProps) {
  const s = size;

  switch (icon) {
    case "cog":
      // Real gear/cog icon matching the Lovable reference
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M10.5 2h3l.4 2.4a8 8 0 0 1 2.1 1.2l2.3-.8 1.5 2.6-1.9 1.6a8 8 0 0 1 0 2.4l1.9 1.6-1.5 2.6-2.3-.8a8 8 0 0 1-2.1 1.2L13.5 22h-3l-.4-2.4a8 8 0 0 1-2.1-1.2l-2.3.8-1.5-2.6 1.9-1.6a8 8 0 0 1 0-2.4L4.2 11l1.5-2.6 2.3.8a8 8 0 0 1 2.1-1.2Z" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" stroke={NEON} strokeWidth={SW} />
        </svg>
      );
    case "brain":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="5" x2="12" y2="18" stroke={NEON} strokeWidth="1" strokeDasharray="3,3" />
        </svg>
      );
    case "bar-chart":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="12" width="4" height="9" rx="1" stroke={NEON} strokeWidth={SW} />
          <rect x="10" y="7" width="4" height="14" rx="1" stroke={NEON} strokeWidth={SW} />
          <rect x="17" y="3" width="4" height="18" rx="1" stroke={NEON} strokeWidth={SW} />
        </svg>
      );
    case "link":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "lightbulb":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.22-1.2 4.16-3 5.2V17H9v-2.8A6 6 0 0 1 6 9a6 6 0 0 1 6-6z" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "target":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={NEON} strokeWidth={SW} />
          <circle cx="12" cy="12" r="6" stroke={NEON} strokeWidth={SW} />
          <circle cx="12" cy="12" r="2" stroke={NEON} strokeWidth={SW} />
        </svg>
      );
    case "git-branch":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <line x1="6" y1="3" x2="6" y2="15" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <circle cx="18" cy="6" r="3" stroke={NEON} strokeWidth={SW} />
          <circle cx="6" cy="18" r="3" stroke={NEON} strokeWidth={SW} />
          <path d="M18 9a9 9 0 0 1-9 9" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "zap":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );
    case "plug":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 22V12M5 12H2a10 10 0 0 0 20 0h-3" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <rect x="7" y="2" width="3" height="5" rx="1" stroke={NEON} strokeWidth={SW} />
          <rect x="14" y="2" width="3" height="5" rx="1" stroke={NEON} strokeWidth={SW} />
          <path d="M7 7v2a5 5 0 0 0 10 0V7" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "users":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <circle cx="9" cy="7" r="4" stroke={NEON} strokeWidth={SW} />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "euro":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M4 10h12M4 14h12" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <path d="M19.5 7.5A7 7 0 1 0 19.5 16.5" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "shield":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    case "database":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="5" rx="9" ry="3" stroke={NEON} strokeWidth={SW} />
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" stroke={NEON} strokeWidth={SW} />
        </svg>
      );
    case "mail":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke={NEON} strokeWidth={SW} />
          <path d="M2 7l10 7 10-7" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "globe":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={NEON} strokeWidth={SW} />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke={NEON} strokeWidth={SW} />
        </svg>
      );
    case "rocket":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2L4.5 16.5z" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "clock":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={NEON} strokeWidth={SW} />
          <polyline points="12 6 12 12 16 14" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "layers":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polygon points="12 2 2 7 12 12 22 7 12 2" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
          <polyline points="2 17 12 22 22 17" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="2 12 12 17 22 12" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "trending-up":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="17 6 23 6 23 12" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "cpu":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="9" y="9" width="6" height="6" stroke={NEON} strokeWidth={SW} />
          <rect x="4" y="4" width="16" height="16" rx="2" stroke={NEON} strokeWidth={SW} />
          <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "cloud":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke={NEON} strokeWidth={SW} />
          <line x1="16" y1="2" x2="16" y2="6" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <line x1="8" y1="2" x2="8" y2="6" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <line x1="3" y1="10" x2="21" y2="10" stroke={NEON} strokeWidth={SW} />
        </svg>
      );
    case "key":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="7.5" cy="15.5" r="5.5" stroke={NEON} strokeWidth={SW} />
          <path d="M21 2l-9.6 9.6M15.5 7.5l3 3L21 8l-3-3" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "heart":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    // ─── NEW ICONS ────────────────────────────────────────────────────────────
    case "workflow":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="5" cy="6" r="2" stroke={NEON} strokeWidth={SW} />
          <circle cx="19" cy="6" r="2" stroke={NEON} strokeWidth={SW} />
          <circle cx="12" cy="18" r="2" stroke={NEON} strokeWidth={SW} />
          <path d="M7 6h5M14 6h3M5 8v4l5 4M19 8v4l-5 4" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "api":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M8 6L3 12l5 6" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 6l5 6-5 6" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <line x1="13" y1="4" x2="11" y2="20" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "chat":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
          <line x1="8" y1="10" x2="16" y2="10" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <line x1="8" y1="13" x2="13" y2="13" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "check":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={NEON} strokeWidth={SW} />
          <path d="M8 12l3 3 5-5" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "settings":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke={NEON} strokeWidth={SW} />
          <circle cx="12" cy="12" r="3" stroke={NEON} strokeWidth={SW} />
        </svg>
      );
    case "search":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke={NEON} strokeWidth={SW} />
          <line x1="21" y1="21" x2="16.65" y2="16.65" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "star":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    case "diamond":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M2 12l4-8h12l4 8-10 10L2 12z" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
          <line x1="2" y1="12" x2="22" y2="12" stroke={NEON} strokeWidth={SW} />
          <line x1="6" y1="4" x2="9" y2="12" stroke={NEON} strokeWidth="1" strokeLinecap="round" />
          <line x1="18" y1="4" x2="15" y2="12" stroke={NEON} strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    case "code":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polyline points="16 18 22 12 16 6" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="8 6 2 12 8 18" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "truck":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="1" y="3" width="15" height="13" rx="1" stroke={NEON} strokeWidth={SW} />
          <path d="M16 8h4l3 5v3h-7V8z" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
          <circle cx="5.5" cy="18.5" r="2.5" stroke={NEON} strokeWidth={SW} />
          <circle cx="18.5" cy="18.5" r="2.5" stroke={NEON} strokeWidth={SW} />
        </svg>
      );
    case "building":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="2" width="12" height="20" rx="1" stroke={NEON} strokeWidth={SW} />
          <rect x="15" y="8" width="6" height="14" rx="1" stroke={NEON} strokeWidth={SW} />
          <line x1="3" y1="22" x2="21" y2="22" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <rect x="6" y="5" width="3" height="3" stroke={NEON} strokeWidth="1.5" />
          <rect x="10" y="5" width="3" height="3" stroke={NEON} strokeWidth="1.5" />
          <rect x="6" y="10" width="3" height="3" stroke={NEON} strokeWidth="1.5" />
          <rect x="10" y="10" width="3" height="3" stroke={NEON} strokeWidth="1.5" />
          <rect x="7" y="16" width="5" height="6" stroke={NEON} strokeWidth="1.5" />
        </svg>
      );
    case "chart-pie":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    case "filter":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    case "repeat":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polyline points="17 1 21 5 17 9" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <polyline points="7 23 3 19 7 15" stroke={NEON} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
        </svg>
      );
    case "send":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <line x1="22" y1="2" x2="11" y2="13" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    case "wifi":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M1.42 9a16 16 0 0 1 21.16 0" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <path d="M5 12.55a11 11 0 0 1 14.08 0" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" stroke={NEON} strokeWidth={SW} strokeLinecap="round" />
          <circle cx="12" cy="20" r="1" fill={NEON} />
        </svg>
      );
  }
}
