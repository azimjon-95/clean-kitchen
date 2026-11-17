import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Search, Mic, ChefHat, Bookmark, House, UserRound, SlidersHorizontal,
  Clock3, ChevronRight, ArrowLeft, Volume2, Play, Pause, Check, X,
  Utensils, Leaf, Flame, Soup, CakeSlice, Coffee, Star, Plus, Menu, WifiOff, RefreshCw
} from "lucide-react";
import { saveFavorites, loadFavorites, createConnectivityWatcher } from "./lib/offline";
import { loadRecipes } from "./lib/api";
import { MOCK_RECIPES } from "./data/mockRecipes";
import type { DataSource, Recipe } from "./types";
import { startSpeech, getSpeechBackend, type SpeechLang } from "./lib/speech";
import { processVoiceQuery, correctSttText, scoreVoiceMatch } from "./lib/voiceCorrect";

type KitchenDept = {
  name: string;
  slug: string;
  icon: string;
  sections: { name: string; slug: string; icon?: string }[];
};


const searchSynonyms: string[][] = [
  ["курица","товук","tovuq","chicken"],["говядина","мол гушти","mol goshti","beef"],
  ["баранина","куй гушти","qoy goshti","lamb"],["помидор","томат","pomidor","tomato"],
  ["огурец","бодринг","bodring","cucumber"],["лук","пиёз","piyoz","onion"],
  ["чеснок","саримсок","sarimsoq","garlic"],["рис","гуруч","guruch","rice"],
  ["яйцо","тухум","tuxum","egg"],["суп","шурпа","шорва","shorva","sho'rva","soup"],
  ["салат","salat"],["соус","sous","sauce"]
];
function normalizeSearch(value:string) {
  return value.toLocaleLowerCase("ru").replace(/ё/g,"е").normalize("NFKD")
    .replace(/[ъь]/g,"").replace(/['’`ʻʼ-]/g,"").replace(/[^a-zа-я0-9ўқғҳ\s]/gi," ")
    .replace(/\s+/g," ").trim();
}
function distanceOne(a:string,b:string) {
  if(Math.abs(a.length-b.length)>1) return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}edits++;if(edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}
  return edits+(i<a.length||j<b.length?1:0)<=1;
}
function smartClientMatch(recipe: Recipe, query: string) {
  if (!query.trim()) return true;
  return scoreVoiceMatch(recipe, query) >= 40;
}

const KITCHEN_DEPTS: KitchenDept[] = [
  { name: "Горячий цех", slug: "goryachiy", icon: "flame", sections: [
    { name: "Паста", slug: "pasta" },
    { name: "Мангал", slug: "mangal" },
    { name: "Соусы", slug: "sousy" },
    { name: "Раздача", slug: "razdacha" },
    { name: "Заготовка", slug: "zagotovka-hot" }
  ]},
  { name: "Суши", slug: "sushi", icon: "leaf", sections: [
    { name: "Роллы", slug: "rolly" },
    { name: "Сашими / Нигири", slug: "sashimi" },
    { name: "Заготовка", slug: "zagotovka-sushi" }
  ]},
  { name: "Холодный цех", slug: "holodniy", icon: "soup", sections: [
    { name: "Салаты", slug: "salaty" },
    { name: "Закуски", slug: "zakuski" },
    { name: "Заготовка", slug: "zagotovka-cold" }
  ]},
  { name: "Кондитерский", slug: "konditerskiy", icon: "cake", sections: [
    { name: "Десерты", slug: "deserty" },
    { name: "Пекарный", slug: "pekarnyy" },
    { name: "Заготовка", slug: "zagotovka-sweet" }
  ]}
];

const DEPT_ICONS: Record<string, typeof Utensils> = {
  flame: Flame, leaf: Leaf, soup: Soup, cake: CakeSlice, utensils: Utensils
};

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [apiState, setApiState] = useState<DataSource>("loading");
  const [apiError, setApiError] = useState<string | undefined>();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const syncFromApi = useCallback(async () => {
    const result = await loadRecipes();
    setRecipes(result.recipes);
    setApiState(result.source);
    setApiError(result.error);
    setLastSync(result.lastSync);
  }, []);

  useEffect(() => {
    // Load favorites from IndexedDB first
    loadFavorites().then(ids => {
      if (ids.length) setFavorites(ids);
    });
    // Initial data load
    syncFromApi();
    // Connectivity watcher
    const unsub = createConnectivityWatcher((online) => {
      setIsOnline(online);
      if (online) syncFromApi();
    });
    return unsub;
  }, [syncFromApi]);

  
  // Deep-link from QR: ?recipe=<id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get("recipe");
    if (!rid || !recipes.length) return;
    const found = recipes.find(r => r.id === rid);
    if (found) {
      setSelected(found);
      setStep(0);
      setCooking(false);
      setDetailTab("ingredients");
      setTargetPortions(Math.max(1, found.portionCount || 1));
      // clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [recipes]);

const [query, setQuery] = useState("");
  const [speechLanguage, setSpeechLanguage] = useState<"ru-RU" | "uz-UZ">("ru-RU");
  const [isListening, setIsListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [speechPreview, setSpeechPreview] = useState("");
    const [department, setDepartment] = useState<string>("Все цеха");
  const [section, setSection] = useState<string>("");
  const [tab, setTab] = useState<"home" | "favorites">("home");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selected,setSelected] = useState<Recipe|null>(null);
  const [step,setStep] = useState(0);
  const [targetPortions,setTargetPortions] = useState(1);
  const [detailTab,setDetailTab] = useState<"ingredients"|"technology"|"calculation">("ingredients");
  const [voiceScreen,setVoiceScreen] = useState(false);
  const [cooking,setCooking] = useState(false);
  const [showFilters,setShowFilters] = useState(false);
  const visible = useMemo(() => recipes.filter(r => {
    const matchesDept = department === "Все цеха" || r.department === department || (!r.department && department === "Все цеха");
    const matchesSection = !section || r.section === section;
    const matchesQuery = smartClientMatch(r, query);
    const matchesTab = tab === "home" || favorites.includes(r.id);
    return matchesDept && matchesSection && matchesQuery && matchesTab;
  }), [recipes, query, department, section, tab, favorites]);

  const activeDept = KITCHEN_DEPTS.find(d => d.name === department);

  const toggleFavorite = (id: string) => {
    setFavorites(old => {
      const next = old.includes(id) ? old.filter(x => x !== id) : [...old, id];
      saveFavorites(next).catch(() => {});
      return next;
    });
  };
  const openRecipe=(r:Recipe)=>{setSelected(r);setStep(0);setCooking(false);setDetailTab("ingredients");setTargetPortions(Math.max(1,r.portionCount||1));};
  const scaledAmount=(ingredient:Recipe["ingredients"][number])=>{
    if(ingredient.quantity==null||!ingredient.unit)return ingredient.amount||"—";
    const base=Math.max(1,selected?.portionCount||1);
    const value=ingredient.quantity*targetPortions/base;
    const rounded=Number(value.toFixed(3));
    return `${new Intl.NumberFormat("ru-RU",{maximumFractionDigits:3}).format(rounded)} ${ingredient.unit}`;
  };
  const scaledCost=selected?.cost?selected.cost.total*(targetPortions/Math.max(1,selected.portionCount||1)):0;
  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) {
      alert("Озвучивание не поддерживается этим браузером.");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLanguage.startsWith("uz") ? "uz-UZ" : "ru-RU";
    u.rate = 0.92;
    u.pitch = 1;
    // Prefer a Russian voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith(u.lang.slice(0, 2)) && /google|microsoft|yandex|premium|enhanced/i.test(v.name))
      || voices.find(v => v.lang.startsWith(u.lang.slice(0, 2)));
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
  };
  const stopRef = { current: null as null | (() => void) };
  const stopListening = () => {
    stopRef.current?.();
    stopRef.current = null;
    setIsListening(false);
  };
  const startListening = async () => {
    if (isListening) {
      stopListening();
      return;
    }
    setSpeechMessage("Слушаю… Произнесите название блюда или ингредиента.");
    setSpeechPreview("");
    setIsListening(true);
    const stop = await startSpeech(speechLanguage as SpeechLang, {
      onInterim: (t) => setSpeechPreview(t),
      onFinal: (t) => {
        const { corrected, matches } = processVoiceQuery(t, recipes, 45);
        setQuery(corrected || t);
        setSpeechPreview("");
        if (matches.length === 1 && matches[0].score >= 80) {
          const r = matches[0].recipe;
          setSelected(r);
          setStep(0);
          setCooking(false);
          setDetailTab("ingredients");
          setTargetPortions(Math.max(1, r.portionCount || 1));
          setVoiceScreen(false);
          setSpeechMessage(`Открыта карта: ${r.name}`);
        } else if (matches.length > 1) {
          setSpeechMessage(`Найдено ${matches.length} карт. Выберите из списка.`);
          setVoiceScreen(false);
        } else {
          setSpeechMessage(corrected ? `Ищем: «${corrected}»` : "Распознанный запрос добавлен в поиск.");
        }
      },
      onError: (msg) => {
        setSpeechMessage(msg);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
        stopRef.current = null;
      }
    });
    stopRef.current = stop;
  };

  return <div className="app-shell">
    <aside className="desktop-sidebar">
      <div className="brand"><span className="brand-mark"><ChefHat size={22}/></span><span>clean kitchen</span></div>
      <div className="side-caption">МЕНЮ</div>
      <button className={tab==="home"?"side-link active":"side-link"} onClick={()=>{setTab("home");setSelected(null)}}><House/>Главная</button>
      <button className={tab==="favorites"?"side-link active":"side-link"} onClick={()=>{setTab("favorites");setSelected(null)}}><Bookmark/>Избранное <span className="side-count">{favorites.length}</span></button>
      <div className="sidebar-bottom"><div className="cook-profile"><div className="avatar">П</div><div><b>Повар</b><small>Рабочий профиль</small></div></div><div className="version">CLEAN KITCHEN · V12 VOICE PRECISION</div></div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <div className="mobile-brand"><span className="brand-mark"><ChefHat size={20}/></span><b>clean kitchen</b></div>
        <div className="topbar-spacer"/>
        <span className="top-date">Рабочее пространство повара</span>
        <div className="avatar top-avatar">П</div>
      </header>
      <main className="content">
        {voiceScreen&&<div className="voice-screen">
          <button className="voice-close" onClick={()=>{stopListening();setVoiceScreen(false);}}>×</button>
          <h2>Овозли қидирув</h2>
          <button className={`voice-orb ${isListening?"active":""}`} onClick={startListening} aria-label="Микрофон">
            <Mic size={42}/>
          </button>
          <div className="voice-wave" aria-hidden="true">{isListening?"▂▅▇▃▆█▂▅▃▇▂":"······"}</div>
          <h3>{isListening?"Гапиринг...":"Қидириш учун микрофонни босинг"}</h3>
          <p className="voice-status">{speechPreview||speechMessage||""}</p>
          {!isListening&&!speechPreview&&(
            <div className="voice-examples">
              <span className="voice-examples-label">Масалан:</span>
              {["Соус болоньезе","Омлет с зеленью","Путанеско соуси"].map(ex=>(
                <button key={ex} className="voice-chip" onClick={()=>{
                  const {corrected,matches}=processVoiceQuery(ex,recipes,40);
                  setQuery(corrected||ex);
                  if(matches.length===1&&matches[0].score>=80){
                    const r=matches[0].recipe;
                    setSelected(r);setStep(0);setCooking(false);setDetailTab("ingredients");
                    setTargetPortions(Math.max(1,r.portionCount||1));setVoiceScreen(false);
                  } else setVoiceScreen(false);
                }}>"{ex}"</button>
              ))}
            </div>
          )}
          <div className="voice-language">
            <button className={speechLanguage==="ru-RU"?"active":""} onClick={()=>setSpeechLanguage("ru-RU")}>🌐 Русча / Ўзбекча ▾</button>
            <button className={speechLanguage==="uz-UZ"?"active":""} onClick={()=>setSpeechLanguage("uz-UZ")} style={{display:"none"}}>UZ</button>
          </div>
          <button className="primary-button" onClick={()=>{stopListening();setVoiceScreen(false);}}>Натижаларни кўриш</button>
        </div>}
        {selected ? <section className="recipe-page">
          <button className="back-link" onClick={()=>setSelected(null)}><ArrowLeft size={17}/> Все технологические карты</button>
          <div className="recipe-hero">
            <div className="recipe-hero-copy"><span className="pill">{[selected.department, selected.section || selected.category].filter(Boolean).join(" · ")}</span><h1>{selected.name}</h1><p>{selected.description}</p><div className="recipe-meta"><span><Utensils size={15}/> Выход: {selected.yield}</span><span><Clock3 size={15}/> {selected.time}</span></div></div>
            <div className="hero-food">{selected.imageUrl?<img src={selected.imageUrl} alt={selected.name}/>:<Soup size={54}/>}<span>ТЕХНОЛОГИК КАРТА</span></div>
          </div>
          <div className="detail-actions"><button className="outline-button" onClick={()=>toggleFavorite(selected.id)}><Bookmark size={16}/>{favorites.includes(selected.id)?"В избранном":"В избранное"}</button><button className="outline-button" onClick={()=>speak(selected.name+". "+selected.ingredients.map(i=>i.name+" "+i.amount).join(". "))}><Volume2 size={16}/>Прослушать</button></div>
          <div className="recipe-tabs"><button className={detailTab==="ingredients"?"active":""} onClick={()=>setDetailTab("ingredients")}>Ингредиентлар</button><button className={detailTab==="technology"?"active":""} onClick={()=>setDetailTab("technology")}>Технология</button><button className={detailTab==="calculation"?"active":""} onClick={()=>setDetailTab("calculation")}>Калькуляция</button></div>
          {detailTab==="calculation"&&selected.cost&&<section className="cost-summary">
            <div><span className="eyebrow">FOOD COST · СЕБЕСТОИМОСТЬ</span><h2>{new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(scaledCost)} {selected.costCurrency||"UZS"}</h2><p>{selected.cost.complete?`Расчёт на ${targetPortions} порц. по указанным закупочным ценам`:"Не для всех ингредиентов указана цена или количество"}</p></div>
            {selected.cost.perPortion!==null&&<div className="cost-per-portion"><span>На 1 порцию</span><b>{new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(selected.cost.perPortion)} {selected.costCurrency||"UZS"}</b><small>{selected.cost.portions} порций</small></div>}
          </section>}
          {detailTab==="calculation"&&<section className="white-panel calculation-panel"><div className="panel-title"><div><span className="eyebrow">FOOD COST</span><h2>Калькуляция рецепта</h2></div></div>{selected.cost?<><div className="calculation-total"><span>Умумий таннарх · {targetPortions} порция</span><b>{new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(scaledCost)} {selected.costCurrency||"UZS"}</b></div><div className="ingredient-table"><div className="table-head"><span>Ингредиент</span><span>Қиймати</span></div>{selected.cost.lines?.map((line:any,index:number)=><div className="ingredient-row" key={`${line.name}-${index}`}><span>{line.name}</span><b>{new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(line.total*(targetPortions/Math.max(1,selected.portionCount||1)))} {selected.costCurrency||"UZS"}</b></div>)}</div><p className="calculation-note">{selected.cost.complete?"Барча ингредиентлар нархи ҳисобга олинган":"Айрим ингредиентлар учун нарх ёки миқдор киритилмаган."}</p></>:<p>Калькуляция маълумотлари мавжуд эмас.</p>}</section>}
          {detailTab==="ingredients"&&<div className="detail-grid">
            <section className="white-panel"><div className="panel-title"><div><span className="eyebrow">СОСТАВ</span><h2>Ингредиенты</h2></div><span className="subtle-count">{selected.ingredients.length} позиций</span></div>
              {selected.portionCount&&selected.portionCount>0&&<div className="portion-scaler"><div><span>Количество порций</span><small>Базовый рецепт: {selected.portionCount}</small></div><div className="portion-controls"><button aria-label="Уменьшить порции" onClick={()=>setTargetPortions(v=>Math.max(1,v-1))}>−</button><input aria-label="Нужное количество порций" type="number" min="1" max="10000" value={targetPortions} onChange={e=>setTargetPortions(Math.max(1,Math.min(10000,Number(e.target.value)||1)))}/><button aria-label="Увеличить порции" onClick={()=>setTargetPortions(v=>Math.min(10000,v+1))}>+</button></div></div>}
              <div className="ingredient-table"><div className="table-head"><span>Наименование</span><span>Количество</span></div>{selected.ingredients.map((i,n)=><div className="ingredient-row" key={i.name}><span><i>{n+1}</i>{i.name}</span><b>{selected.portionCount&&selected.portionCount>0?scaledAmount(i):i.amount}</b></div>)}</div>
            </section>
          </div>}
          {detailTab==="technology"&&<section className="white-panel method-panel timeline-panel"><div className="panel-title"><div><span className="eyebrow">ПРИГОТОВЛЕНИЕ</span><h2>Технология</h2></div><button className="round-action" onClick={()=>speak(selected.steps[step])}><Volume2 size={17}/></button></div>
              <div className="step-progress"><span>Шаг {step+1} из {selected.steps.length}</span><div><i style={{width:`${((step+1)/selected.steps.length)*100}%`}}/></div></div>
              {selected.stepImages?.[step]&&<img className="timeline-photo" src={selected.stepImages[step]} alt={`Қадам ${step+1}`}/>}<div className="current-step"><span className="step-number">{String(step+1).padStart(2,"0")}</span><p>{selected.steps[step]}</p></div>
              <div className="step-buttons"><button className="outline-button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Назад</button><button className="primary-button" onClick={()=>step===selected.steps.length-1?setStep(0):setStep(s=>s+1)}>{step===selected.steps.length-1?"Сначала":"Следующий шаг"}<ChevronRight size={16}/></button></div>
            </section>}
        </section> : <>
          <section className="welcome-block"><div><span className="eyebrow">{tab==="home"?"КУХНЯ · ТЕХНОЛОГИЧЕСКИЕ КАРТЫ":"ВАШИ СОХРАНЁННЫЕ РЕЦЕПТЫ"}</span><h1>{tab==="home"?"Добрый день!":"Избранное"}</h1><p>{tab==="home"?"Все рецепты ресторана — в одном удобном месте.":"Карты, к которым вы хотите быстро вернуться."}</p><span className={`api-status ${apiState}`}>
              {apiState === "loading"
                ? "Подключение…"
                : apiState === "server"
                  ? "Онлайн · данные сервера"
                  : apiState === "cache"
                    ? `Офлайн · локальный кэш${lastSync ? ` · ${new Date(lastSync).toLocaleString("ru-RU")}` : ""}`
                    : `Демо-режим · ${MOCK_RECIPES.length} тестовых карт`}
            </span>
            {apiState !== "server" && apiState !== "loading" && (
              <button className="sync-btn" onClick={() => syncFromApi()} title={apiError || "Повторить синхронизацию"}>
                <RefreshCw size={14} /> {apiState === "mock" ? "Подключиться к серверу" : "Синхронизировать"}
              </button>
            )}
            {!isOnline && <span className="api-status offline"><WifiOff size={13}/> Нет сети</span>}
          </div><div className="welcome-illustration"><ChefHat size={40}/><span>Готовим с точностью</span></div></section>
          <section className="search-card"><div className="search-field"><Search size={21}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти блюдо или ингредиент..."/>{query&&<button className="clear-search" onClick={()=>setQuery("")}><X size={16}/></button>}<button className="filter-button" onClick={()=>setShowFilters(!showFilters)} title="Фильтры"><SlidersHorizontal size={18}/></button><select className="speech-language" aria-label="Язык голосового поиска" value={speechLanguage} onChange={e=>setSpeechLanguage(e.target.value as "ru-RU"|"uz-UZ")} disabled={isListening}><option value="ru-RU">RU</option><option value="uz-UZ">UZ</option></select><button className={`voice-button ${isListening?"listening":""}`} onClick={()=>setVoiceScreen(true)} title={isListening?"Остановить запись":"Голосовой поиск"} aria-label={isListening?"Остановить запись":"Начать голосовой поиск"}><Mic size={21}/></button></div>{(speechMessage||speechPreview)&&<div className={`speech-feedback ${isListening?"active":""}`} aria-live="polite">{isListening&&<span className="listening-dot"/>}{speechPreview||speechMessage}</div>}{showFilters&&<div className="filter-note">Поиск учитывает название, категорию, ингредиенты и ключевые слова.</div>}<div className="search-foot"><span>Быстрый поиск по технологическим картам</span><kbd>⌘ K</kbd></div></section>
          <section className="category-section">
            <div className="section-heading">
              <div><span className="eyebrow">ЦЕХА И УЧАСТКИ</span><h2>Позиции кухни</h2></div>
              <span className="muted">{KITCHEN_DEPTS.length} цеха</span>
            </div>
            <div className="category-grid dept-grid">
              <button
                className={department==="Все цеха"?"category-card selected":"category-card"}
                onClick={()=>{setDepartment("Все цеха");setSection("");}}
              >
                <span className="category-icon"><Utensils size={20}/></span>
                <b>Все цеха</b>
                <ChevronRight size={15}/>
              </button>
              {KITCHEN_DEPTS.map(d => {
                const Icon = DEPT_ICONS[d.icon] || Utensils;
                return (
                  <button
                    key={d.slug}
                    className={department===d.name?"category-card selected":"category-card"}
                    onClick={()=>{setDepartment(d.name);setSection("");}}
                  >
                    <span className="category-icon"><Icon size={20}/></span>
                    <b>{d.name}</b>
                    <ChevronRight size={15}/>
                  </button>
                );
              })}
            </div>
            {activeDept && (
              <div className="section-chips">
                <button
                  className={!section?"chip selected":"chip"}
                  onClick={()=>setSection("")}
                >Все участки</button>
                {activeDept.sections.map(s => (
                  <button
                    key={s.slug}
                    className={section===s.name?"chip selected":"chip"}
                    onClick={()=>setSection(s.name)}
                  >{s.name}</button>
                ))}
              </div>
            )}
          </section>
          <section className="recipes-section"><div className="section-heading"><div><span className="eyebrow">КОЛЛЕКЦИЯ РЕСТОРАНА</span><h2>{tab==="home"?"Все карты":"Избранные карты"}</h2></div><span className="result-count">{visible.length} {visible.length===1?"карта":"карт"}</span></div>
            {apiState==="loading"?<div className="recipe-grid">{Array.from({length:6}).map((_,i)=><div className="recipe-card skeleton" key={i}/>)}</div>:visible.length?<div className="recipe-grid">{visible.map((r,index)=><article className="recipe-card" key={r.id}><button className="recipe-art" onClick={()=>openRecipe(r)}>{r.imageUrl?<img className="recipe-card-photo" src={r.imageUrl} alt={r.name}/>:<span className={`food-symbol food-${index%4}`}><Utensils size={27}/></span>}<span className="card-category">{r.section || r.category}{r.department ? ` · ${r.department}` : ""}</span></button><div className="recipe-card-body"><button className="favorite-toggle" onClick={()=>toggleFavorite(r.id)} aria-label="Избранное"><Bookmark size={17} fill={favorites.includes(r.id)?"currentColor":"none"}/></button><button className="recipe-name" onClick={()=>openRecipe(r)}>{r.name}</button><p>{r.description}</p><div className="card-meta"><span><Utensils size={13}/>{r.yield}</span><span><Clock3 size={13}/>{r.time}</span></div><button className="open-recipe" onClick={()=>openRecipe(r)}>Открыть карту <ChevronRight size={15}/></button></div></article>)}</div>:<div className="empty-state"><Search size={28}/><b>Ничего не найдено</b><span>Измените запрос или выберите другую категорию.</span><button onClick={()=>{setQuery("");setDepartment("Все цеха");setSection("");}}>Сбросить фильтры</button></div>}
          </section>
        </>}
      </main>
      <footer className="footer">CLEAN KITCHEN <span>·</span> ПРОСТО. УДОБНО. ПО ДЕЛУ.</footer>
    </div>
    <nav className="mobile-nav"><button className={tab==="home"?"active":""} onClick={()=>{setTab("home");setSelected(null)}}><House/><span>Главная</span></button><button className={tab==="favorites"?"active":""} onClick={()=>{setTab("favorites");setSelected(null)}}><Bookmark/><span>Избранное</span></button><button onClick={()=>alert("Профиль будет реализован на этапе авторизации.")}><UserRound/><span>Профиль</span></button></nav>
  </div>;
}
