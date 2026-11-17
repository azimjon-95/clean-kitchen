/**
 * Clean Kitchen — o'zimizning SVG ikonlar to'plami (24×24, yumaloq uchli chiziqlar).
 * Tashqi kutubxonasiz: hammasi shu faylda chizilgan.
 */
import type { ReactNode, SVGProps } from "react";

type P = { size?: number; filled?: boolean } & Omit<SVGProps<SVGSVGElement>, "children">;

function Svg({ size = 22, children, ...rest }: { size?: number; children: ReactNode } & Omit<SVGProps<SVGSVGElement>, "children">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Logotip: oshpaz qalpog'i (to'ldirilgan, ikki ohangli) */
export function LogoChef({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M14 30.5c-4.2-.9-7-4.4-7-8.4 0-4.6 3.7-8.1 8.2-7.7C16.6 10.2 20 8 24 8s7.4 2.2 8.8 6.4c4.5-.4 8.2 3.1 8.2 7.7 0 4-2.8 7.5-7 8.4"
        fill="none" stroke="#F07A2E" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M14 30.5h20V39a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2v-8.5Z" fill="#F07A2E" />
      <path d="M14 35h20" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 9.5a6 6 0 1 1 12 0c0 4.2 1.3 5.7 2 6.5H4c.7-.8 2-2.3 2-6.5Z" />
    <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
  </Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);
export const IconMic = ({ filled, ...p }: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" fill={filled ? "currentColor" : "none"} />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
  </Svg>
);
export const IconHome = ({ filled, ...p }: P) => (
  <Svg {...p}>
    <path d="M4 11.2 12 4l8 7.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.2H9v5.2H5.5A1.5 1.5 0 0 1 4 19v-7.8Z" fill={filled ? "currentColor" : "none"} />
  </Svg>
);
export const IconBookmark = ({ filled, ...p }: P) => (
  <Svg {...p}>
    <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-4-6 4V5.5a1 1 0 0 1 1-1Z" fill={filled ? "currentColor" : "none"} />
  </Svg>
);
export const IconUser = ({ filled, ...p }: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8.2" r="3.6" fill={filled ? "currentColor" : "none"} />
    <path d="M4.8 20c.6-3.6 3.5-5.6 7.2-5.6s6.6 2 7.2 5.6" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconBack = (p: P) => (
  <Svg {...p}>
    <path d="M15 5.5 8.5 12 15 18.5" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </Svg>
);
export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
  </Svg>
);
export const IconMore = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="5.5" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="12" cy="18.5" r="1.3" fill="currentColor" />
  </Svg>
);
/** Tarozi — «Чиқиш» */
export const IconScale = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v16M7 20h10M5 7h14" />
    <path d="M5 7 2.5 13a3 3 0 0 0 5 0L5 7ZM19 7l-2.5 6a3 3 0 0 0 5 0L19 7Z" />
  </Svg>
);
/** Quti — «Порция» */
export const IconBox = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
    <path d="m4 8.5 8 4.5 8-4.5M12 13v7" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.6 2.6 3.7 5.4 3.7 8.5s-1.1 5.9-3.7 8.5c-2.6-2.6-3.7-5.4-3.7-8.5S9.4 6.1 12 3.5Z" />
  </Svg>
);
export const IconVolume = (p: P) => (
  <Svg {...p}>
    <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z" />
    <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
  </Svg>
);
export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
  </Svg>
);
export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4" />
    <path d="M19.5 4.5v4h-4" />
  </Svg>
);
export const IconWifiOff = (p: P) => (
  <Svg {...p}>
    <path d="M3 3l18 18M8.5 16.2a5 5 0 0 1 7 0M5 12.7a10 10 0 0 1 3.2-2M10.6 6.2A14 14 0 0 1 21 10M12 19.5h.01" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMinus = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const IconFlame = (p: P) => (
  <Svg {...p}>
    <path d="M12 3c.5 3-2.5 4.5-2.5 7.5a2.5 2.5 0 0 0 5 0c0-.8-.3-1.5-.7-2 2.700 1.200 4.200 3.700 4.200 6.500A6 6 0 0 1 12 21a6 6 0 0 1-6-6c0-4.200 3.500-5.500 6-12Z" />
  </Svg>
);
export const IconFish = (p: P) => (
  <Svg {...p}>
    <path d="M3 12c3-4.500 7-6 11-5 2 .5 4 2.500 5.500 5-1.500 2.500-3.500 4.500-5.500 5-4 1-8-.5-11-5Z" />
    <path d="m19.500 12 2.500-3v6l-2.500-3ZM8 11h.01" />
  </Svg>
);
export const IconSnow = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v18M4.200 7.500l15.600 9M19.800 7.500l-15.600 9M9.500 4.500 12 6.500l2.500-2M9.500 19.500 12 17.500l2.500 2" />
  </Svg>
);
export const IconCake = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7Z" />
    <path d="M4 15.500c2 1.500 3.500 1.500 5 0s3-1.500 5 0 3.500 1.500 6 0M12 11V7.500M12 4.500c.8.800.8 1.700 0 2.500-.8-.8-.8-1.700 0-2.500Z" />
  </Svg>
);
export const IconUtensils = (p: P) => (
  <Svg {...p}>
    <path d="M7 3v7a2 2 0 0 0 4 0V3M9 3v18M17 21V3c-2.500 1.500-3.500 4.500-3.500 8H17" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.500 4.500 4.500L19 7.500" />
  </Svg>
);
export const IconHistory = (p: P) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.500-5.800" />
    <path d="M4 4.500v4h4M12 8v4.200l2.800 1.800" />
  </Svg>
);

/* ───────── Rangli kategoriya belgilari (bosh sahifadagi 4 ta tugma) ───────── */

export function TileAll({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <g stroke="#EF4B4B" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M9 5v7a3 3 0 0 0 6 0V5M12 5v22" />
        <path d="M23 27V5c-3.500 2-5 6-5 11h5" />
      </g>
    </svg>
  );
}
export function TileSauce({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <ellipse cx="18" cy="22" rx="14" ry="5" fill="#E8B27A" />
      <path d="M4 18h28a14 11 0 0 1-28 0Z" fill="#F4C58F" />
      <path d="M6.500 18.500c3-3.500 8-5 11.500-5s8.500 1.500 11.500 5c-3 2-7 3-11.500 3s-8.500-1-11.500-3Z" fill="#E4572E" />
      <circle cx="14" cy="17.500" r="1.200" fill="#C23B1B" />
      <circle cx="21" cy="18.500" r="1.400" fill="#C23B1B" />
      <path d="M17 10c-1.500-2 1-3.500 0-5.500 2.500 1.500 2.500 3.500 0 5.500Z" fill="#8FBF5B" />
    </svg>
  );
}
export function TileSalad({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <path d="M4 19h28c0 7.500-6 12-14 12S4 26.500 4 19Z" fill="#2F7D4F" />
      <path d="M7 19c0-4 3-7 6-7 1-2.500 4.500-3.500 7-2 3 0 6 2.500 6 6.500l-19 2.500Z" fill="#7CC36A" />
      <circle cx="13" cy="15" r="2.500" fill="#E8453C" />
      <circle cx="22.500" cy="14" r="2.200" fill="#F6C945" />
      <path d="M17 17c1.500-2 3.500-2 5 0" stroke="#3E9B52" strokeWidth="1.500" fill="none" strokeLinecap="round" />
    </svg>
  );
}
export function TileMain({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <path d="M26 20h8" stroke="#3A3A3A" strokeWidth="3.500" strokeLinecap="round" />
      <ellipse cx="15" cy="20" rx="12" ry="9" fill="#3A3A3A" />
      <ellipse cx="15" cy="18.500" rx="9.500" ry="6.200" fill="#C9672B" />
      <ellipse cx="12" cy="17" rx="3.200" ry="2.200" fill="#E8A15A" />
      <circle cx="18.500" cy="19" r="1.700" fill="#7CC36A" />
      <circle cx="14" cy="21" r="1.200" fill="#F6C945" />
    </svg>
  );
}

/* ───────── Qo'shimcha chiziqli ikonlar ───────── */
export const IconScan = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.5V6a2 2 0 0 1 2-2h2.500M15.500 4H18a2 2 0 0 1 2 2v2.500M20 15.500V18a2 2 0 0 1-2 2h-2.500M8.500 20H6a2 2 0 0 1-2-2v-2.500" />
    <rect x="8" y="9" width="8" height="6" rx="1.500" />
  </Svg>
);
export const IconLayers = (p: P) => (
  <Svg {...p}>
    <path d="m12 3.500 8.500 4.500-8.500 4.500L3.500 8 12 3.500Z" />
    <path d="m3.500 12.500 8.500 4.500 8.500-4.500M3.500 16.500l8.500 4.500 8.500-4.500" />
  </Svg>
);
export const IconCalc = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="3.500" width="14" height="17" rx="2.500" />
    <path d="M8.500 7.500h7M8.800 12h.01M12 12h.01M15.200 12h.01M8.800 15.500h.01M12 15.500h.01M15.200 15.500h.01" strokeWidth={2.400} />
  </Svg>
);
export const IconImport = (p: P) => (
  <Svg {...p}>
    <path d="M14 3.500H8a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l-4-4.500Z" />
    <path d="M13.500 3.500V8H18M9 12.500h6M9 16h4" />
  </Svg>
);
export const IconQr = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.500" height="6.500" rx="1.200" />
    <rect x="13.500" y="4" width="6.500" height="6.500" rx="1.200" />
    <rect x="4" y="13.500" width="6.500" height="6.500" rx="1.200" />
    <path d="M13.500 13.500h2.500v2.500h-2.500zM18 18h2M16 20h-2.500M20 13.500v2" />
  </Svg>
);
export const IconCloudDown = (p: P) => (
  <Svg {...p}>
    <path d="M7 18a4.500 4.500 0 0 1-.600-8.960A6 6 0 0 1 17.900 9.500 4.300 4.300 0 0 1 17.500 18" />
    <path d="M12 11.500v7.500m0 0-2.800-2.800M12 19l2.800-2.800" />
  </Svg>
);
export const IconCamera = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.500A1.500 1.500 0 0 1 5.500 7H8l1.200-2h5.600L16 7h2.500A1.500 1.500 0 0 1 20 8.500v9a1.500 1.500 0 0 1-1.500 1.500h-13A1.500 1.500 0 0 1 4 17.500v-9Z" />
    <circle cx="12" cy="12.500" r="3.300" />
  </Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19.500h14" />
  </Svg>
);
export const IconShare = (p: P) => (
  <Svg {...p}>
    <path d="M12 15V4m0 0L8.500 7.500M12 4l3.500 3.500M6 11.500v6A1.500 1.500 0 0 0 7.500 19h9a1.500 1.500 0 0 0 1.500-1.500v-6" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M5 7h14M10 7V4.500h4V7M7 7l.8 12h8.400L17 7M10.500 11v5M13.500 15.500" />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.500" />
    <path d="M12 11v5.500M12 7.800h.01" strokeWidth={2.400} />
  </Svg>
);
export const IconWifi = (p: P) => (
  <Svg {...p}>
    <path d="M3 9.500a14 14 0 0 1 18 0M6 13a9.500 9.500 0 0 1 12 0M9 16.500a5 5 0 0 1 6 0M12 20h.01" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4.500 12h15m0 0-6-6m6 6-6 6" />
  </Svg>
);

/* ───────── Rangli kategoriya belgilari (Все блюда / Супы / Салаты / Основные / Десерты) ───────── */
export function TileCloche({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs><linearGradient id="cl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F7A25C" /><stop offset="1" stopColor="#D8661F" /></linearGradient></defs>
      <rect x="3" y="30" width="34" height="4.500" rx="2.250" fill="#C9742E" />
      <path d="M6.500 30a13.500 13.500 0 0 1 27 0H6.500Z" fill="url(#cl)" />
      <circle cx="20" cy="14.500" r="2.800" fill="#C9742E" />
      <path d="M12 24.500a9 9 0 0 1 5-6.500" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".55" />
    </svg>
  );
}
export function TileSoup({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M4 18h32c0 9-7 15-16 15S4 27 4 18Z" fill="#EF5B6B" />
      <ellipse cx="20" cy="18" rx="16" ry="4.500" fill="#FBD48A" />
      <circle cx="15" cy="18" r="1.800" fill="#E8453C" />
      <circle cx="23" cy="17.500" r="1.500" fill="#6FBF5E" />
      <circle cx="27" cy="19" r="1.300" fill="#F59E3A" />
      <path d="M25 7c2.500 1.800-.5 3.500 1.500 6" stroke="#E8453C" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
export function TileSaladBowl({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M4 20h32c0 8.500-6.800 14-16 14S4 28.500 4 20Z" fill="#4EA865" />
      <path d="M7 20c0-4.500 3-8 7-8 1.500-3 5-4 8-2.500 3.500 0 6.500 3 6.500 7L7 20Z" fill="#9BD66E" />
      <circle cx="14" cy="16" r="2.700" fill="#F6C945" />
      <circle cx="25" cy="15" r="2.500" fill="#E8453C" />
      <circle cx="19" cy="14" r="2.200" fill="#B6E27B" />
    </svg>
  );
}
export function TileGrill({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="29" rx="17" ry="6" fill="#E8D5B8" />
      <path d="M6 24c2-8 10-11 18-9 8 2 11 7 8 11-3 3-12 4-19 2-4-1-7-2-7-4Z" fill="#E48B3D" />
      <path d="M13 22l5 5M19 19l6 6M25 17l5 5" stroke="#9B4F17" strokeWidth="2.200" strokeLinecap="round" />
      <circle cx="9" cy="30" r="2.300" fill="#7CC36A" />
      <circle cx="31" cy="30.500" r="2" fill="#E8453C" />
    </svg>
  );
}
export function TileCake({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M5 30V19l30-6v17c0 2-2 3-4 3H9c-2 0-4-1-4-3Z" fill="#FFE3A3" />
      <path d="M5 19l30-6v6L5 25v-6Z" fill="#E94F77" />
      <path d="M5 26l30-6" stroke="#fff" strokeWidth="2.200" />
      <path d="M5 19l30-6v3.500L5 22.500V19Z" fill="#fff" opacity=".85" />
      <circle cx="20" cy="12" r="4.500" fill="#E0273F" />
      <path d="M20 8c0-2 1.500-3 3-3.500" stroke="#3E9B52" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
