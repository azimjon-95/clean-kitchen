/**
 * Clean Kitchen — Senior-level Russian/Uzbek kitchen voice correction
 *
 * Goals:
 *  - Fix common Web Speech / native STT errors for Russian kitchen terms
 *  - Handle incomplete phrases ("болонь...", "найди соус")
 *  - Strip voice commands ("найди", "покажи", "открой")
 *  - Map phonetic / colloquial variants to canonical dish names
 *  - Work offline (no paid APIs)
 */

/** Common STT mishearings → canonical forms (Russian kitchen) */
const STT_CORRECTIONS: [RegExp, string][] = [
  // Bolognese family
  [/\bболон[еэ][зс][еэ]?\b/gi, "болоньезе"],
  [/\bболонь[еэ]з\b/gi, "болоньезе"],
  [/\bболон[еэ]з\b/gi, "болоньезе"],
  [/\bболон[еэ]зе?\s*соус\b/gi, "соус болоньезе"],
  [/\bсоус\s*болон/gi, "соус болоньезе"],
  // Puttanesca
  [/\bпутанес[кц][оа]?\b/gi, "путанеско"],
  [/\bпутанеска\b/gi, "путанеско"],
  [/\bпутан[еэ]ск[оа]\b/gi, "путанеско"],
  // Omelette
  [/\bомлет[иы]?\b/gi, "омлет"],
  [/\bомлет\s*с\s*зелен/gi, "омлет с зеленью"],
  [/\bомлет\s*зелен/gi, "омлет с зеленью"],
  // Common dishes
  [/\bкрем\s*суп\b/gi, "крем-суп"],
  [/\bкремсуп\b/gi, "крем-суп"],
  [/\bшампин[ьй]он/gi, "шампиньон"],
  [/\bговядин[аы]\b/gi, "говядина"],
  [/\bкурин[аоыйяе]+\b/gi, "курица"],
  [/\bкуриц[аы]\b/gi, "курица"],
  // Units / numbers often mangled
  [/\bкилограм+ов?\b/gi, "кг"],
  [/\bграм+ов?\b/gi, "г"],
];

/** Voice command prefixes to strip */
const COMMAND_PREFIXES = [
  /^(найди|найти|найтите|покажи|показать|открой|открыть|дай|дайте|хочу|мне\s+нужен?|покажите|ищи|искать)\s+/i,
  /^(show|find|open|get|search)\s+/i,
  /^(топ|топчи|кўрсат|очиб\s+бер|топib\s+бер)\s+/i, // uz partial
];

/** Phonetic / colloquial aliases for dishes (expanded restaurant dictionary) */
const DISH_ALIASES: Record<string, string[]> = {
  "соус болоньезе": [
    "болоньезе", "болонез", "болоньез", "болонезе", "болоньезе соус",
    "соус болонез", "соус болоньез", "мясной соус", "болонский соус",
    "bolognese", "bolognaise"
  ],
  "соус путанеско": [
    "путанеско", "путанеска", "путанеско соус", "соус путанеска",
    "puttanesca"
  ],
  "омлет с зеленью": [
    "омлет", "омлетик", "омлет зелень", "омлет с зеленью",
    "яичница с зеленью", "омлет зеленью"
  ],
  "крем-суп грибной": [
    "крем суп", "кремсуп", "грибной суп", "суп грибной",
    "крем-суп", "суп с грибами"
  ],
  "салат овощной": [
    "овощной салат", "салат из овощей", "свежий салат", "салат"
  ],
  "куриная грудка": [
    "курица", "грудка", "куриная", "куринная грудка", "филе курицы"
  ]
};

/** Normalize Russian text for matching */
export function normalizeRu(value: string): string {
  return value
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .normalize("NFKD")
    .replace(/[ъь]/g, "")
    .replace(/['’`ʻʼ\-–—]/g, " ")
    .replace(/[^a-zа-я0-9ўқғҳ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Apply STT corrections */
export function correctSttText(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  // Strip voice commands
  for (const re of COMMAND_PREFIXES) {
    text = text.replace(re, "");
  }

  // Apply known STT error patterns
  for (const [pattern, replacement] of STT_CORRECTIONS) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\s+/g, " ").trim();
}

/** Expand query with alias variants for better matching */
export function expandQueryVariants(query: string): string[] {
  const norm = normalizeRu(query);
  if (!norm) return [];

  const variants = new Set<string>([norm, query.toLowerCase()]);

  // If query matches any alias, add the canonical name
  for (const [canonical, aliases] of Object.entries(DISH_ALIASES)) {
    const canNorm = normalizeRu(canonical);
    if (norm === canNorm || canNorm.includes(norm) || norm.includes(canNorm)) {
      variants.add(canNorm);
      aliases.forEach(a => variants.add(normalizeRu(a)));
    }
    for (const alias of aliases) {
      const aNorm = normalizeRu(alias);
      if (norm === aNorm || aNorm.startsWith(norm) || norm.startsWith(aNorm) || levenshtein(norm, aNorm) <= 2) {
        variants.add(canNorm);
        variants.add(aNorm);
      }
    }
  }

  return [...variants];
}

/** Classic Levenshtein */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 4) return 99;

  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, prevDiag + cost);
      prevDiag = temp;
    }
  }
  return prev[b.length];
}

/**
 * Score how well a recipe matches a (possibly incomplete / noisy) voice query.
 * Higher = better. Designed for kitchen noise + STT errors.
 */
export function scoreVoiceMatch(
  recipe: {
    name: string;
    category?: string;
    tags?: string[];
    ingredients?: { name: string }[];
    description?: string;
  },
  rawQuery: string
): number {
  const corrected = correctSttText(rawQuery);
  const variants = expandQueryVariants(corrected);
  if (!variants.length) return 0;

  const name = normalizeRu(recipe.name);
  const category = normalizeRu(recipe.category || "");
  const tags = normalizeRu((recipe.tags || []).join(" "));
  const ingredients = normalizeRu((recipe.ingredients || []).map(i => i.name).join(" "));
  const description = normalizeRu(recipe.description || "");
  const haystack = [name, category, tags, ingredients, description].join(" ");

  let best = 0;

  for (const q of variants) {
    if (!q) continue;

    // Exact name
    if (name === q) best = Math.max(best, 100);
    // Name contains query or query contains name (incomplete phrase)
    else if (name.includes(q) || q.includes(name)) best = Math.max(best, 92);
    // Prefix match (user said first part of dish name)
    else if (name.startsWith(q) || q.startsWith(name.slice(0, Math.min(6, name.length)))) {
      best = Math.max(best, 85);
    }

    // Token-level
    const qTokens = q.split(" ").filter(t => t.length >= 2);
    const nameTokens = name.split(" ").filter(Boolean);
    let tokenHits = 0;
    for (const qt of qTokens) {
      for (const nt of nameTokens) {
        if (nt === qt || nt.startsWith(qt) || qt.startsWith(nt)) {
          tokenHits++;
          break;
        }
        if (Math.min(nt.length, qt.length) >= 4 && levenshtein(nt, qt) <= 2) {
          tokenHits += 0.7;
          break;
        }
      }
    }
    if (qTokens.length) {
      const ratio = tokenHits / qTokens.length;
      best = Math.max(best, Math.round(ratio * 80));
    }

    // Fuzzy full-string
    if (q.length >= 4) {
      const dist = levenshtein(name, q);
      if (dist <= 1) best = Math.max(best, 90);
      else if (dist <= 2) best = Math.max(best, 75);
      else if (dist <= 3 && q.length >= 7) best = Math.max(best, 60);
    }

    // Ingredient / category hit
    if (haystack.includes(q)) best = Math.max(best, 55);
  }

  return best;
}

/**
 * Process raw STT result → corrected query + ranked recipe matches.
 */
export function processVoiceQuery<T extends {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
  ingredients?: { name: string }[];
  description?: string;
}>(rawTranscript: string, recipes: T[], minScore = 40): {
  corrected: string;
  matches: { recipe: T; score: number }[];
} {
  const corrected = correctSttText(rawTranscript);
  const scored = recipes
    .map(r => ({ recipe: r, score: scoreVoiceMatch(r, corrected) }))
    .filter(x => x.score >= minScore)
    .sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name, "ru"));

  return { corrected, matches: scored };
}
