/**
 * Закрытый словарь: распознанная фраза «притягивается» к реальным названиям блюд/ингредиентов.
 * Устойчиво к акценту и ошибкам распознавания: сравнение идёт по ФОНЕТИЧЕСКОМУ ключу
 * (редукция гласных, оглушение, ч/ш/щ, ц/с, ы/и и т.п.), а не по буквам.
 * Использует несколько вариантов распознавания (n-best) и возвращает решение:
 *   open — уверенно открыть карточку, choose — спросить «Вы имели в виду…», none — не найдено.
 */

const LAT: Record<string, string> = { a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "кс", y: "и", z: "з" };

const STOP = new Set(["найди", "найти", "покажи", "показать", "открой", "открыть", "дай", "хочу", "мне", "нужен", "нужна", "нужно", "ищи", "искать", "рецепт", "рецепта", "карту", "карта", "карточку", "блюдо", "пожалуйста", "а", "и", "в", "на", "с", "со", "из", "для", "по", "как", "приготовить", "сделать", "где", "есть", "это", "вот", "ну", "эм", "так", "мне", "про"]);

export function cleanText(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е")
    .replace(/[a-z]/g, (c) => LAT[c] ?? c)
    .replace(/[^а-я0-9\s-]/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

const VOICELESS = new Set("пфктсшщчцх".split(""));
const DEVOICE: Record<string, string> = { б: "п", в: "ф", г: "к", д: "т", ж: "ш", з: "с" };
const VOICE_PAIR: Record<string, string> = { п: "б", ф: "в", к: "г", т: "д", ш: "ж", с: "з" };

/** Фонетический ключ слова (для акцентной речи и ошибок распознавания) */
export function phonetic(word: string): string {
  let w = word.replace(/тс/g, "ц").replace(/тьс/g, "ц").replace(/ться/g, "ца").replace(/[ъь]/g, "");
  w = w.replace(/щ/g, "ш").replace(/ч/g, "ш").replace(/ц/g, "с").replace(/ж/g, "ш").replace(/х/g, "к");
  // оглушение на конце слова и перед глухим
  let out = "";
  for (let i = 0; i < w.length; i++) {
    let c = w[i];
    const next = w[i + 1];
    if (DEVOICE[c] && (!next || VOICELESS.has(next))) c = DEVOICE[c];
    else if (VOICE_PAIR[c] && next && "бвгджз".includes(next)) c = VOICE_PAIR[c]; // озвончение перед звонким (сбор → збор): нормируем к звонкому
    out += c;
  }
  // редукция гласных
  out = out.replace(/[ое]/g, (m) => (m === "о" ? "а" : "и")).replace(/[эыйя]/g, "и").replace(/ю/g, "у").replace(/ё/g, "а");
  return out.replace(/(.)\1+/g, "$1").replace(/\s+/g, " ").trim();
}

export function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const sim = (a: string, b: string) => (a || b ? 1 - lev(a, b) / Math.max(a.length, b.length) : 1);

type Entry = { id: string; kind: "name" | "alias" | "ingredient"; text: string; toks: string[]; ph: string[]; phFull: string };
export type VoiceRecipe = { id: string; name: string; category?: string; tags?: string[]; ingredients?: { name: string }[] };

export type Index = { entries: Entry[]; byId: Map<string, VoiceRecipe> };

const tokens = (s: string) => cleanText(s).split(" ").filter((t) => t && !STOP.has(t));

export function buildIndex(recipes: VoiceRecipe[]): Index {
  const entries: Entry[] = [];
  const add = (id: string, kind: Entry["kind"], text: string) => {
    const toks = tokens(text);
    if (!toks.length) return;
    const ph = toks.map(phonetic);
    entries.push({ id, kind, text, toks, ph, phFull: ph.join(" ") });
  };
  for (const r of recipes) {
    add(r.id, "name", r.name.replace(/^п\/ф\s*/i, ""));
    for (const t of r.tags ?? []) add(r.id, "alias", t);
    for (const i of r.ingredients ?? []) add(r.id, "ingredient", i.name.replace(/^п\/ф\s*/i, ""));
  }
  return { entries, byId: new Map(recipes.map((r) => [r.id, r])) };
}

/** Сходство запроса и записи: каждое слово запроса ищет лучшую пару среди слов записи */
function score(q: string[], e: Entry): number {
  if (!q.length) return 0;
  let sum = 0, matched = 0;
  const used = new Set<number>();
  for (const w of q) {
    let best = 0, bi = -1;
    e.ph.forEach((p, i) => {
      if (used.has(i)) return;
      let s = sim(w, p);
      // слово-начало («болонь» ~ «болоньезе») — частичное совпадение засчитывается, но слабее
      if (w.length >= 4 && p.startsWith(w)) s = Math.max(s, 0.86);
      if (s > best) { best = s; bi = i; }
    });
    if (best >= 0.6) { used.add(bi); sum += best; matched++; }
  }
  if (!matched) return 0;
  const avg = sum / matched;                              // качество совпавших слов
  const asked = matched / q.length;                       // доля сказанных слов, найденных в названии (лишние слова штрафуются мягко)
  const named = Math.min(1, matched / e.ph.length);      // доля слов названия, которые прозвучали
  return avg * (0.80 + 0.20 * asked) * (0.80 + 0.20 * named);
}

export type Candidate = { id: string; score: number; via: Entry["kind"]; matched: string };
export type Decision =
  | { kind: "open"; best: Candidate; list: Candidate[] }
  | { kind: "choose"; list: Candidate[] }
  | { kind: "none"; list: Candidate[] };

export const OPEN_SCORE = 0.84;
export const OPEN_GAP = 0.08;
export const MIN_SCORE = 0.62;

export function resolveVoice(alternatives: string[], index: Index): Decision {
  const best = new Map<string, Candidate>();
  alternatives.slice(0, 6).forEach((alt, rank) => {
    const q = tokens(alt).map(phonetic);
    if (!q.length) return;
    const weight = Math.pow(0.93, rank);
    for (const e of index.entries) {
      let s = score(q, e);
      // слитное/раздельное произнесение («чис кейк» ↔ «чизкейк», «панакота» ↔ «панна котта»)
      const qj = q.join(""), ej = e.ph.join("");
      if (qj.length >= 5 && ej.length >= 5) s = Math.max(s, sim(qj, ej) * 0.95);
      s *= weight;
      if (e.kind === "ingredient") s *= 0.82; // названия блюд важнее ингредиентов
      if (e.kind === "alias") s *= 0.97;
      const cur = best.get(e.id);
      if (!cur || s > cur.score) best.set(e.id, { id: e.id, score: s, via: e.kind, matched: e.text });
    }
  });
  const list = Array.from(best.values()).filter((c) => c.score >= MIN_SCORE).sort((a, b) => b.score - a.score).slice(0, 6);
  if (!list.length) return { kind: "none", list: [] };
  const [a, b] = list;
  if (a.via !== "ingredient" && a.score >= OPEN_SCORE && (!b || a.score - b.score >= OPEN_GAP)) return { kind: "open", best: a, list };
  return { kind: "choose", list };
}
