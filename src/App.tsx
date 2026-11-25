import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconArrowRight, IconBack, IconBell, IconBookmark, IconBox, IconCalc, IconCheck, IconChevronDown,
  IconChevronRight, IconClock, IconClose, IconCloudDown, IconFish, IconFlame, IconGlobe, IconHistory,
  IconHome, IconImport, IconLayers, IconLink, IconMic, IconMinus, IconMore, IconPlus, IconQr,
  IconRefresh, IconScale, IconScan, IconSearch, IconSnow, IconCake, IconUser, IconVolume, IconWifiOff,
  LogoChef, TileCake, TileCloche, TileGrill, TileSaladBowl, TileSoup
} from "./components/Icons";
import { Banner } from "./components/Banner";
import { RecipeImage, StepImg } from "./components/RecipeImage";
import {
  CalcScreen, NotificationsScreen, OfflineScreen, QrScreen, recipeLink
} from "./screens/Tools";
import { SmartScanner } from "./screens/Scanner";
import { saveFavorites, loadFavorites, createConnectivityWatcher } from "./lib/offline";
import { loadCachedFirst, loadRecipes } from "./lib/api";
import { startSpeech, type SpeechLang } from "./lib/speech";
import { processVoiceQuery, scoreVoiceMatch } from "./lib/voiceCorrect";
import { VoiceRecorder } from "./voice/capture";
import { serverSttEnabled, transcribeOnServer } from "./voice/stt";
import { buildIndex, resolveVoice } from "./voice/match";
import { MOCK_RECIPES } from "./data/mockRecipes";
import { can, hasFeature, canManage, type Me } from "./auth/client";
import { loadTenantRecipes, loadTenantCached, pushImport } from "./auth/recipes";
import { Manage } from "./platform/Manage";
import { CAT_ART } from "./components/CatArt";
import type { DataSource, Ingredient, Recipe } from "./types";

type Tab = "home" | "search" | "saved" | "categories" | "menu";
type View = null | "notifications" | "scan" | "calc" | "import" | "qr" | "offline" | "manage";
type DetailTab = "ingredients" | "technology" | "calculation";

const KITCHEN_DEPTS = [
  { name: "Горячий цех", icon: <IconFlame size={20} />, sections: ["Паста", "Мангал", "Соусы", "Раздача", "Заготовка"] },
  { name: "Суши", icon: <IconFish size={20} />, sections: ["Роллы", "Сашими / Нигири", "Заготовка"] },
  { name: "Холодный цех", icon: <IconSnow size={20} />, sections: ["Салаты", "Закуски", "Заготовка"] },
  { name: "Кондитерский", icon: <IconCake size={20} />, sections: ["Десерты", "Пекарный", "Заготовка"] }
];

type Group = { key: string; label: string; cats: string[] | null; tile: ReactNode; tone: string };
const GROUPS: Group[] = [
  { key: "all", label: "Все блюда", cats: null, tile: <TileCloche />, tone: "peach" },
  { key: "soups", label: "Супы", cats: ["Супы"], tile: <TileSoup />, tone: "sand" },
  { key: "salads", label: "Салаты", cats: ["Салаты"], tile: <TileSaladBowl />, tone: "mint" },
  { key: "main", label: "Основные", cats: ["Горячие блюда", "Роллы", "Сашими", "Нигири"], tile: <TileGrill />, tone: "rose" },
  { key: "desserts", label: "Десерты", cats: ["Десерты", "Выпечка"], tile: <TileCake />, tone: "pink" }
];

const VOICE_EXAMPLES = ["Борщ", "Плов", "Салат Цезарь"];
const UNIT_LABEL: Record<string, string> = { kg: "кг", g: "г", l: "л", ml: "мл", pcs: "шт" };
const nf3 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });
const nf2 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const RECENT_KEY = "ck-recent";
const DRAFTS_KEY = "ck-drafts";

function formatQty(ing: Ingredient, factor: number): string {
  if (ing.quantity == null || !ing.unit) return ing.amount || "—";
  let v = ing.quantity * factor;
  let u = UNIT_LABEL[ing.unit] || ing.unit;
  if (u === "г" && v >= 1000) { v /= 1000; u = "кг"; }
  else if (u === "мл" && v >= 1000) { v /= 1000; u = "л"; }
  return `${nf3.format(Number(v.toFixed(3)))} ${u}`;
}

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватный режим */ }
}

export default function App({ me = null, onLogout, onReloadMe }: { me?: Me | null; onLogout?: () => void; onReloadMe?: () => void }) {
  /** Возможности строятся из серверных permissions; без входа (демо) доступно всё, как раньше */
  const authed = !!me;
  const feat = (f: string) => !authed || hasFeature(me, f);
  const canCost = !authed || (!me!.flags.denyCost && can(me, "calculations", "view"));
  const canImport = !authed || can(me, "imports", "import");
  const [serverRecipes, setServerRecipes] = useState<Recipe[]>([]);
  const [drafts, setDrafts] = useState<Recipe[]>(() => readJson<Recipe[]>(DRAFTS_KEY, []));
  const [source, setSource] = useState<DataSource>("loading");
  const [apiError, setApiError] = useState<string | undefined>();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const [tab, setTab] = useState<Tab>("home");
  const [view, setView] = useState<View>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>(() => readJson<string[]>(RECENT_KEY, []));

  const [selected, setSelected] = useState<Recipe | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("ingredients");
  const [portions, setPortions] = useState(1);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState("");

  const [voiceOpen, setVoiceOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<SpeechLang>("ru-RU");
  const [voicePreview, setVoicePreview] = useState("");
  const [voiceMsg, setVoiceMsg] = useState("");
  const [voicePhase, setVoicePhase] = useState<"idle" | "listening" | "processing">("idle");
  const [voiceChoices, setVoiceChoices] = useState<{ id: string; name: string }[]>([]);
  const [voiceQ, setVoiceQ] = useState("");
  const waveRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<VoiceRecorder | null>(null);
  const runIdRef = useRef(0);
  const finishRef = useRef<null | (() => void)>(null);
  const stopRef = useRef<null | (() => void)>(null);

  const recipes = useMemo(() => [...drafts, ...serverRecipes], [drafts, serverRecipes]);
  const recipesRef = useRef<Recipe[]>([]);
  recipesRef.current = recipes;

  /* ───────── Данные ───────── */
  const sync = useCallback(async () => {
    const r = me ? await loadTenantRecipes(me) : await loadRecipes();
    setServerRecipes(r.recipes);
    setSource(r.source);
    setApiError(r.error);
    setLastSync(r.lastSync);
  }, [me]);

  useEffect(() => {
    loadFavorites().then((ids) => ids.length && setFavorites(ids));
    // сначала — карточки с устройства (мгновенно, даже без сети), затем обновление с сервера
    (me ? loadTenantCached() : loadCachedFirst()).then((c) => { if (c) { setServerRecipes((cur) => (cur.length ? cur : c.recipes)); setSource((s) => (s === "loading" ? "cache" : s)); setLastSync(c.lastSync); } });
    sync();
    // при возврате в приложение (после паузы > 5 мин) — тихое обновление
    let last = Date.now();
    const onVis = () => {
      if (document.visibilityState === "visible" && navigator.onLine && Date.now() - last > 5 * 60_000) { last = Date.now(); sync(); }
    };
    document.addEventListener("visibilitychange", onVis);
    const stop = createConnectivityWatcher((online) => {
      setIsOnline(online);
      if (online) sync();
    });
    return () => { document.removeEventListener("visibilitychange", onVis); stop(); };
  }, [sync]);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 1800);
  };

  /* ───────── Открытие карты ───────── */
  const openRecipe = useCallback((r: Recipe, startTab: DetailTab = "ingredients") => {
    setSelected(r);
    setDetailTab(startTab);
    setPortions(Math.max(1, r.portionCount || 1));
    setMoreOpen(false);
    setRecent((old) => {
      const next = [r.id, ...old.filter((x) => x !== r.id)].slice(0, 8);
      writeJson(RECENT_KEY, next);
      return next;
    });
    window.scrollTo({ top: 0 });
  }, []);

  // Ссылка/QR: ?recipe=<id>
  useEffect(() => {
    const rid = new URLSearchParams(window.location.search).get("recipe");
    if (!rid || !recipes.length) return;
    const found = recipes.find((r) => r.id === rid);
    if (found) {
      openRecipe(found);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [recipes, openRecipe]);

  const toggleFavorite = (id: string) =>
    setFavorites((old) => {
      const next = old.includes(id) ? old.filter((x) => x !== id) : [...old, id];
      saveFavorites(next).catch(() => {});
      return next;
    });

  /* ───────── Поиск и категории ───────── */
  const activeGroup = GROUPS.find((g) => g.key === group) || GROUPS[0];
  const countOf = useCallback((g: Group) => (g.cats ? recipes.filter((r) => g.cats!.includes(r.category)).length : recipes.length), [recipes]);

  const results = useMemo(() => {
    const q = query.trim();
    return recipes.filter((r) =>
      (!activeGroup.cats || activeGroup.cats.includes(r.category)) &&
      (!department || r.department === department) &&
      (!section || r.section === section) &&
      (!q || scoreVoiceMatch(r, q) >= 40)
    );
  }, [recipes, query, activeGroup, department, section]);

  const savedList = useMemo(() => recipes.filter((r) => favorites.includes(r.id)), [recipes, favorites]);
  const recentList = useMemo(() => {
    const byRecent = recent.map((id) => recipes.find((r) => r.id === id)).filter(Boolean) as Recipe[];
    if (byRecent.length >= 2) return { title: "Недавно открытые", items: byRecent };
    const pop = recipes.filter((r) => r.popular);
    return { title: byRecent.length ? "Недавно открытые" : "Популярные блюда", items: [...byRecent, ...(pop.length ? pop : recipes).filter((r) => !byRecent.includes(r))].slice(0, 8) };
  }, [recipes, recent]);

  const goSearch = (opts: { group?: string; dept?: string; sec?: string; q?: string } = {}) => {
    setGroup(opts.group ?? "all");
    setDepartment(opts.dept ?? "");
    setSection(opts.sec ?? "");
    setQuery(opts.q ?? "");
    setSelected(null);
    setView(null);
    setTab("search");
  };

  /* ───────── Голосовой поиск ───────── */
  /** Отмена: закрытие экрана / новый запрос — запись выбрасывается */
  const stopListening = useCallback(() => {
    runIdRef.current++;
    recRef.current?.cancel(); recRef.current = null;
    finishRef.current = null;
    stopRef.current?.();
    stopRef.current = null;
    setListening(false); setVoicePhase("idle");
  }, []);
  /** Нажатие на микрофон во время записи: закончить фразу и распознать */
  const finishListening = () => { if (finishRef.current) finishRef.current(); else stopListening(); };

  /** Показ результатов поиска по произнесённому тексту */
  const showSearch = useCallback((q: string) => {
    stopListening();
    setVoiceOpen(false);
    setGroup("all"); setDepartment(""); setSection("");
    setQuery(q); setSelected(null); setView(null); setTab("search");
  }, [stopListening]);

  /** Решение по всем вариантам распознавания: открыть / уточнить / показать список / не найдено */
  const handleVoiceAlternatives = useCallback((alts: string[]) => {
    const list = recipesRef.current;
    const index = buildIndex(list);
    const d = resolveVoice(alts, index);
    const text = alts[0] ?? "";
    setVoicePreview(text); setVoiceQ(text);
    if (d.kind === "open") {
      const r = list.find((x) => x.id === d.best.id);
      if (r) { stopListening(); setVoiceOpen(false); setView(null); setQuery(""); openRecipe(r); return; }
    }
    if (d.kind === "choose") {
      setVoiceChoices(d.list.slice(0, 4).map((c) => ({ id: c.id, name: list.find((x) => x.id === c.id)?.name ?? "" })).filter((c) => c.name));
      setVoiceMsg("Вы имели в виду:");
      return;
    }
    // слова общего поиска («супы», «с курицей») — прежний умный поиск
    const { corrected, matches } = processVoiceQuery(text, list, 45);
    if (matches.length > 0) { showSearch(corrected || text); return; }
    setVoiceMsg(`«${text}» не найдено. Скажите название блюда ещё раз.`);
  }, [openRecipe, stopListening, showSearch]);

  const setLevel = (db: number) => {
    const lvl = Math.max(0.18, Math.min(1, (db + 62) / 40));
    waveRef.current?.style.setProperty("--lvl", String(lvl));
  };

  const startListening = useCallback(async () => {
    const run = ++runIdRef.current;
    const alive = () => run === runIdRef.current;
    setVoiceMsg(""); setVoicePreview(""); setVoiceChoices([]); setVoiceQ("");
    setListening(true); setVoicePhase("listening");

    const lowMsg = (reason?: string) =>
      reason === "too-short" ? "Слишком коротко. Назовите блюдо целиком."
      : "Не слышу вас. Говорите ближе к телефону — далёкие голоса и шум игнорируются.";

    // 1) Серверное распознавание (точнее всего, работает и в Telegram/WebView): запись ближней речи
    if (VoiceRecorder.supported() && (await serverSttEnabled())) {
      const rec = new VoiceRecorder();
      recRef.current = rec;
      const finish = async () => {
        if (!alive()) return;
        setListening(false); setVoicePhase("processing"); setVoiceMsg("Распознаю…");
        const res = await rec.stop();
        recRef.current = null;
        if (!alive()) return;
        if (!res.wav) { setVoicePhase("idle"); setVoiceMsg(lowMsg(res.analysis.reason)); return; }
        try {
          const out = await transcribeOnServer(res.wav, voiceLang);
          if (!alive()) return;
          setVoicePhase("idle");
          if (!out.alternatives.length) { setVoiceMsg("Речь не распознана. Повторите, пожалуйста."); return; }
          handleVoiceAlternatives(out.alternatives);
        } catch {
          if (!alive()) return;
          setVoicePhase("idle"); setVoiceMsg("Нет связи с сервером распознавания. Попробуйте ещё раз.");
        }
      };
      finishRef.current = () => { void finish(); };
      try {
        await rec.start((db, st) => { setLevel(db); if (st === "speech") setVoiceMsg("Слышу…"); }, () => { void finish(); });
        return;
      } catch {
        recRef.current = null; finishRef.current = null;
        if (!alive()) return;
        // микрофон недоступен для записи — пробуем системное распознавание ниже
      }
    }

    // 2) Системное распознавание (Web Speech / Capacitor) с n-best; на не-iOS параллельно слушаем «ближнее поле»
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    let gate: VoiceRecorder | null = null;
    if (!isIOS && VoiceRecorder.supported()) {
      gate = new VoiceRecorder();
      try { await gate.start((db) => setLevel(db), () => undefined, 12000); } catch { gate = null; }
    }
    const stop = await startSpeech(voiceLang, {
      onInterim: (t) => alive() && setVoicePreview(t),
      onFinal: async (t, alts) => {
        if (!alive()) return;
        if (gate) {
          const g = await gate.stop(); gate = null;
          if (!g.analysis.ok) { setVoiceMsg(lowMsg(g.analysis.reason)); setVoicePreview(""); setListening(false); setVoicePhase("idle"); return; }
        }
        setVoicePreview(t); setVoicePhase("idle");
        handleVoiceAlternatives(alts && alts.length ? alts : [t]);
      },
      onError: (msg) => { if (!alive()) return; gate?.cancel(); gate = null; setVoiceMsg(msg); setListening(false); setVoicePhase("idle"); },
      onEnd: () => { if (!alive()) return; gate?.cancel(); gate = null; setListening(false); setVoicePhase((p) => (p === "processing" ? p : "idle")); stopRef.current = null; }
    });
    stopRef.current = stop;
  }, [voiceLang, handleVoiceAlternatives]);

  /** Нажатие на микрофон сразу открывает экран прослушивания и запускает запись */
  const openVoice = () => {
    if (!feat("voice")) return showToast("Голосовой поиск вам недоступен");
    setVoiceOpen(true);
    void startListening();
  };
  const closeVoice = () => {
    stopListening();
    setVoiceOpen(false);
  };

  /* ───────── Озвучивание ───────── */
  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return showToast("Озвучивание не поддерживается");
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voiceLang.startsWith("uz") ? "uz-UZ" : "ru-RU";
    u.rate = 0.92;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };

  const copyLink = async (r: Recipe) => {
    try {
      await navigator.clipboard.writeText(recipeLink(r.id));
      showToast("Ссылка скопирована");
    } catch {
      showToast("Не удалось скопировать");
    }
    setMoreOpen(false);
  };

  /* ───────── Черновики импорта ───────── */
  const saveDraft = (d: Recipe) => {
    setDrafts((old) => { const next = [d, ...old]; writeJson(DRAFTS_KEY, next); return next; });
    showToast("Карточка сохранена");
    if (authed && can(me, "imports", "import")) pushImport(d).then((r) => { if (r.created) { showToast("Черновик отправлен на сервер"); void sync(); } }).catch(() => {});
  };
  const deleteDraft = (id: string) =>
    setDrafts((old) => { const next = old.filter((d) => d.id !== id); writeJson(DRAFTS_KEY, next); return next; });

  /* ───────── Части интерфейса ───────── */
  const statusText =
    source === "loading" ? "Подключение…"
    : source === "server" ? "Онлайн · данные сервера"
    : source === "cache" ? `Офлайн · локальный кэш${lastSync ? ` · ${new Date(lastSync).toLocaleDateString("ru-RU")}` : ""}`
    : `Демо-режим · ${MOCK_RECIPES.length} тестовых карт`;
  const needsAttention = !isOnline || source === "mock" || source === "cache";

  const searchBar = (withScan = false) => (
    <div className="searchrow">
      <div className="searchbar">
        <IconSearch size={22} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Блюдо или ингредиент…"
          aria-label="Поиск по блюдам и ингредиентам"
          enterKeyHint="search"
        />
        {query && <button className="clear" onClick={() => setQuery("")} aria-label="Очистить"><IconClose size={16} /></button>}
        {feat("voice") && <button className="mic-btn" onClick={openVoice} aria-label="Голосовой поиск"><IconMic size={22} /></button>}
      </div>
      {withScan && canImport && <button className="scan-btn" onClick={() => setView("scan")} aria-label="Сканер документов и QR-кода"><IconScan size={26} /></button>}
    </div>
  );

  const recipeRow = (r: Recipe, i: number) => (
    <article key={r.id} className="row" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <button className="row-main" onClick={() => openRecipe(r)}>
        <RecipeImage recipe={r} className="row-img" />
        <span className="row-text">
          <b>{r.name}</b>
          <small>Выход: {r.yield}</small>
          {(r.section || r.department || r.category) && <em>{[r.department, r.section || r.category].filter(Boolean).join(" · ")}</em>}
        </span>
      </button>
      <button className={favorites.includes(r.id) ? "bm on" : "bm"} onClick={() => toggleFavorite(r.id)} aria-label="В закладки" aria-pressed={favorites.includes(r.id)}>
        <IconBookmark size={22} filled={favorites.includes(r.id)} />
      </button>
    </article>
  );

  const list = (items: Recipe[]) =>
    source === "loading" ? (
      <div className="rows">{[0, 1, 2, 3].map((i) => <div key={i} className="row skeleton" />)}</div>
    ) : (
      <div className="rows">{items.map((r, i) => recipeRow(r, i))}</div>
    );

  const empty = (title: string, text: string, action?: [string, () => void], icon?: ReactNode) => (
    <div className="empty">
      <div className="empty-ico">{icon || <IconSearch size={30} />}</div>
      <b>{title}</b>
      <span>{text}</span>
      {action && <button className="btn-soft" onClick={action[1]}>{action[0]}</button>}
    </div>
  );

  /* ───────── Экран карты ───────── */
  const renderDetail = (r: Recipe) => {
    const base = Math.max(1, r.portionCount || 1);
    const factor = portions / base;
    const cost = r.cost;
    return (
      <div className="detail">
        <div className="hero">
          <RecipeImage recipe={r} className="hero-img" />
          <div className="hero-shade" />
          <button className="round-btn left" onClick={() => setSelected(null)} aria-label="Назад"><IconBack size={22} /></button>
          <div className="hero-right">
            <button className="round-btn" onClick={() => toggleFavorite(r.id)} aria-label="В закладки"><IconBookmark size={21} filled={favorites.includes(r.id)} /></button>
            <button className="round-btn" onClick={() => setMoreOpen((v) => !v)} aria-label="Ещё"><IconMore size={21} /></button>
            {moreOpen && (
              <div className="popover" role="menu">
                {feat("tts") && <button onClick={() => { speak(`${r.name}. ${r.ingredients.map((i) => `${i.name} ${formatQty(i, factor)}`).join(". ")}`); setMoreOpen(false); }}>
                  <IconVolume size={18} /> Прослушать состав
                </button>}
                <button onClick={() => copyLink(r)}><IconLink size={18} /> Копировать ссылку</button>
                {feat("qr") && <button onClick={() => { setMoreOpen(false); setSelected(null); setView("qr"); }}><IconQr size={18} /> QR-код карты</button>}
              </div>
            )}
          </div>
        </div>

        <div className="sheet">
          <span className="pill">Технологическая карта</span>
          <h1>{r.name}</h1>
          <div className="chips">
            <span className="chip-meta"><IconScale size={19} /> Выход: <b>{r.yield}</b></span>
            <span className="chip-meta">
              <IconBox size={19} /> Порция:
              {r.portionCount ? (
                <span className="stepper">
                  <button onClick={() => setPortions((v) => Math.max(1, v - 1))} aria-label="Уменьшить"><IconMinus size={14} /></button>
                  <b>{portions}</b>
                  <button onClick={() => setPortions((v) => Math.min(10000, v + 1))} aria-label="Увеличить"><IconPlus size={14} /></button>
                </span>
              ) : <b>1</b>}
            </span>
            {r.time && r.time !== "—" && <span className="chip-meta"><IconClock size={19} /> <b>{r.time}</b></span>}
          </div>
          {r.description && <p className="desc">{r.description}</p>}

          <div className="seg" role="tablist">
            {([["ingredients", "Ингредиенты"], ["technology", "Технология"], ["calculation", "Калькуляция"]] as [DetailTab, string][]).filter(([k]) => k !== "calculation" || canCost).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={detailTab === k} className={detailTab === k ? "on" : ""} onClick={() => setDetailTab(k)}>{l}</button>
            ))}
          </div>

          {detailTab === "ingredients" && (
            <div className="table">
              <div className="thead"><span>№</span><span>Продукт</span><span>Нетто ({portions} порц.)</span></div>
              {r.ingredients.map((i, n) => (
                <div className="trow" key={`${i.name}-${n}`}>
                  <span className="num">{n + 1}</span>
                  <span>{i.name}</span>
                  <b>{r.portionCount ? formatQty(i, factor) : i.amount}</b>
                </div>
              ))}
              {r.ingredients.length === 0 && empty("Состав не указан", "В этой карте нет ингредиентов.")}
            </div>
          )}

          {detailTab === "technology" && (
            <ol className="steps">
              {r.steps.map((s, n) => (
                <li key={n}>
                  <span className="step-n">{n + 1}</span>
                  <p>{s}</p>
                  {r.stepImages?.[n] && <StepImg url={r.stepImages[n]} alt={`Шаг ${n + 1}`} />}
                  {feat("tts") && <button className="step-voice" onClick={() => speak(s)} aria-label="Прослушать шаг"><IconVolume size={18} /></button>}
                </li>
              ))}
            </ol>
          )}

          {detailTab === "calculation" && (cost ? (
            <>
              <div className="cost-card">
                <span>Общая себестоимость · {portions} порц.</span>
                <b>{nf2.format(cost.total * factor)} {r.costCurrency || "UZS"}</b>
                {cost.perPortion !== null && <small>1 порция: {nf2.format(cost.perPortion)} {r.costCurrency || "UZS"}</small>}
              </div>
              <div className="table">
                <div className="thead two"><span>Продукт</span><span>Стоимость</span></div>
                {cost.lines?.map((l, n) => (
                  <div className="trow two" key={`${l.name}-${n}`}>
                    <span>{l.name}</span>
                    <b>{nf2.format(l.total * factor)} {r.costCurrency || "UZS"}</b>
                  </div>
                ))}
              </div>
              {!cost.complete && <p className="note">Для некоторых продуктов не указана цена.</p>}
            </>
          ) : empty("Калькуляции нет", "Для этой карты не указаны закупочные цены."))}
        </div>
      </div>
    );
  };

  /* ───────── Вкладки ───────── */
  const renderHome = () => {
    const q = query.trim();
    return (
      <>
        <header className="home-head">
          <div className="brand">
            <LogoChef size={46} />
            <div><b>Clean Kitchen</b><small>Технологические карты</small></div>
          </div>
          <button className="bell" onClick={() => setView("notifications")} aria-label="Уведомления">
            <IconBell size={25} />
            {needsAttention && <i className="dot" />}
          </button>
        </header>

        {!q && (
          <Banner slides={[
            { src: "banners/hero-recipes.webp", alt: "Технологические карты блюд — открыть все блюда", onClick: () => goSearch() },
            ...(canCost ? [{ src: "banners/hero-cost.webp", alt: "Точная стоимость каждого блюда — открыть калькуляцию", onClick: () => setView("calc") }] : []),
            ...(canImport ? [{ src: "banners/hero-import.webp", alt: "Импорт рецептов из PDF и фото", onClick: () => setView("import") }] : []),
            ...(feat("voice") ? [{ src: "banners/hero-voice.webp", alt: "Голосовой поиск рецептов", onClick: openVoice }] : [])
          ]} />
        )}

        {searchBar(true)}

        {q ? (
          <>
            <div className="count">Найдено карт: {results.length}</div>
            {results.length || source === "loading" ? list(results) : empty("Ничего не найдено", "Измените запрос или выберите категорию.", ["Сбросить поиск", () => setQuery("")])}
          </>
        ) : (
          <>
            <div className="cats">
              {GROUPS.map((g, i) => (
                <button key={g.key} className={i === 0 ? "cat sel" : "cat"} onClick={() => goSearch({ group: g.key })}>
                  <span className={`cat-ico ${g.tone}`}>{CAT_ART[g.key] ? (() => { const A = CAT_ART[g.key]; return <A />; })() : g.tile}</span>
                  <span className="cat-label">{g.label}</span>
                  <span className="cat-count">{countOf(g)}</span>
                </button>
              ))}
            </div>

            <div className="sect-head">
              <h2>{recentList.title}</h2>
              <button className="link" onClick={() => goSearch()}>Смотреть все <IconArrowRight size={17} /></button>
            </div>
            {source === "loading" ? (
              <div className="hscroll">{[0, 1, 2].map((i) => <div key={i} className="rcard skeleton" />)}</div>
            ) : (
              <div className="hscroll">
                {recentList.items.map((r) => (
                  <article key={r.id} className="rcard">
                    <button className="rcard-main" onClick={() => openRecipe(r)}>
                      <RecipeImage recipe={r} className="rcard-img" />
                      {recent.includes(r.id) && <span className="rcard-clock"><IconClock size={18} /></span>}
                      <span className="rcard-body">
                        <b>{r.name}</b>
                        <small>{[r.department?.replace(" цех", ""), r.section || r.category].filter(Boolean).join(" • ")}</small>
                        <em>Выход: {r.yield}</em>
                      </span>
                    </button>
                    <button className={favorites.includes(r.id) ? "rcard-bm on" : "rcard-bm"} onClick={() => toggleFavorite(r.id)} aria-label="В закладки" aria-pressed={favorites.includes(r.id)}>
                      <IconBookmark size={22} filled={favorites.includes(r.id)} />
                    </button>
                  </article>
                ))}
              </div>
            )}

            <div className="quick" role="group" aria-label="Быстрые действия">
              <button onClick={() => setView("calc")}><span className="q-ico blue"><IconCalc size={26} /></span><span>Калькуляция</span></button>
              <button onClick={() => setView("import")}><span className="q-ico violet"><IconImport size={26} /></span><span>Импорт<br />(PDF/Фото)</span></button>
              <button onClick={() => setView("qr")}><span className="q-ico orange"><IconQr size={26} /></span><span>QR-код<br />карты</span></button>
              <button onClick={() => setView("offline")}><span className="q-ico green"><IconCloudDown size={26} /></span><span>Офлайн<br />режим</span></button>
            </div>
          </>
        )}
      </>
    );
  };

  const activeDept = KITCHEN_DEPTS.find((d) => d.name === department);
  const renderSearch = () => (
    <>
      <h1 className="page-title">Поиск</h1>
      {searchBar()}
      <div className="chip-row" role="group" aria-label="Категории">
        {GROUPS.map((g) => (
          <button key={g.key} className={group === g.key ? "fchip on" : "fchip"} onClick={() => setGroup(g.key)}>{g.label}</button>
        ))}
      </div>
      <div className="chip-row sub" role="group" aria-label="Цеха">
        <button className={!department ? "fchip alt on" : "fchip alt"} onClick={() => { setDepartment(""); setSection(""); }}>Все цеха</button>
        {KITCHEN_DEPTS.map((d) => (
          <button key={d.name} className={department === d.name ? "fchip alt on" : "fchip alt"} onClick={() => { setDepartment(d.name); setSection(""); }}>{d.name}</button>
        ))}
      </div>
      {activeDept && (
        <div className="chip-row sub">
          <button className={!section ? "fchip alt on" : "fchip alt"} onClick={() => setSection("")}>Все участки</button>
          {activeDept.sections.map((s) => (
            <button key={s} className={section === s ? "fchip alt on" : "fchip alt"} onClick={() => setSection(s)}>{s}</button>
          ))}
        </div>
      )}
      <div className="count">Найдено карт: {results.length}</div>
      {results.length || source === "loading" ? list(results) : empty("Ничего не найдено", "Измените запрос или сбросьте фильтры.", ["Сбросить фильтры", () => goSearch()])}
    </>
  );

  const renderSaved = () => (
    <>
      <h1 className="page-title">Сохранённые</h1>
      {savedList.length ? list(savedList) : empty("Нет сохранённых карт", "Нажмите на закладку у карты — она появится здесь.", ["На главную", () => setTab("home")], <IconBookmark size={30} />)}
    </>
  );

  const renderCategories = () => (
    <>
      <h1 className="page-title">Категории</h1>
      <div className="group-grid">
        {GROUPS.map((g) => (
          <button key={g.key} className="group-card" onClick={() => goSearch({ group: g.key })}>
            <span className={`cat-ico ${g.tone}`}>{CAT_ART[g.key] ? (() => { const A = CAT_ART[g.key]; return <A />; })() : g.tile}</span>
            <b>{g.label}</b>
            <small>{countOf(g)} карт</small>
          </button>
        ))}
      </div>
      <h3 className="menu-h">Цеха и участки</h3>
      <div className="menu-list">
        {KITCHEN_DEPTS.map((d) => (
          <button key={d.name} onClick={() => goSearch({ dept: d.name })}>
            <span className="menu-ico">{d.icon}</span>
            <span className="menu-text">
              <b>{d.name}</b>
              <small>{d.sections.join(" · ")}</small>
            </span>
            <span className="menu-count">{recipes.filter((r) => r.department === d.name).length}</span>
            <IconChevronRight size={18} />
          </button>
        ))}
      </div>
    </>
  );

  const menuItem = (icon: ReactNode, title: string, sub: string, onClick: () => void) => (
    <button key={title} onClick={onClick}>
      <span className="menu-ico">{icon}</span>
      <span className="menu-text"><b>{title}</b><small>{sub}</small></span>
      <IconChevronRight size={18} />
    </button>
  );

  const renderMenu = () => (
    <>
      <h1 className="page-title">Меню</h1>
      <div className="profile">
        <span className="avatar">{(me?.user.name || "П").slice(0, 1).toUpperCase()}</span>
        <div><b>{me?.user.name || "Повар"}</b><small>{me ? `${me.role?.name ?? ""} · ${me.restaurant?.name ?? ""}` : "Демо без входа"}</small></div>
      </div>
      {me?.tenantError && <div className="form-err" role="alert">{me.tenantError.message}</div>}
      {me && canManage(me) && !me.tenantError && (
        <div className="menu-list" style={{ marginTop: 14 }}>{menuItem(<IconLayers size={20} />, "Управление", "Карты, сотрудники, роли, журнал", () => setView("manage"))}</div>
      )}

      <h3 className="menu-h">Инструменты</h3>
      <div className="menu-list">
        {canCost && menuItem(<IconCalc size={20} />, "Калькуляция", "Себестоимость блюд и порций", () => setView("calc"))}
        {canImport && menuItem(<IconImport size={20} />, "Импорт PDF / Фото", `Фото и PDF → карточка · импортировано: ${drafts.length}`, () => setView("import"))}
        {feat("qr") && menuItem(<IconQr size={20} />, "QR-код карты", "Создать код для карты", () => setView("qr"))}
        {canImport && menuItem(<IconScan size={20} />, "Сканер документов", "Камера, фото, PDF и QR-код", () => setView("scan"))}
        {menuItem(<IconCloudDown size={20} />, "Офлайн-режим", "Карты на устройстве без интернета", () => setView("offline"))}
        {menuItem(<IconBell size={20} />, "Уведомления", needsAttention ? "Есть важные сообщения" : "Всё в порядке", () => setView("notifications"))}
        {menuItem(<IconHistory size={20} />, "Очистить историю", "Список недавно открытых", () => { setRecent([]); writeJson(RECENT_KEY, []); showToast("История очищена"); })}
      </div>

      <h3 className="menu-h">Источник данных</h3>
      <div className={`source-card ${source}`}>
        <div>
          <b>{statusText}</b>
          {apiError && source !== "server" && <small>{apiError}</small>}
        </div>
        {source !== "loading" && source !== "server" && (
          <button className="btn-soft" onClick={() => sync()}><IconRefresh size={16} /> {source === "mock" ? "Подключиться" : "Обновить"}</button>
        )}
      </div>
      {me && <button className="btn-soft wide" style={{ marginTop: 18 }} onClick={() => onLogout?.()}>Выйти из аккаунта</button>}
      <p className="version">CLEAN KITCHEN · V13</p>
    </>
  );

  /* ───────── Экран голосового поиска ───────── */
  const renderVoice = () => (
    <div className="voice" role="dialog" aria-label="Голосовой поиск">
      <button className="voice-x" onClick={closeVoice} aria-label="Закрыть"><IconClose size={26} /></button>
      <h2>Голосовой поиск</h2>
      <div className="orb-wrap">
        <span className={listening ? "ring r1 on" : "ring r1"} />
        <span className={listening ? "ring r2 on" : "ring r2"} />
        <button className={listening ? "orb on" : "orb"} onClick={() => (listening ? finishListening() : void startListening())} aria-label="Микрофон"><IconMic size={52} filled /></button>
      </div>
      <div ref={waveRef} className={listening ? "wave on live" : "wave"} aria-hidden="true">
        {Array.from({ length: 21 }).map((_, i) => (
          <i key={i} style={{ ["--h" as string]: `${[10, 16, 26, 18, 34, 22, 44, 28, 52, 30, 58, 30, 52, 28, 44, 22, 34, 18, 26, 16, 10][i]}px`, animationDelay: `${(i % 7) * 70}ms` }} />
        ))}
      </div>
      <h3>{voicePhase === "processing" ? "Распознаю…" : listening ? "Слушаю…" : "Нажмите на микрофон"}</h3>
      <p className="voice-status" aria-live="polite">{voicePreview || voiceMsg}</p>
      {voiceChoices.length > 0 && (
        <div className="voice-choices">
          <small>{voicePreview ? `Вы сказали «${voicePreview}». Вы имели в виду:` : "Вы имели в виду:"}</small>
          {voiceChoices.map((c) => (
            <button key={c.id} onClick={() => { const r = recipes.find((x) => x.id === c.id); if (r) { stopListening(); setVoiceOpen(false); setView(null); setQuery(""); openRecipe(r); } }}>{c.name}</button>
          ))}
          <button className="more" onClick={() => showSearch(voiceQ)}>Показать все результаты</button>
        </div>
      )}
      <div className="examples">
        <span>Например:</span>
        {VOICE_EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => { stopListening(); setVoicePreview(ex); handleVoiceAlternatives([ex]); }}>«{ex}»</button>
        ))}
      </div>
      <label className="lang-pill">
        <IconGlobe size={22} />
        <span>{voiceLang === "ru-RU" ? "Русский" : "Узбекский"}</span>
        <IconChevronDown size={20} />
        <select value={voiceLang} onChange={(e) => { stopListening(); setVoiceLang(e.target.value as SpeechLang); }} aria-label="Язык распознавания">
          <option value="ru-RU">Русский</option>
          <option value="uz-UZ">Узбекский</option>
        </select>
      </label>
    </div>
  );

  /* ───────── Экраны-инструменты ───────── */
  const closeView = () => setView(null);
  const renderView = (v: Exclude<View, null>) => {
    switch (v) {
      case "notifications":
        return <NotificationsScreen source={source} isOnline={isOnline} apiError={apiError} lastSync={lastSync} draftCount={drafts.length} favCount={favorites.length}
          onSync={() => { void sync(); }} onOffline={() => setView("offline")} onImport={() => setView("import")} onBack={closeView} />;
      case "scan":
        return <SmartScanner recipes={recipes} drafts={drafts} initialMode="camera" onOpen={(r) => { setView(null); openRecipe(r); }} onSaveRecipe={saveDraft} onDelete={deleteDraft} onBack={closeView} />;
      case "calc":
        return <CalcScreen recipes={recipes} onOpen={(r) => openRecipe(r, "calculation")} onBack={closeView} />;
      case "qr":
        return <QrScreen recipes={recipes} onScan={() => setView("scan")} onBack={closeView} />;
      case "offline":
        return <OfflineScreen recipes={recipes} source={source} isOnline={isOnline} onSync={sync} onBack={closeView} />;
      case "manage":
        return me ? <Manage me={me} onBack={closeView} onChanged={() => { void sync(); }} /> : null;
      case "import":
        return <SmartScanner recipes={recipes} drafts={drafts} initialMode="photo" onOpen={(r) => { setView(null); openRecipe(r); }} onSaveRecipe={saveDraft} onDelete={deleteDraft} onBack={closeView} />;
    }
  };

  const navItems: { id: Tab; label: string; icon: (f: boolean) => ReactNode }[] = [
    { id: "home", label: "Главная", icon: (f) => <IconHome size={26} filled={f} /> },
    { id: "search", label: "Поиск", icon: () => <IconSearch size={26} /> },
    { id: "saved", label: "Сохранённые", icon: (f) => <IconBookmark size={26} filled={f} /> },
    { id: "categories", label: "Категории", icon: () => <IconLayers size={26} /> },
    { id: "menu", label: "Меню", icon: (f) => <IconUser size={26} filled={f} /> }
  ];

  const overlay = voiceOpen || !!selected || !!view;
  return (
    <div className="app">
      {!isOnline && <div className="offline-bar"><IconWifiOff size={15} /> Нет сети — используются сохранённые данные</div>}
      {voiceOpen ? renderVoice() : selected ? renderDetail(selected) : view ? renderView(view) : (
        <main className="screen" key={tab}>
          {tab === "home" && renderHome()}
          {tab === "search" && renderSearch()}
          {tab === "saved" && renderSaved()}
          {tab === "categories" && renderCategories()}
          {tab === "menu" && renderMenu()}
        </main>
      )}
      {!overlay && (
        <nav className="tabbar" aria-label="Основная навигация">
          {navItems.map((n) => (
            <button key={n.id} className={tab === n.id ? "on" : ""} onClick={() => setTab(n.id)} aria-current={tab === n.id ? "page" : undefined}>
              {n.icon(tab === n.id)}
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
      )}
      {toast && <div className="toast" role="status"><IconCheck size={16} /> {toast}</div>}
    </div>
  );
}
