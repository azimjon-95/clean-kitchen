import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Recipe } from "../types";
import { IconCamera, IconCheck, IconClose, IconImport, IconInfo, IconPlus, IconQr, IconRefresh, IconTrash } from "../components/Icons";
import { Page, ScanScreen } from "./Tools";
import { TesseractEngine, type OcrEngine } from "../scanner/engine";
import { analyzePages, rereadCell } from "../scanner/pipeline";
import { canvasFromBlob, detectQuad, liveQuality, makeCanvas } from "../scanner/imaging";
import { buildPage, makeRaw, rotateRaw, type Raw } from "../scanner/capture";
import { renderPdf } from "../scanner/pdf";
import { validate } from "../scanner/validate";
import { toRecipe } from "../scanner/convert";
import { saveDoc } from "../lib/imports";
import { COL_LABEL, DOC_TYPE_LABEL, HEADER_LABEL, type ColKey, type Field, type HeaderKey, type PageData, type Pt, type Quad, type Rect, type Row, type ScanResult } from "../scanner/types";

type Mode = "camera" | "photo" | "pdf" | "qr";
type Step = "capture" | "adjust" | "pages" | "processing" | "review";

const tier = (f?: Field): "ok" | "mid" | "bad" => {
  if (!f) return "bad";
  if (f.edited) return "ok";
  if (f.c < 0 || f.c < 60) return "bad";
  if (f.c < 85 || f.note) return "mid";
  return "ok";
};
const TIER_LABEL = { ok: "Уверенно", mid: "Проверьте", bad: "Не уверен" };

/* ─────────── Редактор углов ─────────── */
function CornerEditor({ raw, onChange }: { raw: Raw; onChange: (q: Quad) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scale = () => (wrapRef.current ? wrapRef.current.clientWidth / raw.canvas.width : 1);

  useEffect(() => {
    const c = ref.current!;
    const k = scale() || 0.3;
    c.width = Math.round(raw.canvas.width * k); c.height = Math.round(raw.canvas.height * k);
    const g = c.getContext("2d")!;
    g.drawImage(raw.canvas, 0, 0, c.width, c.height);
    g.fillStyle = "rgba(240,122,46,0.18)";
    g.strokeStyle = "#f07a2e"; g.lineWidth = 3;
    g.beginPath();
    raw.quad.forEach((p, i) => (i ? g.lineTo(p.x * k, p.y * k) : g.moveTo(p.x * k, p.y * k)));
    g.closePath(); g.fill(); g.stroke();
  }, [raw]);

  const pos = (e: React.PointerEvent): Pt => {
    const r = ref.current!.getBoundingClientRect();
    const k = raw.canvas.width / r.width;
    return { x: Math.max(0, Math.min(raw.canvas.width, (e.clientX - r.left) * k)), y: Math.max(0, Math.min(raw.canvas.height, (e.clientY - r.top) * k)) };
  };
  const down = (e: React.PointerEvent) => {
    const p = pos(e);
    let best = -1, bd = Infinity;
    raw.quad.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = i; } });
    const r = ref.current!.getBoundingClientRect();
    if (bd * (r.width / raw.canvas.width) < 48) { setDrag(best); (e.target as Element).setPointerCapture(e.pointerId); }
  };
  const move = (e: React.PointerEvent) => {
    if (drag < 0) return;
    const q = raw.quad.slice() as Quad;
    q[drag] = pos(e);
    onChange(q);
  };
  const r = ref.current?.getBoundingClientRect();
  return (
    <div className="corner-wrap" ref={wrapRef}>
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={() => setDrag(-1)} onPointerCancel={() => setDrag(-1)} />
      {r && raw.quad.map((q, i) => (
        <i key={i} className={`handle ${drag === i ? "on" : ""}`} style={{ left: (q.x / raw.canvas.width) * 100 + "%", top: (q.y / raw.canvas.height) * 100 + "%" }} />
      ))}
    </div>
  );
}

/* ─────────── Камера ─────────── */
function CameraView({ onShot, onFail }: { onShot: (c: HTMLCanvasElement) => void; onFail: (msg: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hint, setHint] = useState("Положите документ в кадр");
  const [hintLevel, setHintLevel] = useState<"" | "good" | "warn">("");
  const [torch, setTorch] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [auto, setAuto] = useState(true);
  const autoRef = useRef(true); autoRef.current = auto;
  const stable = useRef({ n: 0, q: null as Quad | null });
  const doneRef = useRef(false);

  const shoot = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || doneRef.current) return;
    doneRef.current = true;
    const c = makeCanvas(v.videoWidth, v.videoHeight);
    c.getContext("2d")!.drawImage(v, 0, 0);
    onShot(c);
  }, [onShot]);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { onFail("Камера недоступна в этом браузере — выберите фото или PDF."); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        const v = videoRef.current!;
        v.srcObject = s; v.setAttribute("playsinline", "true");
        await v.play();
        const caps: any = s.getVideoTracks()[0].getCapabilities?.() ?? {};
        setCanTorch(!!caps.torch);
        timer = window.setInterval(() => {
          if (!v.videoWidth) return;
          const { quad, coverage } = detectQuad(v, 320);
          const o = overlayRef.current!;
          o.width = v.clientWidth; o.height = v.clientHeight;
          const g = o.getContext("2d")!;
          g.clearRect(0, 0, o.width, o.height);
          const lq = liveQuality(v);
          let level: "" | "good" | "warn" = "";
          let text = "Наведите на документ";
          if (quad) {
            // object-fit: cover → пересчёт координат
            const vr = v.videoWidth / v.videoHeight, er = o.width / o.height;
            let sc: number, ox = 0, oy = 0;
            if (vr > er) { sc = o.height / v.videoHeight; ox = (o.width - v.videoWidth * sc) / 2; } else { sc = o.width / v.videoWidth; oy = (o.height - v.videoHeight * sc) / 2; }
            g.strokeStyle = "#3ddc84"; g.lineWidth = 4; g.fillStyle = "rgba(61,220,132,.18)";
            g.beginPath();
            quad.forEach((p, i) => (i ? g.lineTo(p.x * sc + ox, p.y * sc + oy) : g.moveTo(p.x * sc + ox, p.y * sc + oy)));
            g.closePath(); g.fill(); g.stroke();
            if (lq.mean < 70) { text = "Темно — включите вспышку"; level = "warn"; }
            else if (lq.sharp < 0.05) { text = "Держите ровно — наводится резкость"; level = "warn"; }
            else if (coverage < 0.3) { text = "Подойдите ближе"; level = "warn"; }
            else { text = autoRef.current ? "Документ найден — не двигайтесь" : "Документ найден — нажмите кнопку"; level = "good"; }
            const prev = stable.current.q;
            const moved = prev ? quad.reduce((a, p, i) => a + Math.hypot(p.x - prev[i].x, p.y - prev[i].y), 0) / (v.videoWidth * 4) : 1;
            stable.current = { n: level === "good" && moved < 0.015 ? stable.current.n + 1 : 0, q: quad };
            if (autoRef.current && stable.current.n >= 6) shoot();
          } else { stable.current = { n: 0, q: null }; if (lq.mean < 70) { text = "Темно — включите вспышку"; level = "warn"; } }
          setHint(text); setHintLevel(level);
        }, 330);
      } catch { onFail("Нет доступа к камере. Разрешите доступ в настройках или выберите фото/PDF."); }
    })();
    return () => { alive = false; clearInterval(timer); streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [onFail, shoot]);

  const toggleTorch = async () => {
    const t = streamRef.current?.getVideoTracks()[0];
    try { await t?.applyConstraints({ advanced: [{ torch: !torch } as any] }); setTorch(!torch); } catch { /* не поддерживается */ }
  };

  return (
    <div className="doc-cam">
      <video ref={videoRef} muted playsInline />
      <canvas ref={overlayRef} className="doc-overlay" />
      <div className={`cam-hint ${hintLevel}`} aria-live="polite">{hint}</div>
      <div className="cam-bar">
        <button className={`cam-chip ${auto ? "on" : ""}`} onClick={() => setAuto(!auto)}>Авто</button>
        <button className="cam-shot" onClick={shoot} aria-label="Сделать снимок"><i /></button>
        <button className={`cam-chip ${torch ? "on" : ""}`} onClick={toggleTorch} disabled={!canTorch} title={canTorch ? "" : "Вспышка недоступна"}>Вспышка</button>
      </div>
    </div>
  );
}

/* ─────────── Экран проверки ─────────── */
function cropUrl(src: HTMLCanvasElement, r: Rect | undefined, pad = 6): string {
  if (!r) return "";
  const x0 = Math.max(0, r[0] - pad), y0 = Math.max(0, r[1] - pad);
  const w = Math.min(src.width, r[2] + pad) - x0, h = Math.min(src.height, r[3] + pad) - y0;
  if (w < 4 || h < 4) return "";
  const c = makeCanvas(w, h);
  c.getContext("2d")!.drawImage(src, x0, y0, w, h, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.8);
}

function Cell({ f, onEdit, label, num, busy }: { f?: Field; onEdit: (v: string) => void; label: string; num?: boolean; busy?: boolean }) {
  const t = tier(f);
  return (
    <label className={`rv-cell ${t}`} title={f?.note ?? ""}>
      <small>{label}</small>
      <input value={f?.v ?? ""} inputMode={num ? "decimal" : "text"} onChange={(e) => onEdit(e.target.value)} placeholder={busy ? "…" : "—"} />
      {f?.note && !f.edited && <em>{f.note}</em>}
    </label>
  );
}

function Review(p: { res: ScanResult; pages: PageData[]; engine: OcrEngine; onChange: (r: ScanResult) => void; onSave: () => void; onCancel: () => void; saving: boolean }) {
  const { res, pages } = p;
  const { warnings, computed } = useMemo(() => validate(res), [res]);
  const [showOrig, setShowOrig] = useState<number | null>(null);
  const [ack, setAck] = useState(false);
  const [busyRow, setBusyRow] = useState("");

  const crops = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of res.rows) if (r.rect) m[r.id] = cropUrl(pages[r.page]?.rectified ?? pages[0].rectified, r.rect);
    return m;
  }, [pages, res.rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const setHeader = (k: HeaderKey, v: string) => p.onChange({ ...res, header: { ...res.header, [k]: { v, c: res.header[k]?.c ?? 0, edited: true } } });
  const patchRow = (id: string, fn: (r: Row) => Row) => p.onChange({ ...res, rows: res.rows.map((r) => (r.id === id ? fn(r) : r)) });
  const setCol = (id: string, k: ColKey, v: string) => patchRow(id, (r) => ({ ...r, cols: { ...r.cols, [k]: { v, c: 100, edited: true } } }));
  const setPart = (id: string, part: "n" | "name" | "unit", v: string) => patchRow(id, (r) => ({ ...r, [part]: { v, c: 100, edited: true } }));
  const delRow = (id: string) => p.onChange({ ...res, rows: res.rows.filter((r) => r.id !== id) });
  const addRow = () => {
    const f = (): Field => ({ v: "", c: 100, edited: true });
    const cols: Row["cols"] = {}; for (const k of res.colKeys) cols[k] = f();
    p.onChange({ ...res, rows: [...res.rows, { id: `m${Date.now()}`, page: 0, n: { v: String(res.rows.length + 1), c: 100, edited: true }, name: f(), unit: f(), cols }] });
  };
  const reread = async (row: Row) => {
    setBusyRow(row.id);
    try {
      const pg = pages[row.page]?.rectified ?? pages[0].rectified;
      const cols: Row["cols"] = { ...row.cols };
      for (const k of res.colKeys) { const r = row.cells?.[k]; if (r && !row.cols[k]?.edited) cols[k] = await rereadCell(p.engine, pg, r as Rect, "num"); }
      const name = row.cells?.name && !row.name.edited ? await rereadCell(p.engine, pg, row.cells.name, "text") : row.name;
      patchRow(row.id, (r) => ({ ...r, cols, name }));
    } finally { setBusyRow(""); }
  };

  const unconfirmed = res.rows.reduce((n, r) => n + [r.name, r.unit, ...res.colKeys.map((k) => r.cols[k])].filter((f) => tier(f) === "bad").length, 0)
    + (tier(res.header.dish) === "bad" ? 1 : 0);
  const midCount = res.rows.reduce((n, r) => n + [r.name, r.unit, ...res.colKeys.map((k) => r.cols[k])].filter((f) => tier(f) === "mid").length, 0);
  const headerKeys = (Object.keys(HEADER_LABEL) as HeaderKey[]).filter((k) => res.header[k] || ["dish", "yield", "org", "venue"].includes(k));
  const canSave = !!res.header.dish?.v.trim() && res.rows.length > 0 && (unconfirmed === 0 || ack);

  return (
    <div className="review">
      <div className="rv-top">
        <span className={`doc-chip ${res.docType}`}>{DOC_TYPE_LABEL[res.docType]}</span>
        <small>{res.engine} · {(res.ms / 1000).toFixed(1)} с</small>
      </div>
      {res.docType === "unknown" && <div className="note-card warn"><span className="note-ico"><IconInfo size={20} /></span><div><b>Документ не опознан</b><p>Это не похоже на технологическую или калькуляционную карту. Можно заполнить поля вручную или переснять документ.</p></div></div>}
      <div className="rv-legend"><span className="ok">Уверенно</span><span className="mid">Проверьте</span><span className="bad">Не уверен</span></div>

      <h3 className="menu-h">Шапка документа</h3>
      <div className="rv-grid">
        {headerKeys.map((k) => <Cell key={k} f={res.header[k] ?? { v: "", c: -1 }} label={HEADER_LABEL[k]} onEdit={(v) => setHeader(k, v)} />)}
      </div>

      <h3 className="menu-h">Состав ({res.rows.length})</h3>
      {res.rows.map((r, i) => (
        <div key={r.id} className="rv-row">
          <div className="rv-row-head">
            <b>{i + 1}</b>
            {crops[r.id] && <button className="rv-orig" onClick={() => setShowOrig(showOrig === i ? null : i)}>{showOrig === i ? "Скрыть оригинал" : "Показать оригинал"}</button>}
            <button className="rv-ico" onClick={() => reread(r)} disabled={busyRow === r.id || !r.cells} aria-label="Перечитать строку"><IconRefresh size={18} /></button>
            <button className="rv-ico del" onClick={() => delRow(r.id)} aria-label="Удалить строку"><IconTrash size={18} /></button>
          </div>
          {showOrig === i && crops[r.id] && <img className="rv-crop" src={crops[r.id]} alt="Фрагмент оригинала" />}
          <div className="rv-fields">
            <Cell f={r.name} label="Наименование" onEdit={(v) => setPart(r.id, "name", v)} />
            <Cell f={r.unit} label="Ед. изм." onEdit={(v) => setPart(r.id, "unit", v)} />
            {res.colKeys.map((k) => <Cell key={k} f={r.cols[k]} num label={res.colTitles[k] || COL_LABEL[k]} onEdit={(v) => setCol(r.id, k, v)} busy={busyRow === r.id} />)}
          </div>
          {computed.rowSums[r.id] && <small className="rv-calc">Вычислено: количество × цена = {computed.rowSums[r.id]}</small>}
        </div>
      ))}
      <button className="btn-soft wide" onClick={addRow}><IconPlus size={18} /> Добавить ингредиент</button>

      {(Object.keys(res.totals).length > 0 || Object.keys(computed.colSums).length > 0) && (
        <>
          <h3 className="menu-h">Итоги</h3>
          <table className="rv-tot">
            <thead><tr><th></th><th>В документе</th><th>Вычислено</th></tr></thead>
            <tbody>
              {res.colKeys.filter((k) => res.totals[k] || computed.colSums[k]).map((k) => (
                <tr key={k}><td>{res.colTitles[k] || COL_LABEL[k]}</td><td>{res.totals[k]?.v || "—"}</td><td>{computed.colSums[k] ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {warnings.length > 0 && (
        <>
          <h3 className="menu-h">Предупреждения</h3>
          <div className="rv-warns">{warnings.map((w, i) => <p key={i} className={w.level}>{w.text}</p>)}</div>
        </>
      )}
      {res.notes.length > 0 && <div className="rv-warns">{res.notes.map((n, i) => <p key={i} className="warn">{n}</p>)}</div>}

      <h3 className="menu-h">Технология приготовления</h3>
      <textarea className="rv-tech" rows={5} value={res.tech.v} placeholder="В документе технология не найдена" onChange={(e) => p.onChange({ ...res, tech: { v: e.target.value, c: 100, edited: true } })} />

      {res.signatures.length > 0 && <small className="muted-line">Подписи: {res.signatures.join(", ")}</small>}

      <div className="rv-confirm">
        <p>Исходные значения документа сохраняются без изменений. {midCount > 0 && `Помечено «Проверьте»: ${midCount}. `}Карточка не будет сохранена без вашего подтверждения.</p>
        {unconfirmed > 0 && (
          <label className="rv-ack"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Я проверил поля, отмеченные красным ({unconfirmed})</label>
        )}
        <div className="rv-btns">
          <button className="btn-soft" onClick={p.onCancel}>Отмена</button>
          <button className="btn-primary" onClick={p.onSave} disabled={!canSave || p.saving}><IconCheck size={18} /> Сохранить карточку</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Главный экран ─────────── */
export function SmartScanner(p: {
  recipes: Recipe[]; initialMode?: Mode; drafts: Recipe[];
  onOpen: (r: Recipe) => void; onSaveRecipe: (r: Recipe) => void; onDelete: (id: string) => void; onBack: () => void;
}) {
  const [mode, setMode] = useState<Mode>(p.initialMode ?? "camera");
  const [step, setStep] = useState<Step>("capture");
  const [camErr, setCamErr] = useState("");
  const [queue, setQueue] = useState<Raw[]>([]);
  const [pages, setPages] = useState<PageData[]>([]);
  const [progress, setProgress] = useState({ pct: 0, text: "" });
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const engineRef = useRef<OcrEngine | null>(null);
  if (!engineRef.current) engineRef.current = new TesseractEngine();
  useEffect(() => () => { void engineRef.current?.terminate(); }, []);

  const cur = queue[0];
  const goAdjust = (raws: Raw[]) => { setQueue(raws); setStep("adjust"); };

  const onShot = useCallback((c: HTMLCanvasElement) => goAdjust([makeRaw(c)]), []);
  const onFail = useCallback((m: string) => setCamErr(m), []);

  const onFiles = async (files: FileList | null, kind: "img" | "pdf") => {
    if (!files?.length) return;
    setError(""); setBusy(true);
    try {
      if (kind === "pdf") {
        const f = files[0];
        const cs = await renderPdf(f);
        const built: PageData[] = [];
        for (let i = 0; i < cs.length; i++) built.push(await buildPage(makeRaw(cs[i], true), `pdf${Date.now()}_${i}`));
        setPages((old) => [...old, ...built]); setStep("pages");
      } else {
        const raws: Raw[] = [];
        for (const f of Array.from(files)) raws.push(makeRaw(await canvasFromBlob(f)));
        goAdjust(raws);
      }
    } catch { setError("Не удалось открыть файл. Попробуйте другой снимок или PDF."); }
    finally { setBusy(false); }
  };

  const acceptAdjust = async () => {
    if (!cur) return;
    setBusy(true);
    try {
      const pg = await buildPage(cur, `pg${Date.now()}`);
      setPages((old) => [...old, pg]);
      const rest = queue.slice(1);
      setQueue(rest);
      setStep(rest.length ? "adjust" : "pages");
    } finally { setBusy(false); }
  };

  const run = async () => {
    setStep("processing"); setError(""); setProgress({ pct: 0, text: "Подготовка…" });
    try {
      const r = await analyzePages(pages, engineRef.current!, (pct, text) => setProgress({ pct, text }));
      setResult(r); setStep("review");
    } catch (e) {
      console.error(e);
      setError("Не удалось распознать документ. Проверьте снимок и попробуйте снова.");
      setStep("pages");
    }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const id = String(Date.now());
      await saveDoc({ id, createdAt: new Date().toISOString(), pages: pages.map((x) => x.original) });
      p.onSaveRecipe(toRecipe(result, id));
      reset();
      setStep("capture"); setMode("camera");
      p.onBack();
    } finally { setSaving(false); }
  };

  const reset = () => { setPages([]); setQueue([]); setResult(null); setError(""); };

  if (mode === "qr") return <ScanScreen recipes={p.recipes} onOpen={p.onOpen} onBack={() => setMode("camera")} />;

  const back = () => {
    if (step === "capture") p.onBack();
    else if (step === "adjust") { setQueue([]); setStep(pages.length ? "pages" : "capture"); }
    else if (step === "pages") { if (pages.length && !confirm("Отменить сканирование? Сделанные страницы будут удалены.")) return; reset(); setStep("capture"); }
    else if (step === "review") setStep("pages");
  };

  const title = step === "review" ? "Проверка данных" : "Сканер документов";

  return (
    <Page title={title} onBack={back}>
      {step === "capture" && (
        <>
          <div className="seg" role="tablist">
            {([["camera", "Камера"], ["photo", "Фото"], ["pdf", "PDF"], ["qr", "QR-код"]] as [Mode, string][]).map(([m, l]) => (
              <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{l}</button>
            ))}
          </div>

          {mode === "camera" && (camErr
            ? <div className="scan-fallback"><IconCamera size={34} /><p>{camErr}</p></div>
            : <CameraView onShot={onShot} onFail={onFail} />)}

          {mode === "photo" && (
            <div className="pick">
              <label className="drop"><span className="drop-ico"><IconCamera size={30} /></span><b>Сфотографировать документ</b>
                <small>Откроется камера телефона</small>
                <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void onFiles(e.target.files, "img"); e.target.value = ""; }} />
                <span className="btn-primary">Сделать фото</span></label>
              <label className="drop"><span className="drop-ico"><IconImport size={30} /></span><b>Выбрать из галереи</b>
                <small>Можно выбрать несколько страниц сразу</small>
                <input type="file" accept="image/*" multiple hidden onChange={(e) => { void onFiles(e.target.files, "img"); e.target.value = ""; }} />
                <span className="btn-soft">Выбрать фото</span></label>
            </div>
          )}
          {mode === "pdf" && (
            <div className="pick">
              <label className="drop"><span className="drop-ico"><IconImport size={30} /></span><b>Загрузить PDF</b>
                <small>Все страницы PDF будут распознаны на устройстве</small>
                <input type="file" accept="application/pdf" hidden onChange={(e) => { void onFiles(e.target.files, "pdf"); e.target.value = ""; }} />
                <span className="btn-primary">Выбрать PDF</span></label>
            </div>
          )}
          {busy && <div className="progress"><span>Открываю файл…</span></div>}
          {error && <div className="note-card warn"><span className="note-ico"><IconInfo size={20} /></span><div><b>Ошибка</b><p>{error}</p></div></div>}
          <p className="scan-msg">Документ определяется автоматически: технологическая, калькуляционная карта или обе сразу.</p>

          {p.drafts.length > 0 && (
            <>
              <h3 className="menu-h">Импортированные карточки</h3>
              <div className="menu-list">
                {p.drafts.map((d) => (
                  <div key={d.id} className="draft-row">
                    <button onClick={() => p.onOpen(d)}>
                      <span className="menu-ico"><IconImport size={20} /></span>
                      <span className="menu-text"><b>{d.name}</b><small>{d.ingredients.length} ингр.{d.scan ? ` · ${DOC_TYPE_LABEL[d.scan.docType]}` : ""}</small></span>
                    </button>
                    <button className="bm" onClick={() => p.onDelete(d.id)} aria-label="Удалить карточку"><IconTrash size={20} /></button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {step === "adjust" && cur && (
        <>
          <p className="scan-msg">{cur.auto ? "Углы документа найдены. Передвиньте точки, если нужно." : "Автоматически границы не найдены — расставьте углы вручную."}</p>
          <CornerEditor raw={cur} onChange={(q) => setQueue((qq) => [{ ...qq[0], quad: q, auto: false }, ...qq.slice(1)])} />
          <div className="rv-btns">
            <button className="btn-soft" onClick={() => setQueue((qq) => [rotateRaw(qq[0]), ...qq.slice(1)])}><IconRefresh size={18} /> Повернуть</button>
            <button className="btn-primary" onClick={acceptAdjust} disabled={busy}>{busy ? "Обработка…" : "Готово"}</button>
          </div>
        </>
      )}

      {step === "pages" && (
        <>
          <div className="pages-grid">
            {pages.map((pg, i) => (
              <div key={pg.id} className={`pg ${pg.quality.level}`}>
                <img src={pg.thumb} alt={`Страница ${i + 1}`} />
                <b>Стр. {i + 1}</b>
                <button aria-label="Удалить страницу" onClick={() => setPages((o) => o.filter((x) => x.id !== pg.id))}><IconClose size={16} /></button>
              </div>
            ))}
            <button className="pg add" onClick={() => { setStep("capture"); }}><IconPlus size={26} /><b>Страница</b></button>
          </div>
          {pages.map((pg, i) => pg.quality.issues.length > 0 && (
            <div key={pg.id} className={`note-card ${pg.quality.level === "bad" ? "warn" : "info"}`}>
              <span className="note-ico"><IconInfo size={20} /></span>
              <div><b>Страница {i + 1}: качество {pg.quality.level === "bad" ? "низкое" : "среднее"}</b>
                {pg.quality.issues.map((s) => <p key={s.code}>{s.text}</p>)}
                <button className="btn-soft sm" onClick={() => { setPages((o) => o.filter((x) => x.id !== pg.id)); setStep("capture"); }}>Переснять</button></div>
            </div>
          ))}
          {error && <div className="note-card warn"><span className="note-ico"><IconInfo size={20} /></span><div><b>Ошибка</b><p>{error}</p></div></div>}
          <button className="btn-primary wide" disabled={!pages.length} onClick={run}>Распознать документ ({pages.length} стр.)</button>
        </>
      )}

      {step === "processing" && (
        <div className="processing">
          <div className="spin" />
          <b>Распознаю документ…</b>
          <div className="bar"><i style={{ width: `${Math.round(progress.pct * 100)}%` }} /></div>
          <small>{progress.text}</small>
          <small>Всё происходит на вашем устройстве — файл никуда не отправляется.</small>
        </div>
      )}

      {step === "review" && result && (
        <Review res={result} pages={pages} engine={engineRef.current!} onChange={setResult} onSave={save} onCancel={() => setStep("pages")} saving={saving} />
      )}
    </Page>
  );
}
