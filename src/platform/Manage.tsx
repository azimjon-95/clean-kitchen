import { useMemo, useState } from "react";
import { api, can, type Me } from "../auth/client";
import { Page, Tabs, Sheet, Field, Err, Empty, Badge, Loading, Confirm, useLoad, errMsg, fmtDate, actionLabel } from "./ui";

type Tab = "dash" | "recipes" | "cats" | "ings" | "members" | "roles" | "calc" | "audit";
const ZONES: Record<string, string> = { hot: "Горячий цех", cold: "Холодный цех", prep: "Заготовочный цех", pastry: "Кондитерский цех" };
const UNITS = ["kg", "g", "l", "ml", "pcs"];

export function Manage({ me, onBack, onChanged }: { me: Me; onBack: () => void; onChanged: () => void }) {
  const tabs = useMemo(() => {
    const t: { id: Tab; label: string }[] = [];
    if (can(me, "dashboard", "view")) t.push({ id: "dash", label: "Панель" });
    if (can(me, "recipes", "view")) t.push({ id: "recipes", label: "Карты" });
    if (can(me, "categories", "view")) t.push({ id: "cats", label: "Категории" });
    if (can(me, "ingredients", "view")) t.push({ id: "ings", label: "Ингредиенты" });
    if (can(me, "members", "view")) t.push({ id: "members", label: "Сотрудники" });
    if (can(me, "roles", "view")) t.push({ id: "roles", label: "Роли" });
    if (can(me, "calculations", "view") && !me.flags.denyCost) t.push({ id: "calc", label: "Калькуляции" });
    if (can(me, "audit", "view")) t.push({ id: "audit", label: "Журнал" });
    return t;
  }, [me]);
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? "recipes");
  return (
    <div className="app">
      <Page title="Управление" onBack={onBack}>
        <p className="mg-text">{me.restaurant?.name} · {me.role?.name}</p>
        <Tabs items={tabs} value={tab} onChange={setTab} />
        {tab === "dash" && <Dash />}
        {tab === "recipes" && <Recipes me={me} onChanged={onChanged} />}
        {tab === "cats" && <Cats me={me} />}
        {tab === "ings" && <Ings me={me} />}
        {tab === "members" && <Members me={me} />}
        {tab === "roles" && <Roles me={me} />}
        {tab === "calc" && <Calc me={me} />}
        {tab === "audit" && <AuditTab />}
      </Page>
    </div>
  );
}

// ───── Панель ─────
function Dash() {
  const { data, error, loading } = useLoad(() => api<any>("GET", "/dashboard"));
  return (<><Loading loading={loading} error={error} />{data && <>
    <div className="mg-stats">
      <div><b>{data.recipes.total}</b><small>Карт</small></div><div><b>{data.recipes.published}</b><small>Опубликовано</small></div><div><b>{data.recipes.drafts}</b><small>Черновики</small></div>
      <div><b>{data.categories}</b><small>Категорий</small></div>{data.members != null && <div><b>{data.members}</b><small>Сотрудников</small></div>}{data.calculations && <div><b>{data.calculations.complete}/{data.calculations.total}</b><small>Калькуляций готово</small></div>}
    </div>
    {data.recent && <><h3 className="menu-h">Последние изменения</h3><div className="mg-list">{data.recent.map((a: any) => <div key={a.id} className="mg-row static"><div className="mg-row-main"><b>{actionLabel(a.action)}</b><small>{a.actorEmail} · {fmtDate(a.at)}</small></div></div>)}</div></>}
  </>}</>);
}

// ───── Технологические карты ─────
function Recipes({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const cats = useLoad(() => api<{ items: any[] }>("GET", "/categories"));
  const { data, error, loading, reload } = useLoad(() => api<{ items: any[]; total: number }>("GET", `/recipes?limit=200${q ? `&q=${encodeURIComponent(q)}` : ""}`), [q]);
  const [edit, setEdit] = useState<any | "new" | null>(null); const [del, setDel] = useState<any | null>(null); const [err, setErr] = useState("");
  const done = () => { reload(); onChanged(); };
  const act = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); done(); } catch (e) { setErr(errMsg(e)); } };
  return (<>
    <div className="mg-bar"><input className="mg-search" placeholder="Поиск карты…" value={q} onChange={(e) => setQ(e.target.value)} />
      {can(me, "recipes", "create") && <button className="btn-primary" onClick={() => setEdit("new")}>+ Карта</button>}</div>
    <Loading loading={loading} error={error} /><Err msg={err} />
    {data?.items.length === 0 && <Empty text="Карт нет" />}
    <div className="mg-list">{data?.items.map((r) => (
      <div key={r.id} className="mg-row static col">
        <div className="mg-row-top"><div className="mg-row-main"><b>{r.name}</b><small>{cats.data?.items.find((c) => c.id === r.categoryId)?.name ?? "Без категории"}{r.zone ? ` · ${ZONES[r.zone]}` : ""}</small></div>
          <Badge tone={r.status === "published" ? "green" : r.status === "draft" ? "orange" : "gray"}>{r.status === "published" ? "Опубликована" : r.status === "draft" ? "Черновик" : "Архив"}</Badge></div>
        <div className="mg-actions wrap">
          {can(me, "recipes", "edit") && <button className="btn-soft sm" onClick={() => api<any>("GET", `/recipes/${r.id}`).then((d) => setEdit(d.item)).catch((e) => setErr(errMsg(e)))}>Изменить</button>}
          {can(me, "recipes", "publish") && r.status !== "published" && <button className="btn-soft sm" onClick={() => act(() => api("POST", `/recipes/${r.id}/publish`))}>Опубликовать</button>}
          {can(me, "recipes", "archive") && r.status !== "archived" && <button className="btn-soft sm" onClick={() => act(() => api("POST", `/recipes/${r.id}/archive`))}>В архив</button>}
          {can(me, "recipes", "create") && <button className="btn-soft sm" onClick={() => act(() => api("POST", `/recipes/${r.id}/duplicate`))}>Копия</button>}
          {can(me, "recipes", "delete") && <button className="btn-soft sm danger" onClick={() => setDel(r)}>Удалить</button>}
        </div></div>))}</div>
    {edit && <RecipeForm me={me} rec={edit === "new" ? null : edit} cats={cats.data?.items ?? []} onClose={() => setEdit(null)} onDone={() => { setEdit(null); done(); }} />}
    {del && <Confirm text={`Удалить карту «${del.name}»? Это действие нельзя отменить.`} onNo={() => setDel(null)} onYes={() => { const d = del; setDel(null); act(() => api("DELETE", `/recipes/${d.id}`)); }} />}
  </>);
}

function RecipeForm({ me, rec, cats, onClose, onDone }: { me: Me; rec: any | null; cats: any[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>(rec ?? { name: "", description: "", categoryId: null, zone: "", portionCount: 1, ingredients: [], steps: [], status: "draft" });
  const [stepsText, setStepsText] = useState((rec?.steps ?? []).map((s: any) => s.text).join("\n"));
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const showPrice = !me.flags.denyCost, priceLocked = !!me.flags.denyPurchasePriceEdit;
  const setIng = (i: number, k: string, v: any) => setF({ ...f, ingredients: f.ingredients.map((x: any, j: number) => (j === i ? { ...x, [k]: v } : x)) });
  const num = (v: string) => (v === "" ? undefined : Number(v.replace(",", ".")));
  const save = async () => {
    setBusy(true); setErr("");
    const body: any = { name: f.name, description: f.description, categoryId: f.categoryId || null, zone: f.zone || "", portionCount: Number(f.portionCount) || 0,
      ingredients: f.ingredients.filter((x: any) => x.name?.trim()).map((x: any) => ({ name: x.name.trim(), unit: x.unit || "g", gross: x.gross, net: x.net, ...(showPrice && !priceLocked && x.pricePerUnit != null ? { pricePerUnit: x.pricePerUnit } : {}) })),
      steps: stepsText.split("\n").map((s: string) => s.trim()).filter(Boolean).map((text: string) => ({ text })) };
    if (can(me, "recipes", "publish") || f.status === "draft") body.status = f.status;
    try { rec ? await api("PATCH", `/recipes/${rec.id}`, body) : await api("POST", "/recipes", body); onDone(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet title={rec ? "Изменить карту" : "Новая карта"} onClose={onClose}>
      <Field label="Название"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="mg-two">
        <Field label="Категория"><select value={f.categoryId ?? ""} onChange={(e) => setF({ ...f, categoryId: e.target.value || null })}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Цех"><select value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })}><option value="">—</option>{Object.entries(ZONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <div className="mg-two"><Field label="Порций"><input inputMode="numeric" value={f.portionCount} onChange={(e) => setF({ ...f, portionCount: e.target.value })} /></Field>
        {(can(me, "recipes", "publish") || can(me, "recipes", "archive")) && <Field label="Статус"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="draft">Черновик</option>{can(me, "recipes", "publish") && <option value="published">Опубликована</option>}{can(me, "recipes", "archive") && <option value="archived">Архив</option>}</select></Field>}</div>
      <Field label="Описание"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <h3 className="menu-h">Ингредиенты</h3>
      {f.ingredients.map((x: any, i: number) => (
        <div key={i} className="mg-ing"><input placeholder="Название" value={x.name} onChange={(e) => setIng(i, "name", e.target.value)} />
          <select value={x.unit} onChange={(e) => setIng(i, "unit", e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          <input placeholder="Брутто" inputMode="decimal" defaultValue={x.gross ?? ""} onChange={(e) => setIng(i, "gross", num(e.target.value))} />
          <input placeholder="Нетто" inputMode="decimal" defaultValue={x.net ?? ""} onChange={(e) => setIng(i, "net", num(e.target.value))} />
          {showPrice && <input placeholder="Цена" inputMode="decimal" disabled={priceLocked} defaultValue={x.pricePerUnit ?? ""} onChange={(e) => setIng(i, "pricePerUnit", num(e.target.value))} />}
          <button className="icon-btn" aria-label="Убрать" onClick={() => setF({ ...f, ingredients: f.ingredients.filter((_: any, j: number) => j !== i) })}>×</button></div>))}
      <button className="btn-soft sm" onClick={() => setF({ ...f, ingredients: [...f.ingredients, { name: "", unit: "g" }] })}>+ Ингредиент</button>
      <Field label="Технология (каждый шаг с новой строки)"><textarea rows={5} value={stepsText} onChange={(e) => setStepsText(e.target.value)} /></Field>
      <Err msg={err} /><button className="btn-primary wide" disabled={busy || f.name.trim().length < 2} onClick={save}>{busy ? "Сохраняем…" : "Сохранить"}</button>
    </Sheet>);
}

// ───── Категории ─────
function Cats({ me }: { me: Me }) {
  const { data, error, loading, reload } = useLoad(() => api<{ items: any[] }>("GET", "/categories"));
  const [name, setName] = useState(""); const [zone, setZone] = useState(""); const [err, setErr] = useState("");
  const act = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); reload(); } catch (e) { setErr(errMsg(e)); } };
  return (<>
    {can(me, "categories", "create") && <div className="mg-bar"><input className="mg-search" placeholder="Новая категория" value={name} onChange={(e) => setName(e.target.value)} />
      <select value={zone} onChange={(e) => setZone(e.target.value)}><option value="">Цех —</option>{Object.entries(ZONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <button className="btn-primary" disabled={name.trim().length < 2} onClick={() => act(async () => { await api("POST", "/categories", { name: name.trim(), zone }); setName(""); })}>Добавить</button></div>}
    <Loading loading={loading} error={error} /><Err msg={err} />
    <div className="mg-list">{data?.items.map((c) => <div key={c.id} className="mg-row static"><div className="mg-row-main"><b>{c.name}</b><small>{c.zone ? ZONES[c.zone] : "Без цеха"}</small></div>
      {can(me, "categories", "delete") && <button className="btn-soft sm danger" onClick={() => act(() => api("DELETE", `/categories/${c.id}`))}>Удалить</button>}</div>)}</div>
  </>);
}

// ───── Ингредиенты ─────
function Ings({ me }: { me: Me }) {
  const { data, error, loading, reload } = useLoad(() => api<{ items: any[] }>("GET", "/ingredients"));
  const [f, setF] = useState({ name: "", unit: "kg", price: "" }); const [err, setErr] = useState("");
  const showPrice = !me.flags.denyCost;
  const act = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); reload(); } catch (e) { setErr(errMsg(e)); } };
  return (<>
    {can(me, "ingredients", "create") && <div className="mg-bar"><input className="mg-search" placeholder="Название" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
      {showPrice && !me.flags.denyPurchasePriceEdit && <input className="mg-num" placeholder="Цена" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />}
      <button className="btn-primary" disabled={!f.name.trim()} onClick={() => act(async () => { await api("POST", "/ingredients", { name: f.name.trim(), unit: f.unit, pricePerUnit: Number(f.price.replace(",", ".")) || 0 }); setF({ name: "", unit: "kg", price: "" }); })}>+</button></div>}
    <Loading loading={loading} error={error} /><Err msg={err} />
    <div className="mg-list">{data?.items.map((i) => <div key={i.id} className="mg-row static"><div className="mg-row-main"><b>{i.name}</b><small>{i.unit}{i.pricePerUnit != null ? ` · ${i.pricePerUnit}` : ""}</small></div>
      {can(me, "ingredients", "edit") && showPrice && !me.flags.denyPurchasePriceEdit && <button className="btn-soft sm" onClick={() => { const v = prompt("Новая цена за единицу", String(i.pricePerUnit ?? 0)); if (v != null && !Number.isNaN(Number(v.replace(",", ".")))) act(() => api("PATCH", `/ingredients/${i.id}`, { pricePerUnit: Number(v.replace(",", ".")) })); }}>Цена</button>}
      {can(me, "ingredients", "delete") && <button className="btn-soft sm danger" onClick={() => act(() => api("DELETE", `/ingredients/${i.id}`))}>×</button>}</div>)}</div>
  </>);
}

// ───── Сотрудники ─────
function Members({ me }: { me: Me }) {
  const { data, error, loading, reload } = useLoad(() => api<{ items: any[] }>("GET", "/restaurant/members"));
  const roles = useLoad(() => can(me, "roles", "view") ? api<{ items: any[] }>("GET", "/restaurant/roles") : Promise.resolve({ items: [] as any[] }));
  const cats = useLoad(() => can(me, "categories", "view") ? api<{ items: any[] }>("GET", "/categories") : Promise.resolve({ items: [] as any[] }));
  const [form, setForm] = useState<any | "new" | null>(null); const [err, setErr] = useState("");
  const act = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); reload(); } catch (e) { setErr(errMsg(e)); } };
  return (<>
    {can(me, "members", "create") && <button className="btn-primary wide" onClick={() => setForm("new")}>+ Сотрудник</button>}
    <Loading loading={loading} error={error} /><Err msg={err} />
    <div className="mg-list">{data?.items.map((m) => {
      const locked = m.roleKey === "owner" || m.userId === me.user.id;
      return (<div key={m.id} className="mg-row static col"><div className="mg-row-top"><div className="mg-row-main"><b>{m.name}</b><small>{m.email} · {m.roleName}</small>
        <small>{m.assigned.categoryIds.length} кат. · {m.assigned.recipeIds.length} карт · {m.assigned.zones.map((z: string) => ZONES[z]).join(", ") || "без цехов"}</small>{m.accessUntil && <small>Доступ до {fmtDate(m.accessUntil)}</small>}</div>
        <Badge tone={m.status === "active" ? "green" : "red"}>{m.status === "active" ? "Активен" : "Заблокирован"}</Badge></div>
        {!locked && <div className="mg-actions wrap">
          {can(me, "members", "edit") && <button className="btn-soft sm" onClick={() => setForm(m)}>Права</button>}
          {can(me, "members", "edit") && <button className="btn-soft sm" onClick={() => act(() => api("POST", `/restaurant/members/${m.id}/${m.status === "active" ? "block" : "unblock"}`))}>{m.status === "active" ? "Блок" : "Разблок"}</button>}
          {can(me, "members", "edit") && <button className="btn-soft sm" onClick={() => act(() => api("POST", `/restaurant/members/${m.id}/revoke-sessions`))}>Выкинуть из сессий</button>}
          {can(me, "members", "delete") && <button className="btn-soft sm danger" onClick={() => confirm(`Удалить ${m.name}?`) && act(() => api("DELETE", `/restaurant/members/${m.id}`))}>Удалить</button>}</div>}</div>);
    })}</div>
    {form && <MemberForm m={form === "new" ? null : form} roles={roles.data?.items ?? []} cats={cats.data?.items ?? []} onClose={() => setForm(null)} onDone={() => { setForm(null); reload(); }} />}
  </>);
}
function MemberForm({ m, roles, cats, onClose, onDone }: { m: any | null; roles: any[]; cats: any[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: m?.name ?? "", email: m?.email ?? "", password: "", roleId: m?.roleId ?? "", categoryIds: m?.assigned.categoryIds ?? [], zones: m?.assigned.zones ?? [], recipeIds: m?.assigned.recipeIds ?? [], accessUntil: m?.accessUntil ? m.accessUntil.slice(0, 10) : "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const tog = (k: "categoryIds" | "zones", v: string) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x: string) => x !== v) : [...f[k], v] });
  const assignable = roles.filter((r) => r.key !== "owner");
  const save = async () => {
    setBusy(true); setErr("");
    const assigned = { categoryIds: f.categoryIds, zones: f.zones, recipeIds: f.recipeIds };
    const accessUntil = f.accessUntil ? new Date(f.accessUntil + "T23:59:59").toISOString() : null;
    try { m ? await api("PATCH", `/restaurant/members/${m.id}`, { roleId: f.roleId, assigned, accessUntil }) : await api("POST", "/restaurant/members", { name: f.name, email: f.email, password: f.password, roleId: f.roleId, assigned, accessUntil }); onDone(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (<Sheet title={m ? `Права: ${m.name}` : "Новый сотрудник"} onClose={onClose}>
    {!m && <><Field label="Имя"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Пароль" hint="Минимум 10 символов, буквы и цифры"><input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field></>}
    <Field label="Роль"><select value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value })}><option value="">— выберите —</option>{assignable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
    <h3 className="menu-h">Доступ к категориям</h3><div className="mg-checks">{cats.map((c) => <label key={c.id}><input type="checkbox" checked={f.categoryIds.includes(c.id)} onChange={() => tog("categoryIds", c.id)} />{c.name}</label>)}{!cats.length && <small>Категорий нет</small>}</div>
    <h3 className="menu-h">Рабочие зоны</h3><div className="mg-checks">{Object.entries(ZONES).map(([k, v]) => <label key={k}><input type="checkbox" checked={f.zones.includes(k)} onChange={() => tog("zones", k)} />{v}</label>)}</div>
    {f.recipeIds.length > 0 && <p className="mg-text">Назначено отдельных карт: {f.recipeIds.length}</p>}
    <Field label="Доступ до (необязательно)"><input type="date" value={f.accessUntil} onChange={(e) => setF({ ...f, accessUntil: e.target.value })} /></Field>
    <Err msg={err} /><button className="btn-primary wide" disabled={busy || !f.roleId || (!m && (!f.name || !f.email || !f.password))} onClick={save}>{busy ? "Сохраняем…" : "Сохранить"}</button>
  </Sheet>);
}

// ───── Роли и разрешения ─────
function Roles({ me }: { me: Me }) {
  const { data, error, loading, reload } = useLoad(() => api<{ items: any[] }>("GET", "/restaurant/roles"));
  const cat = useLoad(() => api<any>("GET", "/restaurant/permissions"));
  const [form, setForm] = useState<any | "new" | null>(null); const [err, setErr] = useState("");
  return (<>
    {can(me, "roles", "create") && <button className="btn-primary wide" onClick={() => setForm("new")}>+ Роль</button>}
    <Loading loading={loading} error={error} /><Err msg={err} />
    <div className="mg-list">{data?.items.map((r) => <div key={r.id} className="mg-row static"><div className="mg-row-main"><b>{r.name}</b><small>{r.system ? "Системная" : "Пользовательская"} · сотрудников: {r.members} · {r.scope === "all" ? "все данные" : "назначенные"}</small></div>
      {!r.system && can(me, "roles", "edit") && <button className="btn-soft sm" onClick={() => setForm(r)}>Права</button>}
      {!r.system && can(me, "roles", "delete") && <button className="btn-soft sm danger" onClick={() => confirm(`Удалить роль «${r.name}»?`) && api("DELETE", `/restaurant/roles/${r.id}`).then(reload).catch((e) => setErr(errMsg(e)))}>×</button>}</div>)}</div>
    {form && cat.data && <RoleForm me={me} role={form === "new" ? null : form} cat={cat.data} onClose={() => setForm(null)} onDone={() => { setForm(null); reload(); }} />}
  </>);
}
const SEC_RU: Record<string, string> = { dashboard: "Панель", recipes: "Тех. карты", categories: "Категории", ingredients: "Ингредиенты", calculations: "Калькуляции", imports: "Импорт", members: "Сотрудники", roles: "Роли", audit: "Журнал", restaurant: "Ресторан" };
const ACT_RU: Record<string, string> = { view: "просмотр", create: "создание", edit: "правка", delete: "удаление", publish: "публикация", archive: "архив", import: "импорт", export: "экспорт", approve: "утверждение" };
const FEAT_RU: Record<string, string> = { tts: "Озвучка", qr: "QR", voice: "Голосовой поиск", cooking_mode: "Режим готовки", saved: "Сохранённые" };
function RoleForm({ me, role, cat, onClose, onDone }: { me: Me; role: any | null; cat: any; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>(role ?? { name: "", permissions: {}, scope: "assigned", denyCost: true, denyPurchasePriceEdit: true, features: [] });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const has = (s: string, a: string) => !!f.permissions[s]?.includes(a);
  const mine = (s: string, a: string) => me.role?.key === "owner" || can(me, s, a); // выдать можно только то, что есть у тебя
  const toggle = (s: string, a: string) => { const cur: string[] = f.permissions[s] ?? []; setF({ ...f, permissions: { ...f.permissions, [s]: cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a] } }); };
  const save = async () => { setBusy(true); setErr(""); try { role ? await api("PATCH", `/restaurant/roles/${role.id}`, f) : await api("POST", "/restaurant/roles", f); onDone(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); } };
  return (<Sheet title={role ? `Роль: ${role.name}` : "Новая роль"} onClose={onClose}>
    <Field label="Название"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Например: Повар холодного цеха" /></Field>
    <h3 className="menu-h">Разрешения</h3>
    {cat.sections.map((s: string) => <div key={s} className="mg-perm"><b>{SEC_RU[s]}</b><div className="mg-checks">{cat.sectionActions[s].map((a: string) => <label key={a} className={mine(s, a) ? "" : "dis"}><input type="checkbox" disabled={!mine(s, a)} checked={has(s, a)} onChange={() => toggle(s, a)} />{ACT_RU[a]}</label>)}</div></div>)}
    <h3 className="menu-h">Доступ к данным</h3>
    <Field label="Какие карты видит"><select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}>{(me.scope === "all" || me.role?.key === "owner") && <option value="all">Все карты ресторана</option>}<option value="assigned">Только назначенные (категории / карты / цеха)</option></select></Field>
    <div className="mg-checks"><label><input type="checkbox" checked={f.denyCost} disabled={!!me.flags.denyCost} onChange={(e) => setF({ ...f, denyCost: e.target.checked })} />Скрыть себестоимость</label>
      <label><input type="checkbox" checked={f.denyPurchasePriceEdit} disabled={!!me.flags.denyPurchasePriceEdit} onChange={(e) => setF({ ...f, denyPurchasePriceEdit: e.target.checked })} />Запретить правку закупочных цен</label></div>
    <h3 className="menu-h">Функции</h3><div className="mg-checks">{cat.features.map((x: string) => <label key={x} className={me.features.includes(x) ? "" : "dis"}><input type="checkbox" disabled={!me.features.includes(x)} checked={f.features.includes(x)} onChange={() => setF({ ...f, features: f.features.includes(x) ? f.features.filter((y: string) => y !== x) : [...f.features, x] })} />{FEAT_RU[x]}</label>)}</div>
    <Err msg={err} /><button className="btn-primary wide" disabled={busy || f.name.trim().length < 2} onClick={save}>{busy ? "Сохраняем…" : "Сохранить"}</button>
  </Sheet>);
}

// ───── Калькуляции и журнал ─────
function Calc({ me }: { me: Me }) {
  const { data, error, loading } = useLoad(() => api<any>("GET", "/calculations"));
  return (<><Loading loading={loading} error={error} />{data && <>
    <div className="mg-stats"><div><b>{data.summary.count}</b><small>Карт</small></div><div><b>{data.summary.complete}</b><small>С полной ценой</small></div><div><b>{data.summary.avgTotal}</b><small>Средняя, {me.restaurant?.currency}</small></div></div>
    <div className="mg-list">{data.items.map((r: any) => <div key={r.id} className="mg-row static"><div className="mg-row-main"><b>{r.name}</b><small>{r.complete ? "" : "цены заполнены не полностью · "}{r.perPortion != null ? `порция ${r.perPortion}` : ""}</small></div><b>{r.total}</b></div>)}</div></>}</>);
}
function AuditTab() {
  const { data, error, loading } = useLoad(() => api<{ items: any[] }>("GET", "/audit-logs?limit=200"));
  return (<><Loading loading={loading} error={error} /><div className="mg-list">{data?.items.map((a) => <div key={a.id} className="mg-row static"><div className="mg-row-main"><b>{actionLabel(a.action)}</b><small>{a.actorEmail || "—"} · {fmtDate(a.at)}</small></div></div>)}</div></>);
}
