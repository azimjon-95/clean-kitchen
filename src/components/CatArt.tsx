/** Иллюстрации категорий: поварская тематика, плоский стиль, viewBox 64×64 */
const S = { width: "100%", height: "100%", viewBox: "0 0 64 64", "aria-hidden": true } as const;

/** Все блюда — поварской колпак на скрещённых ноже и вилке */
export const ArtAll = () => (
  <svg {...S}>
    <defs>
      <linearGradient id="ca-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9edf2" /><stop offset="1" stopColor="#a9b2bf" /></linearGradient>
      <linearGradient id="ca-hat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#eef0f4" /></linearGradient>
    </defs>
    {/* нож */}
    <g transform="rotate(32 32 40)"><path d="M29.5 24c5 1 6.500 8 5.500 22l-5.500 2z" fill="url(#ca-steel)" stroke="#8d97a5" strokeWidth="0.8" /><rect x="29" y="47" width="6" height="12" rx="2.800" fill="#7a4b2a" /><circle cx="32" cy="51" r="0.9" fill="#d9b48a" /><circle cx="32" cy="55" r="0.9" fill="#d9b48a" /></g>
    {/* вилка */}
    <g transform="rotate(-32 32 40)"><path d="M26.500 24v9a5.500 5.500 0 0 0 11 0v-9" fill="none" stroke="#98a2b0" strokeWidth="2" strokeLinecap="round" /><path d="M32 22v14M29.200 24v9M34.800 24v9" stroke="#98a2b0" strokeWidth="2" strokeLinecap="round" /><rect x="29.500" y="38" width="5" height="21" rx="2.500" fill="url(#ca-steel)" stroke="#8d97a5" strokeWidth="0.8" /></g>
    {/* колпак */}
    <g>
      <path d="M17 36c-5-1-7.500-6-5-10.500s8-5 11-2.800c1.500-5.500 7-8 11.500-6.500 3.200-3 9.500-2.500 11.500 2.500 5-1.800 10.500 1.800 9.800 7.200-.5 4.200-4 6.500-7.500 6.200" fill="url(#ca-hat)" stroke="#d9dde4" strokeWidth="1.200" />
      <path d="M19 33h26l-1.500 12a2 2 0 0 1-2 1.700H22.500a2 2 0 0 1-2-1.700z" fill="#fff" stroke="#d9dde4" strokeWidth="1.200" />
      <path d="M20.200 39h23.600l-.5 5H20.700z" fill="#f07a2e" />
      <path d="M25 30c0 4-.5 6-1 8M32 28c0 4 0 7 0 10M39 30c0 4 .5 6 1 8" stroke="#e3e6ec" strokeWidth="1.100" strokeLinecap="round" fill="none" />
    </g>
  </svg>
);

/** Супы — тарелка с супом, ложка и пар */
export const ArtSoup = () => (
  <svg {...S}>
    <defs>
      <linearGradient id="cs-bowl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e6dccf" /></linearGradient>
      <radialGradient id="cs-broth" cx=".5" cy=".4" r=".7"><stop offset="0" stopColor="#ffb347" /><stop offset="1" stopColor="#e8741c" /></radialGradient>
    </defs>
    <path d="M24 5c-3 3 2 5-1 9M32 3c-3 3 2 6-1 10M40 5c-3 3 2 5-1 9" stroke="#f1b98a" strokeWidth="2.200" strokeLinecap="round" fill="none" />
    <ellipse cx="32" cy="27" rx="22" ry="6.500" fill="url(#cs-bowl)" stroke="#d6c9b8" strokeWidth="1.200" />
    <ellipse cx="32" cy="27" rx="19" ry="4.800" fill="url(#cs-broth)" />
    <circle cx="23" cy="26.500" r="2.200" fill="#6ab04c" /><circle cx="30" cy="28" r="2" fill="#f7d794" /><circle cx="39" cy="26.500" r="2.300" fill="#e55039" /><circle cx="35" cy="29" r="1.500" fill="#6ab04c" /><circle cx="27" cy="29" r="1.300" fill="#fff" opacity=".7" />
    <path d="M10 28c0 11 8 18 22 18s22-7 22-18c-3 4.500-11 7-22 7s-19-2.500-22-7z" fill="url(#cs-bowl)" stroke="#d6c9b8" strokeWidth="1.200" />
    <path d="M26 46h12l2 6H24z" fill="#e6dccf" stroke="#d6c9b8" strokeWidth="1.200" />
    <rect x="20" y="52" width="24" height="4" rx="2" fill="#f0e8dc" stroke="#d6c9b8" strokeWidth="1.200" />
    <path d="M14 33c4 3 9 4.500 18 4.500" stroke="#f07a2e" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".55" />
  </svg>
);

/** Салаты — миска с зеленью, помидорами, огурцом и морковью */
export const ArtSalad = () => (
  <svg {...S}>
    <defs>
      <linearGradient id="ce-bowl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe9e0" /></linearGradient>
      <linearGradient id="ce-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8bd45a" /><stop offset="1" stopColor="#3f9b3a" /></linearGradient>
    </defs>
    <path d="M12 26c-4-8 2-15 9-13 2-6 11-8 15-2 6-3 13 2 11 9 5 1 7 7 4 11-5 2-35 2-39-5z" fill="url(#ce-leaf)" />
    <path d="M18 24c4-5 8-6 11-6M36 16c4 1 7 4 8 8M24 14c1 4 3 7 6 9" stroke="#2e7d32" strokeWidth="1.300" strokeLinecap="round" fill="none" opacity=".6" />
    <circle cx="22" cy="23" r="5" fill="#ef4b3d" /><path d="M20 20.500c1-1.500 3-1.500 4 0" stroke="#2e7d32" strokeWidth="1.500" strokeLinecap="round" fill="none" /><circle cx="20.500" cy="22" r="1.200" fill="#fff" opacity=".6" />
    <circle cx="41" cy="22" r="4.500" fill="#ef4b3d" /><circle cx="39.800" cy="20.600" r="1.100" fill="#fff" opacity=".6" />
    <circle cx="32" cy="21" r="5" fill="#d8f0a6" stroke="#6ab04c" strokeWidth="2" /><path d="M32 17.500v7M28.500 21h7" stroke="#6ab04c" strokeWidth="1" />
    <path d="M12 29h40c-.5 12-8 22-20 22S12.500 41 12 29z" fill="url(#ce-bowl)" stroke="#c4d3c6" strokeWidth="1.200" />
    <path d="M17 36c3 7 8 11 15 11" stroke="#8bd45a" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".5" />
    <rect x="22" y="51" width="20" height="5" rx="2.500" fill="#e8efe8" stroke="#c4d3c6" strokeWidth="1.200" />
    <path d="M50 12l5 12" stroke="#a9b2bf" strokeWidth="2.200" strokeLinecap="round" />
    <path d="M47 20c1 5 8 5 9 0" stroke="#a9b2bf" strokeWidth="2.200" strokeLinecap="round" fill="none" />
  </svg>
);

/** Основные блюда — стейк с гриль-полосами на сковороде, огонь и розмарин */
export const ArtMain = () => (
  <svg {...S}>
    <defs>
      <linearGradient id="cm-pan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5b6068" /><stop offset="1" stopColor="#2f3238" /></linearGradient>
      <linearGradient id="cm-steak" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b5562f" /><stop offset="1" stopColor="#7a2f17" /></linearGradient>
    </defs>
    <path d="M18 8c-3 4 3 5 0 10 5-2 7-6 4-10M30 6c-3 5 3 6 0 12 6-3 8-8 4-12" fill="#ff9f43" opacity=".9" />
    <path d="M23 10c-1 3 1 4 0 7 3-1 4-4 2-7z" fill="#ffd166" />
    <path d="M10 30c3-8 13-12 24-10 9 2 15 8 12 16-3 7-13 10-23 8-9-2-16-7-13-14z" fill="url(#cm-steak)" stroke="#5e2410" strokeWidth="1.200" />
    <path d="M17 26l12 14M24 23l12 14M32 22l11 12" stroke="#3b140a" strokeWidth="2.200" strokeLinecap="round" opacity=".75" />
    <path d="M16 33c4-5 12-8 20-6" stroke="#e08a5b" strokeWidth="1.600" strokeLinecap="round" fill="none" opacity=".6" />
    <path d="M6 42h40c0 6-4 9-9 9H15c-5 0-9-3-9-9z" fill="url(#cm-pan)" />
    <path d="M44 43h16c2 0 3 1.200 3 2.500S62 48 60 48H44z" fill="#2f3238" />
    <rect x="8" y="42" width="36" height="2.500" rx="1.200" fill="#767c86" />
    <g transform="rotate(-25 50 22)"><path d="M50 10v16" stroke="#3f8a3a" strokeWidth="1.500" strokeLinecap="round" /><path d="M50 12l-3-1.500M50 15l3-1.500M50 18l-3-1.500M50 21l3-1.500M50 24l-3-1.500" stroke="#4fa64a" strokeWidth="1.800" strokeLinecap="round" /></g>
    <circle cx="48" cy="34" r="1.200" fill="#f7d794" /><circle cx="54" cy="30" r="1" fill="#f7d794" />
  </svg>
);

/** Десерты — кусочек торта с кремом, вишней и клубникой */
export const ArtDessert = () => (
  <svg {...S}>
    <defs>
      <linearGradient id="cd-cream" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#ffe3ea" /></linearGradient>
      <linearGradient id="cd-choc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9a5a3a" /><stop offset="1" stopColor="#6b3a22" /></linearGradient>
    </defs>
    <ellipse cx="32" cy="55" rx="26" ry="4.500" fill="#fff" stroke="#f0d9df" strokeWidth="1.200" />
    <path d="M8 34l40-12v26L8 52z" fill="#fff3d6" stroke="#e8cf9c" strokeWidth="1.200" />
    <path d="M8 34l40-12v6L8 40z" fill="url(#cd-choc)" />
    <path d="M8 44l40-12v5L8 49z" fill="url(#cd-choc)" />
    <path d="M8 40l40-12v4L8 44z" fill="url(#cd-cream)" />
    <path d="M48 22l10 5v22l-10-1z" fill="#ffe9bd" stroke="#e8cf9c" strokeWidth="1.200" />
    <path d="M48 28l10 4v4l-10-3z" fill="#7a432a" />
    <path d="M8 34l40-12 10 5-38 12z" fill="url(#cd-cream)" stroke="#f0d9df" strokeWidth="1.200" />
    <path d="M14 34c0 4 3 4 3 1 0 4 3 4 3 0M24 31c0 4 3 4 3 1 0 4 3 4 3 0M34 28c0 4 3 4 3 1 0 4 3 4 3 0" stroke="#ffd0dc" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M30 20c2-6 5-8 9-8" stroke="#3f8a3a" strokeWidth="1.500" strokeLinecap="round" fill="none" />
    <circle cx="30" cy="25" r="5.200" fill="#d92b3a" /><circle cx="28.300" cy="23.400" r="1.400" fill="#fff" opacity=".7" />
    <path d="M44 20c2 1 4 3 4 6s-2 5-5 5-5-2-5-5 2-5 6-6z" fill="#ff5470" /><path d="M41 19l2-2 2 2" stroke="#3f8a3a" strokeWidth="1.600" strokeLinecap="round" fill="none" />
    <circle cx="42" cy="23" r=".7" fill="#ffe0a3" /><circle cx="45" cy="25" r=".7" fill="#ffe0a3" /><circle cx="42.500" cy="27.500" r=".7" fill="#ffe0a3" />
  </svg>
);

export const CAT_ART: Record<string, () => JSX.Element> = { all: ArtAll, soups: ArtSoup, salads: ArtSalad, main: ArtMain, desserts: ArtDessert };
