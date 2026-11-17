import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconBack, IconCamera, IconChevronRight, IconCloudDown, IconDownload, IconImport,
  IconInfo, IconLink, IconRefresh, IconScan, IconSearch, IconShare, IconTrash, IconWifi, IconWifiOff
} from "../components/Icons";
import { RecipeImage } from "../components/RecipeImage";
import { cacheRecipes, loadCachedRecipes, getLastSync } from "../lib/offline";
import type { DataSource, Recipe } from "../types";

const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
export const recipeLink = (id: string) => `${location.origin}${location.pathname}?recipe=${encodeURIComponent(id)}`;

/** Общая обёртка экрана со стрелкой «назад» */
export function Page({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="page">
      <header className="page-head">
        <button className="round-btn flat" onClick={onBack} aria-label="Назад"><IconBack size={22} /></button>
        <h1>{title}</h1>
        <span className="page-head-gap" />
      </header>
      {children}
    </div>
  );
}

/* ─────────────── Уведомления ─────────────── */

export function NotificationsScreen(p: {
  source: DataSource; isOnline: boolean; apiError?: string; lastSync: string | null;
  draftCount: number; favCount: number; onSync: () => void; onOffline: () => void; onImport: () => void; onBack: () => void;
}) {
  const items: { icon: ReactNode; title: string; text: string; tone: "ok" | "warn" | "info"; action?: [string, () => void] }[] = [];
  if (!p.isOnline) {
    items.push({ icon: <IconWifiOff size={20} />, title: "Нет подключения к сети", text: "Работаем с сохранёнными на устройстве картами.", tone: "warn", action: ["Офлайн-режим", p.onOffline] });
  }
  if (p.source === "server") {
    items.push({ icon: <IconWifi size={20} />, title: "Данные с сервера", text: p.lastSync ? `Последняя синхронизация: ${new Date(p.lastSync).toLocaleString("ru-RU")}.` : "Карты загружены с сервера.", tone: "ok" });
  } else if (p.source === "cache") {
    items.push({ icon: <IconCloudDown size={20} />, title: "Показаны сохранённые карты", text: `Сервер недоступен${p.apiError ? ` (${p.apiError})` : ""}. Используется локальный кэш.`, tone: "warn", action: ["Обновить", p.onSync] });
  } else if (p.source === "mock") {
    items.push({ icon: <IconInfo size={20} />, title: "Демо-режим", text: `Сервер недоступен${p.apiError ? ` (${p.apiError})` : ""}. Показаны тестовые карты.`, tone: "warn", action: ["Подключиться к серверу", p.onSync] });
  }
  if (p.draftCount > 0) {
    items.push({ icon: <IconImport size={20} />, title: `Импортировано карточек: ${p.draftCount}`, text: "Карточки, созданные из фото и PDF.", tone: "info", action: ["Открыть сканер", p.onImport] });
  }
  items.push({ icon: <IconInfo size={20} />, title: `Сохранённых карт: ${p.favCount}`, text: "Добавляйте карты в закладки, чтобы быстро к ним возвращаться.", tone: "info" });
  return (
    <Page title="Уведомления" onBack={p.onBack}>
      <div className="notes">
        {items.map((n, i) => (
          <div key={i} className={`note-card ${n.tone}`}>
            <span className="note-ico">{n.icon}</span>
            <div>
              <b>{n.title}</b>
              <p>{n.text}</p>
              {n.action && <button className="btn-soft sm" onClick={n.action[1]}>{n.action[0]}</button>}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ─────────────── Сканер QR ─────────────── */

export function resolveRecipeCode(raw: string, recipes: Recipe[]): Recipe | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  let id = text;
  try {
    const u = new URL(text);
    id = u.searchParams.get("recipe") || u.hash.replace("#", "") || text;
  } catch { /* не ссылка */ }
  return recipes.find((r) => r.id === id) || recipes.find((r) => r.name.toLowerCase() === text.toLowerCase());
}

export function ScanScreen({ recipes, onOpen, onBack }: { recipes: Recipe[]; onOpen: (r: Recipe) => void; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState("Наведите камеру на QR-код карты");
  const [camErr, setCamErr] = useState("");
  const [manual, setManual] = useState("");
  const doneRef = useRef(false);
  const recipesRef = useRef(recipes);
  recipesRef.current = recipes;

  const handleCode = useCallback((code: string) => {
    const r = resolveRecipeCode(code, recipesRef.current);
    if (r) {
      doneRef.current = true;
      onOpen(r);
      return true;
    }
    setMsg("Карта не найдена. Проверьте код и попробуйте ещё раз.");
    return false;
  }, [onOpen]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let alive = true;
    let last = 0;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamErr("Камера недоступна в этом браузере. Введите код вручную или выберите фото.");
        return;
      }
      try {
        const { default: jsQR } = await import("jsqr");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current!;
        v.srcObject = stream;
        v.setAttribute("playsinline", "true");
        await v.play();
        const tick = (t: number) => {
          raf = requestAnimationFrame(tick);
          if (doneRef.current || t - last < 160 || v.videoWidth === 0) return;
          last = t;
          const c = canvasRef.current!;
          const w = 480;
          const h = Math.round((v.videoHeight / v.videoWidth) * w);
          c.width = w; c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const res = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
          if (res?.data) handleCode(res.data);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setCamErr("Нет доступа к камере. Разрешите доступ в настройках браузера или введите код вручную.");
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [handleCode]);

  const onFile = async (f?: File | null) => {
    if (!f) return;
    try {
      const { default: jsQR } = await import("jsqr");
      const bmp = await createImageBitmap(f);
      const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const res = jsQR(d.data, c.width, c.height);
      if (res?.data) handleCode(res.data);
      else setMsg("QR-код на фото не найден.");
    } catch {
      setMsg("Не удалось прочитать изображение.");
    }
  };

  return (
    <Page title="Сканер QR-кода" onBack={onBack}>
      <div className="scanner">
        {camErr ? (
          <div className="scan-fallback"><IconCamera size={34} /><p>{camErr}</p></div>
        ) : (
          <>
            <video ref={videoRef} muted playsInline />
            <div className="scan-frame"><i /><i /><i /><i /></div>
          </>
        )}
        <canvas ref={canvasRef} hidden />
      </div>
      <p className="scan-msg" aria-live="polite">{msg}</p>
      <form className="manual" onSubmit={(e) => { e.preventDefault(); handleCode(manual); }}>
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Код или ссылка на карту" aria-label="Код карты" />
        <button className="btn-primary" type="submit">Открыть</button>
      </form>
      <label className="btn-soft file-btn">
        <IconCamera size={18} /> Выбрать фото с QR-кодом
        <input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
    </Page>
  );
}

/* ─────────────── Калькуляция ─────────────── */

export function CalcScreen({ recipes, onOpen, onBack }: { recipes: Recipe[]; onOpen: (r: Recipe) => void; onBack: () => void }) {
  const [sort, setSort] = useState<"cost" | "name">("cost");
  const withCost = useMemo(() => recipes.filter((r) => r.cost && r.cost.total > 0), [recipes]);
  const rows = useMemo(() => {
    const per = (r: Recipe) => r.cost?.perPortion ?? r.cost?.total ?? 0;
    return [...withCost].sort((a, b) => (sort === "cost" ? per(b) - per(a) : a.name.localeCompare(b.name, "ru")));
  }, [withCost, sort]);
  const avg = withCost.length ? withCost.reduce((s, r) => s + (r.cost?.perPortion ?? r.cost?.total ?? 0), 0) / withCost.length : 0;
  const cur = withCost[0]?.costCurrency || "UZS";
  return (
    <Page title="Калькуляция" onBack={onBack}>
      <div className="cost-card">
        <span>Средняя себестоимость порции</span>
        <b>{nf.format(Math.round(avg))} {cur}</b>
        <small>Карт с расчётом: {withCost.length} из {recipes.length}</small>
      </div>
      <div className="seg two" role="tablist">
        <button className={sort === "cost" ? "on" : ""} onClick={() => setSort("cost")}>По стоимости</button>
        <button className={sort === "name" ? "on" : ""} onClick={() => setSort("name")}>По названию</button>
      </div>
      {rows.length === 0 && <div className="empty"><b>Нет данных для расчёта</b><span>В картах не указаны закупочные цены.</span></div>}
      <div className="rows">
        {rows.map((r) => (
          <button key={r.id} className="row calc-row" onClick={() => onOpen(r)}>
            <RecipeImage recipe={r} className="row-img sm" />
            <span className="row-text">
              <b>{r.name}</b>
              <small>{r.cost?.portions ?? r.portionCount ?? 1} порц. · всего {nf.format(r.cost!.total)} {r.costCurrency || cur}</small>
            </span>
            <span className="calc-price">
              <b>{nf.format(r.cost?.perPortion ?? r.cost!.total)}</b>
              <small>{r.costCurrency || cur} / порц.</small>
            </span>
          </button>
        ))}
      </div>
    </Page>
  );
}

/* ─────────────── QR-код карты ─────────────── */

export function QrScreen({ recipes, onScan, onBack }: { recipes: Recipe[]; onScan: () => void; onBack: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Recipe | null>(null);
  const [img, setImg] = useState("");
  const [toast, setToast] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return recipes.filter((r) => !s || r.name.toLowerCase().includes(s)).slice(0, 40);
  }, [recipes, q]);

  useEffect(() => {
    if (!sel) { setImg(""); return; }
    let alive = true;
    import("qrcode").then(({ default: QR }) =>
      QR.toDataURL(recipeLink(sel.id), { width: 640, margin: 1, errorCorrectionLevel: "M", color: { dark: "#1a1b20", light: "#ffffff" } })
    ).then((u) => alive && setImg(u)).catch(() => alive && setToast("Не удалось создать QR-код"));
    return () => { alive = false; };
  }, [sel]);

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(""), 1800); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(recipeLink(sel!.id)); flash("Ссылка скопирована"); } catch { flash("Не удалось скопировать"); }
  };
  const share = async () => {
    try { await navigator.share({ title: sel!.name, url: recipeLink(sel!.id) }); } catch { /* отмена */ }
  };

  if (sel) {
    return (
      <Page title="QR-код карты" onBack={() => setSel(null)}>
        <div className="qr-card">
          <b>{sel.name}</b>
          <small>{[sel.department, sel.section || sel.category].filter(Boolean).join(" · ")}</small>
          <div className="qr-box">{img ? <img src={img} alt={`QR-код карты «${sel.name}»`} /> : <span className="spin" />}</div>
          <p>Распечатайте код и разместите на рабочем месте — карта откроется по сканированию.</p>
        </div>
        <div className="actions-col">
          <a className={`btn-primary ${img ? "" : "disabled"}`} href={img || undefined} download={`qr-${sel.id}.png`}><IconDownload size={18} /> Скачать PNG</a>
          <button className="btn-soft" onClick={copy}><IconLink size={18} /> Копировать ссылку</button>
          {typeof navigator.share === "function" && <button className="btn-soft" onClick={share}><IconShare size={18} /> Поделиться</button>}
        </div>
        {toast && <div className="toast">{toast}</div>}
      </Page>
    );
  }
  return (
    <Page title="QR-код карты" onBack={onBack}>
      <button className="btn-primary wide" onClick={onScan}><IconScan size={20} /> Сканировать QR-код</button>
      <h3 className="menu-h">Создать QR-код для карты</h3>
      <div className="searchbar compact">
        <IconSearch size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти карту…" aria-label="Найти карту" />
      </div>
      <div className="menu-list">
        {list.map((r) => (
          <button key={r.id} onClick={() => setSel(r)}>
            <RecipeImage recipe={r} className="row-img xs" />
            <span className="menu-text"><b>{r.name}</b><small>{[r.department, r.section || r.category].filter(Boolean).join(" · ")}</small></span>
            <IconChevronRight size={18} />
          </button>
        ))}
        {list.length === 0 && <div className="empty"><b>Ничего не найдено</b></div>}
      </div>
    </Page>
  );
}

/* ─────────────── Офлайн-режим ─────────────── */

export function OfflineScreen(p: {
  recipes: Recipe[]; source: DataSource; isOnline: boolean; onSync: () => Promise<void> | void; onBack: () => void;
}) {
  const [cached, setCached] = useState<number | null>(null);
  const [sync, setSync] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(""), 1800); };

  const refresh = useCallback(async () => {
    try { setCached((await loadCachedRecipes()).length); } catch { setCached(0); }
    setSync(await getLastSync());
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const save = async () => {
    setBusy(true);
    try {
      await cacheRecipes(p.recipes as never);
      flash(`Сохранено карт: ${p.recipes.length}`);
    } catch { flash("Не удалось сохранить"); }
    setBusy(false);
    void refresh();
  };
  const clear = async () => {
    setBusy(true);
    try { await cacheRecipes([]); flash("Кэш очищен"); } catch { flash("Не удалось очистить"); }
    setBusy(false);
    void refresh();
  };
  const update = async () => { setBusy(true); await p.onSync(); setBusy(false); void refresh(); };

  return (
    <Page title="Офлайн-режим" onBack={p.onBack}>
      <div className={`offline-hero ${p.isOnline ? "on" : "off"}`}>
        <span className="note-ico">{p.isOnline ? <IconWifi size={24} /> : <IconWifiOff size={24} />}</span>
        <div>
          <b>{p.isOnline ? "Сеть доступна" : "Нет сети"}</b>
          <p>{p.isOnline ? "Сохраните карты на устройство, чтобы они открывались без интернета." : "Приложение работает с картами, сохранёнными на устройстве."}</p>
        </div>
      </div>
      <div className="stats">
        <div><b>{cached ?? "—"}</b><span>карт в памяти устройства</span></div>
        <div><b>{p.recipes.length}</b><span>карт сейчас загружено</span></div>
      </div>
      <p className="muted-line">Последняя синхронизация: {sync ? new Date(sync).toLocaleString("ru-RU") : "ещё не выполнялась"}</p>
      <div className="actions-col">
        <button className="btn-primary" onClick={save} disabled={busy}><IconCloudDown size={18} /> Сохранить все карты для офлайна</button>
        <button className="btn-soft" onClick={update} disabled={busy || !p.isOnline}><IconRefresh size={18} /> Обновить с сервера</button>
        <button className="btn-soft danger" onClick={clear} disabled={busy || !cached}><IconTrash size={18} /> Очистить сохранённые карты</button>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </Page>
  );
}

