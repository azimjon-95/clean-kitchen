import { useState } from "react";
import type { Recipe } from "../types";

export type ArtKind =
  | "sauce" | "pasta" | "grill" | "soup" | "plov" | "sushi"
  | "salad" | "snack" | "dessert" | "pastry" | "base" | "egg";

export function artKind(r: Pick<Recipe, "name" | "category" | "section">): ArtKind {
  const s = `${r.name} ${r.category} ${r.section || ""}`.toLowerCase();
  if (/плов|osh|palov/.test(s)) return "plov";
  if (/омлет|яйц|завтрак/.test(s)) return "egg";
  if (/ролл|суши|сашими|нигири|sushi/.test(s)) return "sushi";
  if (/паста|спагетти|феттучине|лингвини/.test(s)) return "pasta";
  if (/суп|бульон/.test(s)) return "soup";
  if (/салат|ачичук/.test(s)) return "salad";
  if (/десерт|тирамису|чизкейк|торт/.test(s)) return "dessert";
  if (/круассан|выпечк|пекарн|хлеб/.test(s)) return "pastry";
  if (/гриль|мангал|шашлык|кебаб|грудк|стейк/.test(s)) return "grill";
  if (/закуск|брускетт|сыр/.test(s)) return "snack";
  if (/заготовк|крем|лук/.test(s)) return "base";
  if (/соус|sous/.test(s)) return "sauce";
  return "grill";
}

const BG: Record<ArtKind, [string, string]> = {
  sauce: ["#FFE9DA", "#FFD1B3"],
  pasta: ["#FFF1D6", "#FFDFA3"],
  grill: ["#FBE3D3", "#F5BFA0"],
  soup: ["#FFF4E0", "#FFE0B0"],
  plov: ["#FFF0D1", "#FBD58C"],
  sushi: ["#E8F3EC", "#C7E5D2"],
  salad: ["#E6F5E3", "#BFE4B8"],
  snack: ["#F6EDE0", "#E8D3B5"],
  dessert: ["#FDE7EE", "#F8C4D5"],
  pastry: ["#FFF0DC", "#F5D3A0"],
  base: ["#EEF0F6", "#D6DBEA"],
  egg: ["#FFF8D9", "#FFEC9E"]
};

function Plate() {
  return (
    <>
      <ellipse cx="160" cy="168" rx="104" ry="26" fill="#000" opacity=".07" />
      <ellipse cx="160" cy="150" rx="98" ry="38" fill="#fff" />
      <ellipse cx="160" cy="148" rx="80" ry="29" fill="#F4F1EC" />
    </>
  );
}
function Bowl({ fill, rim = "#fff" }: { fill: string; rim?: string }) {
  return (
    <>
      <ellipse cx="160" cy="176" rx="78" ry="12" fill="#000" opacity=".07" />
      <path d="M72 118h176c0 46-36 64-88 64s-88-18-88-64Z" fill={rim} />
      <ellipse cx="160" cy="118" rx="88" ry="22" fill="#EDE7DF" />
      <ellipse cx="160" cy="119" rx="78" ry="17" fill={fill} />
    </>
  );
}

function Art({ kind }: { kind: ArtKind }) {
  switch (kind) {
    case "sauce":
      return (
        <>
          <Bowl fill="#C8381E" />
          <ellipse cx="140" cy="117" rx="26" ry="6" fill="#E25A35" opacity=".8" />
          <circle cx="176" cy="120" r="5" fill="#9E2410" />
          <path d="M160 100c-12-8 4-18-2-30 16 8 16 20 2 30Z" fill="#5FAE4A" />
          <path d="M160 100c10-6 22-4 28-12-12-2-24 2-28 12Z" fill="#7CC36A" />
        </>
      );
    case "pasta":
      return (
        <>
          <Plate />
          <path d="M96 140c10-30 44-38 64-34 24-4 56 6 66 34-20 14-44 18-66 18s-46-4-64-18Z" fill="#F2C766" />
          <path d="M112 132c18-14 36-8 48 0s30 6 48-4M118 142c16-10 34-6 46 2s28 4 42-6" stroke="#D9A63F" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M140 124c12-10 28-10 40-2-10 10-30 12-40 2Z" fill="#C8381E" />
          <circle cx="164" cy="116" r="5" fill="#5FAE4A" />
        </>
      );
    case "grill":
      return (
        <>
          <Plate />
          <path d="M100 146c-6-22 18-42 52-42 38 0 62 14 58 38-4 20-30 28-58 28s-46-6-52-24Z" fill="#B5612B" />
          <path d="M118 128l24 22M146 120l30 28M178 120l24 20" stroke="#6E3512" strokeWidth="6" strokeLinecap="round" />
          <path d="M104 144c8 10 26 12 46 12" stroke="#D88B4A" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".6" />
          <circle cx="214" cy="146" r="9" fill="#7CC36A" />
          <circle cx="226" cy="154" r="7" fill="#E8453C" />
        </>
      );
    case "soup":
      return (
        <>
          <Bowl fill="#F3D9A8" />
          <path d="M120 118c14-8 28 4 42-2s24-6 38 0" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".8" />
          <circle cx="150" cy="122" r="4" fill="#C9A15B" />
          <circle cx="188" cy="118" r="3.500" fill="#C9A15B" />
          <path d="M138 92c-6-10 6-14 0-24M166 92c-6-10 6-14 0-24M194 92c-6-10 6-14 0-24" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".85" />
        </>
      );
    case "plov":
      return (
        <>
          <Plate />
          <path d="M104 146c4-30 24-52 56-52s52 22 56 52c-18 12-38 16-56 16s-38-4-56-16Z" fill="#F4C65A" />
          <path d="M126 130l8 4M150 116l6 6M176 120l8 2M196 134l8 2M140 142l8 2M168 138l8 2" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".7" />
          <path d="M132 122l12 4M178 112l10 6M190 128l12 2" stroke="#E8832C" strokeWidth="6" strokeLinecap="round" />
          <circle cx="160" cy="104" r="12" fill="#B5612B" />
          <circle cx="158" cy="102" r="4" fill="#D88B4A" />
        </>
      );
    case "sushi":
      return (
        <>
          <ellipse cx="160" cy="170" rx="110" ry="16" fill="#000" opacity=".06" />
          <rect x="54" y="150" width="212" height="14" rx="7" fill="#8A5A33" />
          {[104, 160, 216].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="140" rx="30" ry="12" fill="#2B2B2B" />
              <path d={`M${x - 30} 140v-22a30 12 0 0 1 60 0v22a30 12 0 0 1-60 0Z`} fill="#2B2B2B" />
              <ellipse cx={x} cy="118" rx="30" ry="12" fill="#fff" />
              <ellipse cx={x} cy="118" rx="18" ry="7" fill="#F28C5B" />
              <circle cx={x + 4} cy="118" r="4" fill="#7CC36A" />
            </g>
          ))}
        </>
      );
    case "salad":
      return (
        <>
          <Bowl fill="#6FBF5E" />
          <circle cx="132" cy="112" r="11" fill="#E8453C" />
          <circle cx="188" cy="110" r="10" fill="#F6C945" />
          <path d="M146 122c8-18 26-20 36-6-10 10-26 12-36 6Z" fill="#3E9B52" />
          <path d="M104 118c10-10 22-12 30-4" stroke="#3E9B52" strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx="164" cy="108" r="5" fill="#fff" opacity=".85" />
        </>
      );
    case "snack":
      return (
        <>
          <ellipse cx="160" cy="170" rx="104" ry="14" fill="#000" opacity=".06" />
          <rect x="62" y="96" width="196" height="68" rx="14" fill="#B98350" />
          <path d="M92 150l22-34 24 34Z" fill="#F6C945" />
          <circle cx="108" cy="140" r="3" fill="#E5A82A" />
          <rect x="152" y="112" width="34" height="34" rx="6" fill="#FFE18A" />
          <circle cx="226" cy="132" r="14" fill="#8B2F4F" />
          <circle cx="206" cy="150" r="10" fill="#6E1F3E" />
          <circle cx="240" cy="148" r="8" fill="#8B2F4F" />
        </>
      );
    case "dessert":
      return (
        <>
          <ellipse cx="160" cy="172" rx="92" ry="12" fill="#000" opacity=".07" />
          <path d="M92 150V112l76-28 64 22v44c0 8-8 12-20 12H112c-12 0-20-4-20-12Z" fill="#F6DDB0" />
          <path d="M92 124l76-28 64 22M92 140l76-28 64 22" stroke="#C9965A" strokeWidth="6" fill="none" strokeLinejoin="round" />
          <path d="M92 112l76-28 64 22-64 20-76-14Z" fill="#7A4A2B" />
          <circle cx="170" cy="96" r="9" fill="#D7304F" />
          <path d="M170 88c0-6 4-10 9-11" stroke="#3E9B52" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case "pastry":
      return (
        <>
          <ellipse cx="160" cy="172" rx="100" ry="12" fill="#000" opacity=".06" />
          <path d="M70 148c4-34 26-56 56-60 12-8 56-8 68 0 30 4 52 26 56 60-14 10-34 8-46-2-8 8-24 8-32 0-8 8-24 8-32 0-12 10-32 12-46 2Z" fill="#E5A04A" />
          <path d="M126 92l-8 54M160 86v62M194 92l8 54" stroke="#B9721F" strokeWidth="5" strokeLinecap="round" />
          <path d="M100 112c10-14 26-20 40-20" stroke="#F8CE86" strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      );
    case "egg":
      return (
        <>
          <Plate />
          <path d="M100 146c-4-26 20-42 56-42s64 14 62 38c-2 18-26 24-58 24s-56-4-60-20Z" fill="#FFD84D" />
          <path d="M120 136c14-8 30-8 44-2" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".6" />
          <path d="M150 128c6-10 16-10 22-2M184 140c6-6 14-6 18 0" stroke="#5FAE4A" strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      );
    case "base":
    default:
      return (
        <>
          <ellipse cx="160" cy="176" rx="64" ry="10" fill="#000" opacity=".07" />
          <rect x="108" y="84" width="104" height="88" rx="16" fill="#fff" opacity=".9" />
          <rect x="116" y="104" width="88" height="60" rx="10" fill="#E9B872" />
          <rect x="102" y="70" width="116" height="20" rx="8" fill="#9AA5C6" />
          <path d="M126 122c10-8 20-8 30 0s20 8 30 0" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".6" />
        </>
      );
  }
}

/** SVG illustratsiya (foto yo'q yoki yuklanmaganda) */
export function DishArt({ kind, className }: { kind: ArtKind; className?: string }) {
  const [a, b] = BG[kind];
  const id = `bg-${kind}`;
  return (
    <svg className={className} viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="320" height="220" fill={`url(#${id})`} />
      <circle cx="262" cy="42" r="46" fill="#fff" opacity=".28" />
      <circle cx="40" cy="190" r="34" fill="#fff" opacity=".22" />
      <Art kind={kind} />
    </svg>
  );
}

/** Real foto; yuklanguncha yoki xato bo'lsa SVG illyustratsiya ko'rinadi */
export function RecipeImage({ recipe, className = "" }: { recipe: Recipe; className?: string }) {
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");
  const kind = artKind(recipe);
  const showPhoto = !!recipe.imageUrl && state !== "fail";
  return (
    <div className={`rimg ${className}`}>
      <DishArt kind={kind} className="rimg-art" />
      {showPhoto && (
        <img
          className={state === "ok" ? "rimg-photo ok" : "rimg-photo"}
          src={recipe.imageUrl}
          alt={recipe.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setState("ok")}
          onError={() => setState("fail")}
        />
      )}
    </div>
  );
}
