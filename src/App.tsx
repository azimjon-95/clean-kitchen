import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconBell, IconBack, IconBookmark, IconBox, IconCheck, IconChevronDown, IconChevronRight,
  IconClose, IconFlame, IconGlobe, IconHome, IconLink, IconMic, IconMinus, IconMore,
  IconPlus, IconRefresh, IconScale, IconSearch, IconUser, IconVolume, IconWifiOff,
  IconFish, IconSnow, IconCake, IconUtensils, IconHistory,
  LogoChef, TileAll, TileMain, TileSalad, TileSauce
} from "./components/Icons";
import { RecipeImage } from "./components/RecipeImage";
import { saveFavorites, loadFavorites, createConnectivityWatcher } from "./lib/offline";
import { loadRecipes } from "./lib/api";
import { startSpeech, type SpeechLang } from "./lib/speech";
import { processVoiceQuery, scoreVoiceMatch } from "./lib/voiceCorrect";
import { MOCK_RECIPES } from "./data/mockRecipes";
import type { DataSource, Ingredient, Recipe } from "./types";

type Tab = "home" | "search" | "saved" | "menu";
type DetailTab = "ingredients" | "technology" | "calculation";

const KITCHEN_DEPTS = [
  { name: "Горячий цех", icon: <IconFlame size={20} />, sections: ["Паста", "Мангал", "Соусы", "Раздача", "Заготовка"] },
  { name: "Суши", icon: <IconFish size={20} />, sections: ["Роллы", "Сашими / Нигири", "Заготовка"] },
  { name: "Холодный цех", icon: <IconSnow size={20} />, sections: ["Салаты", "Закуски", "Заготовка"] },
  { name: "Кондитерский", icon: <IconCake size={20} />, sections: ["Десерты", "Пекарный", "Заготовка"] }
];

const QUICK_CATS = [
  { label: "Барча\nтаомлар", cat: "", icon: <TileAll />, tone: "rose" },
  { label: "Соуслар", cat: "Соусы", icon: <TileSauce />, tone: "sand" },
  { label: "Салатлар", cat: "Салаты", icon: <TileSalad />, tone: "mint" },
  { label: "Асосий\nтаомлар", cat: "Горячие блюда", icon: <TileMain />, tone: "peach" }
];

const VOICE_EXAMPLES = ["Соус болоньезе", "Омлет с зеленью", "Путанеско соуси"];
const UNIT_LABEL: Record<string, string> = { kg: "кг", g: "г", l: "л", ml: "мл", pcs: "шт" };
const nf3 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });
const nf2 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const RECENT_KEY = "ck-recent";

function formatQty(ing: Ingredient, factor: number): string {
  if (ing.quantity == null || !ing.unit) return ing.amount || "—";
  let v = ing.quantity * factor;
  let u = UNIT_LABEL[ing.unit] || ing.unit;
  if (u === "г" && v >= 1000) { v /= 1000; u = "кг"; }
  else if (u === "мл" && v >= 1000) { v /= 1000; u = "л"; }
  return `${nf3.format(Number(v.toFixed(3)))} ${u}`;
}

function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [source, setSource] = useState<DataSource>("loading");
  const [apiError, setApiError] = useState<string | undefined>();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const [tab, setTab] = useState<Tab>("home");
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>(readRecent);

  const [selected, setSelected] = useState<Recipe | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("ingredients");
  const [portions, setPortions] = useState(1);
  const [moreOpen, setMoreOpen] = useState(false);
  const [focusNext, setFocusNext] = useState(false);
  const [toast, setToast] = useState("");

  const [voiceOpen, setVoiceOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<SpeechLang>("ru-RU");
  const [voicePreview, setVoicePreview] = useState("");
  const [voiceMsg, setVoiceMsg] = useState("");
  const stopRef = useRef<null | (() => void)>(null);
  const recipesRef = useRef<Recipe[]>([]);
  recipesRef.current = recipes;

  /* ───────── Ma'lumot ───────── */
  const sync = useCallback(async () => {
    const r = await loadRecipes();
    setRecipes(r.recipes);
    setSource(r.source);
    setApiError(r.error);
    setLastSync(r.lastSync);
  }, []);

  useEffect(() => {
    loadFavorites().then((ids) => ids.length && setFavorites(ids));
    sync();
    return createConnectivityWatcher((online) => {
      setIsOnline(online);
      if (online) sync();
    });
  }, [sync]);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 1800);
  };

  /* ───────── Karta ochish ───────── */
  const openRecipe = useCallback((r: Recipe) => {
    setSelected(r);
    setDetailTab("ingredients");
    setPortions(Math.max(1, r.portionCount || 1));
    setMoreOpen(false);
    setRecent((old) => {
      const next = [r.id, ...old.filter((x) => x !== r.id)].slice(0, 6);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
    window.scrollTo({ top: 0 });
  }, []);

  // QR deep-link: ?recipe=<id>
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

  /* ───────── Qidiruv ───────── */
  const results = useMemo(() => {
    const q = query.trim();
    return recipes.filter((r) =>
      (!department || r.department === department) &&
      (!section || r.section === section) &&
      (!catFilter || r.category === catFilter) &&
      (!q || scoreVoiceMatch(r, q) >= 40)
    );
  }, [recipes, query, department, section, catFilter]);

  const savedList = useMemo(() => recipes.filter((r) => favorites.includes(r.id)), [recipes, favorites]);
  const homeList = useMemo(() => {
    const byRecent = recent.map((id) => recipes.find((r) => r.id === id)).filter(Boolean) as Recipe[];
    if (byRecent.length) return { title: "Сўнгги очилганлар", items: byRecent.slice(0, 4) };
    const pop = recipes.filter((r) => r.popular);
    return { title: "Машҳур таомлар", items: (pop.length ? pop : recipes).slice(0, 4) };
  }, [recipes, recent]);

  const goSearch = (opts: { cat?: string; dept?: string; sec?: string; q?: string; focus?: boolean } = {}) => {
    setFocusNext(!!opts.focus);
    setCatFilter(opts.cat ?? "");
    setDepartment(opts.dept ?? "");
    setSection(opts.sec ?? "");
    setQuery(opts.q ?? "");
    setSelected(null);
    setTab("search");
  };

  /* ───────── Ovozli qidiruv ───────── */
  const stopListening = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
  }, []);

  const handleVoiceText = useCallback((text: string) => {
    const { corrected, matches } = processVoiceQuery(text, recipesRef.current, 45);
    const q = corrected || text;
    const top = matches[0];
    const second = matches[1];
    if (top && top.score >= 80 && (!second || top.score - second.score >= 15)) {
      stopListening();
      setVoiceOpen(false);
      setQuery("");
      openRecipe(top.recipe);
    } else if (matches.length > 0) {
      stopListening();
      setVoiceOpen(false);
      setCatFilter(""); setDepartment(""); setSection("");
      setQuery(q);
      setSelected(null);
      setTab("search");
    } else {
      setVoiceMsg(`«${q}» топилмади. Яна бир бор айтиб кўринг.`);
    }
  }, [openRecipe, stopListening]);

  const startListening = useCallback(async () => {
    setVoiceMsg("");
    setVoicePreview("");
    setListening(true);
    const stop = await startSpeech(voiceLang, {
      onInterim: (t) => setVoicePreview(t),
      onFinal: (t) => { setVoicePreview(t); handleVoiceText(t); },
      onError: (msg) => { setVoiceMsg(msg); setListening(false); },
      onEnd: () => { setListening(false); stopRef.current = null; }
    });
    stopRef.current = stop;
  }, [voiceLang, handleVoiceText]);

  /** Mikrofon bosilishi bilan darrov eshitish sahifasi ochiladi va tinglash boshlanadi */
  const openVoice = () => {
    setVoiceOpen(true);
    void startListening();
  };
  const closeVoice = () => {
    stopListening();
    setVoiceOpen(false);
  };
  const onOrb = () => (listening ? stopListening() : void startListening());

  /* ───────── Ovoz chiqarish ───────── */
  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return showToast("Овоз қўллаб-қувватланмайди");
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voiceLang.startsWith("uz") ? "uz-UZ" : "ru-RU";
    u.rate = 0.92;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => x.lang.startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };

  const copyLink = async (r: Recipe) => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}?recipe=${r.id}`);
      showToast("Ҳавола нусхаланди");
    } catch {
      showToast("Нусхалаб бўлмади");
    }
    setMoreOpen(false);
  };

  /* ───────── Ko'rinish bo'laklari ───────── */
  const statusText =
    source === "loading" ? "Уланмоқда…"
    : source === "server" ? "Онлайн · сервер маълумотлари"
    : source === "cache" ? `Офлайн · кэш${lastSync ? ` · ${new Date(lastSync).toLocaleDateString("ru-RU")}` : ""}`
    : `Демо режим · ${MOCK_RECIPES.length} та тест карта`;

  const searchBar = (onFocus?: () => void, autoFocus?: boolean) => (
    <div className="searchbar">
      <IconSearch size={22} />
      <input
        value={query}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Таом номини қидиринг..."
        aria-label="Қидирув"
      />
      {query && (
        <button className="clear" onClick={() => setQuery("")} aria-label="Тозалаш"><IconClose size={16} /></button>
      )}
      <button className="mic-btn" onClick={openVoice} aria-label="Овозли қидирув"><IconMic size={22} /></button>
    </div>
  );

  const recipeRow = (r: Recipe, i: number) => (
    <article key={r.id} className="row" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <button className="row-main" onClick={() => openRecipe(r)}>
        <RecipeImage recipe={r} className="row-img" />
        <span className="row-text">
          <b>{r.name}</b>
          <small>Чиқиш: {r.yield}</small>
          {(r.section || r.department) && <em>{[r.department, r.section].filter(Boolean).join(" · ")}</em>}
        </span>
      </button>
      <button
        className={favorites.includes(r.id) ? "bm on" : "bm"}
        onClick={() => toggleFavorite(r.id)}
        aria-label="Сақлаш"
        aria-pressed={favorites.includes(r.id)}
      >
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

  const empty = (title: string, text: string, action?: [string, () => void]) => (
    <div className="empty">
      <div className="empty-ico"><IconSearch size={30} /></div>
      <b>{title}</b>
      <span>{text}</span>
      {action && <button className="btn-soft" onClick={action[1]}>{action[0]}</button>}
    </div>
  );

  /* ───────── Karta sahifasi ───────── */
  const renderDetail = (r: Recipe) => {
    const base = Math.max(1, r.portionCount || 1);
    const factor = portions / base;
    const cost = r.cost;
    return (
      <div className="detail">
        <div className="hero">
          <RecipeImage recipe={r} className="hero-img" />
          <div className="hero-shade" />
          <button className="round-btn left" onClick={() => setSelected(null)} aria-label="Орқага"><IconBack size={22} /></button>
          <div className="hero-right">
            <button className="round-btn" onClick={() => toggleFavorite(r.id)} aria-label="Сақлаш">
              <IconBookmark size={21} filled={favorites.includes(r.id)} />
            </button>
            <button className="round-btn" onClick={() => setMoreOpen((v) => !v)} aria-label="Яна"><IconMore size={21} /></button>
            {moreOpen && (
              <div className="popover" role="menu">
                <button onClick={() => { speak(`${r.name}. ${r.ingredients.map((i) => `${i.name} ${formatQty(i, factor)}`).join(". ")}`); setMoreOpen(false); }}>
                  <IconVolume size={18} /> Овозда ўқиш
                </button>
                <button onClick={() => copyLink(r)}><IconLink size={18} /> Ҳаволани нусхалаш</button>
              </div>
            )}
          </div>
        </div>

        <div className="sheet">
          <span className="pill">Технологик карта</span>
          <h1>{r.name}</h1>
          <div className="chips">
            <span className="chip-meta"><IconScale size={19} /> Чиқиш: <b>{r.yield}</b></span>
            <span className="chip-meta">
              <IconBox size={19} /> Порция:
              {r.portionCount ? (
                <span className="stepper">
                  <button onClick={() => setPortions((v) => Math.max(1, v - 1))} aria-label="Камайтириш"><IconMinus size={14} /></button>
                  <b>{portions}</b>
                  <button onClick={() => setPortions((v) => Math.min(10000, v + 1))} aria-label="Кўпайтириш"><IconPlus size={14} /></button>
                </span>
              ) : <b>1</b>}
            </span>
          </div>
          {r.description && <p className="desc">{r.description}</p>}

          <div className="seg" role="tablist">
            {([["ingredients", "Ингредиентлар"], ["technology", "Технология"], ["calculation", "Калькуляция"]] as [DetailTab, string][]).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={detailTab === k} className={detailTab === k ? "on" : ""} onClick={() => setDetailTab(k)}>{l}</button>
            ))}
          </div>

          {detailTab === "ingredients" && (
            <div className="table">
              <div className="thead"><span>№</span><span>Маҳсулот</span><span>Нетто ({portions} порц.)</span></div>
              {r.ingredients.map((i, n) => (
                <div className="trow" key={`${i.name}-${n}`}>
                  <span className="num">{n + 1}</span>
                  <span>{i.name}</span>
                  <b>{r.portionCount ? formatQty(i, factor) : i.amount}</b>
                </div>
              ))}
            </div>
          )}

          {detailTab === "technology" && (
            <ol className="steps">
              {r.steps.map((s, n) => (
                <li key={n}>
                  <span className="step-n">{n + 1}</span>
                  <p>{s}</p>
                  {r.stepImages?.[n] && <img className="step-img" src={r.stepImages[n]} alt={`Қадам ${n + 1}`} />}
                  <button className="step-voice" onClick={() => speak(s)} aria-label="Овозда ўқиш"><IconVolume size={18} /></button>
                </li>
              ))}
            </ol>
          )}

          {detailTab === "calculation" && (cost ? (
            <>
              <div className="cost-card">
                <span>Умумий таннарх · {portions} порция</span>
                <b>{nf2.format(cost.total * factor)} {r.costCurrency || "UZS"}</b>
                {cost.perPortion !== null && <small>1 порция: {nf2.format(cost.perPortion)} {r.costCurrency || "UZS"}</small>}
              </div>
              <div className="table">
                <div className="thead two"><span>Маҳсулот</span><span>Қиймати</span></div>
                {cost.lines?.map((l, n) => (
                  <div className="trow two" key={`${l.name}-${n}`}>
                    <span>{l.name}</span>
                    <b>{nf2.format(l.total * factor)} {r.costCurrency || "UZS"}</b>
                  </div>
                ))}
              </div>
              {!cost.complete && <p className="note">Айрим маҳсулотлар учун нарх киритилмаган.</p>}
            </>
          ) : empty("Калькуляция йўқ", "Бу карта учун нархлар киритилмаган."))}
        </div>
      </div>
    );
  };

  /* ───────── Tab sahifalari ───────── */
  const renderHome = () => (
    <>
      <header className="home-head">
        <div className="brand">
          <LogoChef size={46} />
          <div><b>Clean Kitchen</b><small>Технологик карталар</small></div>
        </div>
        <button className="bell" onClick={() => showToast("Янги хабарлар йўқ")} aria-label="Хабарлар"><IconBell size={24} /></button>
      </header>
      <section className="greet">
        <h1>Хайрли иш, Повар!</h1>
        <p>Керакли рецептни тез топинг</p>
      </section>
      {searchBar(() => goSearch({ focus: true, q: query }))}
      <div className="cats">
        {QUICK_CATS.map((c) => (
          <button key={c.label} className="cat" onClick={() => goSearch({ cat: c.cat })}>
            <span className={`cat-ico ${c.tone}`}>{c.icon}</span>
            <span className="cat-label">{c.label}</span>
          </button>
        ))}
      </div>
      <div className="sect-head">
        <h2>{homeList.title}</h2>
        <button onClick={() => goSearch()} aria-label="Барчаси"><IconChevronRight size={22} /></button>
      </div>
      {list(homeList.items)}
      <button className="all-link" onClick={() => goSearch()}>Барча {recipes.length} та картани кўриш <IconChevronRight size={16} /></button>
    </>
  );

  const activeDept = KITCHEN_DEPTS.find((d) => d.name === department);
  const renderSearch = () => (
    <>
      <h1 className="page-title">Қидирув</h1>
      {searchBar(undefined, focusNext)}
      <div className="chip-row" role="group" aria-label="Цехлар">
        <button className={!department ? "fchip on" : "fchip"} onClick={() => { setDepartment(""); setSection(""); }}>Барча цехлар</button>
        {KITCHEN_DEPTS.map((d) => (
          <button key={d.name} className={department === d.name ? "fchip on" : "fchip"} onClick={() => { setDepartment(d.name); setSection(""); }}>{d.name}</button>
        ))}
      </div>
      {activeDept && (
        <div className="chip-row sub">
          <button className={!section ? "fchip on" : "fchip"} onClick={() => setSection("")}>Барча участкалар</button>
          {activeDept.sections.map((s) => (
            <button key={s} className={section === s ? "fchip on" : "fchip"} onClick={() => setSection(s)}>{s}</button>
          ))}
        </div>
      )}
      {catFilter && (
        <div className="active-filter">
          <span>Категория: <b>{catFilter}</b></span>
          <button onClick={() => setCatFilter("")} aria-label="Тозалаш"><IconClose size={15} /></button>
        </div>
      )}
      <div className="count">{results.length} та карта топилди</div>
      {results.length || source === "loading" ? list(results) : (
        empty("Ҳеч нарса топилмади", "Сўровни ўзгартиринг ёки фильтрларни тозаланг.", ["Фильтрларни тозалаш", () => goSearch()])
      )}
    </>
  );

  const renderSaved = () => (
    <>
      <h1 className="page-title">Сақланган</h1>
      {savedList.length ? list(savedList) : (
        <div className="empty">
          <div className="empty-ico"><IconBookmark size={30} /></div>
          <b>Сақланган карталар йўқ</b>
          <span>Карта устидаги хатчўп тугмасини босинг — у шу ерда пайдо бўлади.</span>
          <button className="btn-soft" onClick={() => setTab("home")}>Бош саҳифага</button>
        </div>
      )}
    </>
  );

  const renderMenu = () => (
    <>
      <h1 className="page-title">Меню</h1>
      <div className="profile">
        <span className="avatar">П</span>
        <div><b>Повар</b><small>Иш профили</small></div>
      </div>

      <h3 className="menu-h">Цехлар ва участкалар</h3>
      <div className="menu-list">
        {KITCHEN_DEPTS.map((d) => (
          <button key={d.name} onClick={() => goSearch({ dept: d.name })}>
            <span className="menu-ico">{d.icon}</span>
            <span className="menu-text"><b>{d.name}</b><small>{d.sections.join(" · ")}</small></span>
            <IconChevronRight size={18} />
          </button>
        ))}
        <button onClick={() => { setCatFilter(""); setTab("saved"); }}>
          <span className="menu-ico"><IconBookmark size={20} /></span>
          <span className="menu-text"><b>Сақланганлар</b><small>{favorites.length} та карта</small></span>
          <IconChevronRight size={18} />
        </button>
        <button onClick={() => { setRecent([]); try { localStorage.removeItem(RECENT_KEY); } catch { /* noop */ } showToast("Тарих тозаланди"); }}>
          <span className="menu-ico"><IconHistory size={20} /></span>
          <span className="menu-text"><b>Тарихни тозалаш</b><small>Сўнгги очилганлар рўйхати</small></span>
          <IconChevronRight size={18} />
        </button>
      </div>

      <h3 className="menu-h">Маълумот манбаи</h3>
      <div className={`source-card ${source}`}>
        <div>
          <b>{statusText}</b>
          {apiError && source !== "server" && <small>{apiError}</small>}
        </div>
        {source !== "loading" && source !== "server" && (
          <button className="btn-soft" onClick={() => sync()}><IconRefresh size={16} /> {source === "mock" ? "Серверга уланиш" : "Янгилаш"}</button>
        )}
      </div>
      <p className="version">CLEAN KITCHEN · V12</p>
    </>
  );

  /* ───────── Ovozli sahifa ───────── */
  const renderVoice = () => (
    <div className="voice" role="dialog" aria-label="Овозли қидирув">
      <button className="voice-x" onClick={closeVoice} aria-label="Ёпиш"><IconClose size={26} /></button>
      <h2>Овозли қидирув</h2>
      <div className="orb-wrap">
        <span className={listening ? "ring r1 on" : "ring r1"} />
        <span className={listening ? "ring r2 on" : "ring r2"} />
        <button className={listening ? "orb on" : "orb"} onClick={onOrb} aria-label="Микрофон"><IconMic size={52} filled /></button>
      </div>
      <div className={listening ? "wave on" : "wave"} aria-hidden="true">
        {Array.from({ length: 21 }).map((_, i) => (
          <i key={i} style={{ ["--h" as string]: `${[10, 16, 26, 18, 34, 22, 44, 28, 52, 30, 58, 30, 52, 28, 44, 22, 34, 18, 26, 16, 10][i]}px`, animationDelay: `${(i % 7) * 70}ms` }} />
        ))}
      </div>
      <h3>{listening ? "Гапиринг..." : "Микрофонни босинг"}</h3>
      <p className="voice-status" aria-live="polite">{voicePreview || voiceMsg}</p>
      <div className="examples">
        <span>Масалан:</span>
        {VOICE_EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => { stopListening(); setVoicePreview(ex); handleVoiceText(ex); }}>„{ex}“</button>
        ))}
      </div>
      <label className="lang-pill">
        <IconGlobe size={22} />
        <span>{voiceLang === "ru-RU" ? "Русча / Ўзбекча" : "Ўзбекча"}</span>
        <IconChevronDown size={20} />
        <select
          value={voiceLang}
          onChange={(e) => { stopListening(); setVoiceLang(e.target.value as SpeechLang); }}
          aria-label="Тил"
        >
          <option value="ru-RU">Русча / Ўзбекча</option>
          <option value="uz-UZ">Ўзбекча</option>
        </select>
      </label>
    </div>
  );

  const navItems: { id: Tab; label: string; icon: (f: boolean) => JSX.Element }[] = [
    { id: "home", label: "Бош саҳифа", icon: (f) => <IconHome size={26} filled={f} /> },
    { id: "search", label: "Қидирув", icon: () => <IconSearch size={26} /> },
    { id: "saved", label: "Сақланган", icon: (f) => <IconBookmark size={26} filled={f} /> },
    { id: "menu", label: "Меню", icon: (f) => <IconUser size={26} filled={f} /> }
  ];

  return (
    <div className="app">
      {!isOnline && <div className="offline-bar"><IconWifiOff size={15} /> Тармоқ йўқ — сақланган маълумотлар ишлатилмоқда</div>}
      {voiceOpen ? renderVoice() : selected ? renderDetail(selected) : (
        <main className="screen" key={tab}>
          {tab === "home" && renderHome()}
          {tab === "search" && renderSearch()}
          {tab === "saved" && renderSaved()}
          {tab === "menu" && renderMenu()}
        </main>
      )}
      {!voiceOpen && !selected && (
        <nav className="tabbar" aria-label="Асосий меню">
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
