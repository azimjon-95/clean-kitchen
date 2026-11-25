import { useState } from "react";
import { api } from "../auth/client";
import { Page, Tabs, Sheet, Field, Err, Empty, Badge, Loading, Confirm, useLoad, errMsg, fmtDate, actionLabel } from "./ui";

type R = { id: string; name: string; organization: string; slug: string; status: "active" | "suspended" | "archived"; membersCount: number; recipesCount: number; owner?: { id: string; email: string; name: string }; address: string; createdAt: string };
const STATUS: Record<string, [string, "green" | "orange" | "gray"]> = { active: ["Активен", "green"], suspended: ["Заблокирован", "orange"], archived: ["Архив", "gray"] };

export function PlatformAdmin({ me, onLogout }: { me: { user: { name: string; email: string } }; onLogout: () => void }) {
  const [tab, setTab] = useState<"rest" | "users" | "audit">("rest");
  return (
    <div className="app">
      <Page title="Платформа" right={<button className="btn-soft sm" onClick={onLogout}>Выйти</button>}>
        <p className="mg-text">Super Admin · {me.user.email}</p>
        <Tabs items={[{ id: "rest", label: "Рестораны" }, { id: "users", label: "Пользователи" }, { id: "audit", label: "Журнал" }]} value={tab} onChange={setTab} />
        {tab === "rest" && <Restaurants />}{tab === "users" && <Users />}{tab === "audit" && <Audit />}
      </Page>
    </div>
  );
}

function Restaurants() {
  const { data, error, loading, reload } = useLoad(() => api<{ items: R[] }>("GET", "/platform/restaurants"));
  const [creating, setCreating] = useState(false); const [sel, setSel] = useState<R | null>(null);
  return (
    <>
      <button className="btn-primary wide" onClick={() => setCreating(true)}>+ Создать ресторан</button>
      <Loading loading={loading} error={error} />
      {data?.items.length === 0 && <Empty text="Ресторанов пока нет" />}
      <div className="mg-list">
        {data?.items.map((r) => (
          <button key={r.id} className="mg-row" onClick={() => setSel(r)}>
            <div className="mg-row-main"><b>{r.name}</b><small>{r.organization} · {r.owner?.email ?? "—"}</small><small>Сотрудников: {r.membersCount} · Карт: {r.recipesCount}</small></div>
            <Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>
          </button>
        ))}
      </div>
      {creating && <CreateRestaurant onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); }} />}
      {sel && <RestaurantSheet r={sel} onClose={() => setSel(null)} onChanged={() => { setSel(null); reload(); }} />}
    </>
  );
}

function CreateRestaurant({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: "", organization: "", slug: "", address: "", currency: "UZS", timezone: "Asia/Tashkent", ownerName: "", ownerEmail: "", ownerPassword: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      await api("POST", "/platform/restaurants", { name: f.name, organization: f.organization, slug: f.slug.toLowerCase(), address: f.address, currency: f.currency.toUpperCase(), timezone: f.timezone, owner: { name: f.ownerName, email: f.ownerEmail, password: f.ownerPassword } });
      onDone();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Новый ресторан" onClose={onClose}>
      <Field label="Название"><input value={f.name} onChange={set("name")} /></Field>
      <Field label="Организация"><input value={f.organization} onChange={set("organization")} /></Field>
      <Field label="Идентификатор (латиница)" hint="a–z, 0–9, дефис. Например: bella-vita"><input value={f.slug} onChange={set("slug")} /></Field>
      <Field label="Адрес"><input value={f.address} onChange={set("address")} /></Field>
      <div className="mg-two"><Field label="Валюта"><input value={f.currency} maxLength={3} onChange={set("currency")} /></Field><Field label="Часовой пояс"><input value={f.timezone} onChange={set("timezone")} /></Field></div>
      <h3 className="menu-h">Владелец</h3>
      <Field label="Имя"><input value={f.ownerName} onChange={set("ownerName")} /></Field>
      <Field label="Логин / Email"><input type="text" autoCapitalize="none" value={f.ownerEmail} onChange={set("ownerEmail")} /></Field>
      <Field label="Временный пароль" hint="Минимум 10 символов, буквы и цифры"><input type="password" autoComplete="new-password" value={f.ownerPassword} onChange={set("ownerPassword")} /></Field>
      <Err msg={err} />
      <button className="btn-primary wide" disabled={busy} onClick={submit}>{busy ? "Создаём…" : "Создать"}</button>
    </Sheet>
  );
}

function RestaurantSheet({ r, onClose, onChanged }: { r: R; onClose: () => void; onChanged: () => void }) {
  const [err, setErr] = useState(""); const [confirm, setConfirm] = useState<null | "archived">(null); const [owner, setOwner] = useState(false);
  const [oe, setOe] = useState({ name: "", email: "", password: "" }); const [support, setSupport] = useState<any[] | null>(null);
  const setStatus = async (status: string) => { try { await api("POST", `/platform/restaurants/${r.id}/status`, { status }); onChanged(); } catch (e) { setErr(errMsg(e)); } };
  const changeOwner = async () => { try { await api("POST", `/platform/restaurants/${r.id}/owner`, { owner: oe }); onChanged(); } catch (e) { setErr(errMsg(e)); } };
  const view = async () => { try { setSupport((await api<any>("GET", `/platform/restaurants/${r.id}/support/recipes`)).items); } catch (e) { setErr(errMsg(e)); } };
  return (
    <Sheet title={r.name} onClose={onClose}>
      <p className="mg-text">{r.organization} · {r.slug}<br />Владелец: {r.owner?.name} ({r.owner?.email})<br />Создан: {fmtDate(r.createdAt)}</p>
      <div className="mg-actions wrap">
        {r.status !== "active" && <button className="btn-primary" onClick={() => setStatus("active")}>Активировать</button>}
        {r.status === "active" && <button className="btn-soft" onClick={() => setStatus("suspended")}>Заблокировать</button>}
        {r.status !== "archived" && <button className="btn-soft danger" onClick={() => setConfirm("archived")}>В архив</button>}
        <button className="btn-soft" onClick={() => setOwner(!owner)}>Сменить владельца</button>
        <button className="btn-soft" onClick={view}>Просмотр данных</button>
      </div>
      {owner && <div className="mg-box"><Field label="Имя"><input value={oe.name} onChange={(e) => setOe({ ...oe, name: e.target.value })} /></Field><Field label="Логин / Email"><input type="text" autoCapitalize="none" value={oe.email} onChange={(e) => setOe({ ...oe, email: e.target.value })} /></Field><Field label="Пароль"><input type="password" value={oe.password} onChange={(e) => setOe({ ...oe, password: e.target.value })} /></Field><button className="btn-primary wide" onClick={changeOwner}>Назначить владельцем</button></div>}
      {support && <div className="mg-box"><small>Контролируемый просмотр (read-only, действие записано в журнал)</small>{support.map((s) => <div key={s.id} className="mg-line"><span>{s.name}</span><Badge>{s.status}</Badge></div>)}{!support.length && <Empty text="Карточек нет" />}</div>}
      <Err msg={err} />
      {confirm && <Confirm text="Архивировать ресторан? Сотрудники потеряют доступ, данные сохранятся." onNo={() => setConfirm(null)} onYes={() => setStatus("archived")} />}
    </Sheet>
  );
}

function Users() {
  const { data, error, loading, reload } = useLoad(() => api<{ items: any[] }>("GET", "/platform/users"));
  const [err, setErr] = useState("");
  const toggle = async (u: any) => { try { await api("POST", `/platform/users/${u.id}/status`, { status: u.status === "active" ? "blocked" : "active" }); reload(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <>
      <Loading loading={loading} error={error} /><Err msg={err} />
      <div className="mg-list">{data?.items.map((u) => (
        <div key={u.id} className="mg-row static"><div className="mg-row-main"><b>{u.name}</b><small>{u.email}{u.platformRole === "super_admin" ? " · Super Admin" : ""}</small></div>
          <Badge tone={u.status === "active" ? "green" : "red"}>{u.status === "active" ? "Активен" : "Заблокирован"}</Badge>
          {u.platformRole !== "super_admin" && <button className="btn-soft sm" onClick={() => toggle(u)}>{u.status === "active" ? "Блок" : "Снять"}</button>}</div>
      ))}</div>
    </>
  );
}

function Audit() {
  const { data, error, loading } = useLoad(() => api<{ items: any[] }>("GET", "/platform/audit-logs?limit=200"));
  return (<><Loading loading={loading} error={error} />
    <div className="mg-list">{data?.items.map((a) => <div key={a.id} className="mg-row static"><div className="mg-row-main"><b>{actionLabel(a.action)}</b><small>{a.actorEmail || "система"} · {fmtDate(a.at)}</small></div></div>)}</div></>);
}
