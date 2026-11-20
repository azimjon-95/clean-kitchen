import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ApiError } from "../auth/client";
import { IconBack, IconClose } from "../components/Icons";

export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Что-то пошло не так");

/** Загрузка данных с состоянием и перезагрузкой */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const reload = useCallback(() => { setLoading(true); fn().then((d) => { setData(d); setError(""); }).catch((e) => setError(errMsg(e))).finally(() => setLoading(false)); }, deps); // eslint-disable-line
  useEffect(reload, [reload]);
  return { data, error, loading, reload, setData };
}

export function Page({ title, onBack, right, children }: { title: string; onBack?: () => void; right?: ReactNode; children: ReactNode }) {
  return (
    <main className="screen mg">
      <div className="mg-head">
        {onBack && <button className="icon-btn" onClick={onBack} aria-label="Назад"><IconBack size={22} /></button>}
        <h1 className="page-title">{title}</h1>
        {right}
      </div>
      {children}
    </main>
  );
}
export const Tabs = <T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) => (
  <div className="mg-tabs" role="tablist">{items.map((i) => <button key={i.id} role="tab" className={value === i.id ? "on" : ""} onClick={() => onChange(i.id)}>{i.label}</button>)}</div>
);
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // портал в body: position:fixed не должен зависеть от анимированных предков (.screen)
  return createPortal(
    <div className="mg-modal" role="dialog" aria-label={title} onClick={onClose}>
      <div className="mg-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mg-sheet-h"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Закрыть"><IconClose size={22} /></button></div>
        {children}
      </div>
    </div>, document.body);
}
export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <label className="fld"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
);
export const Err = ({ msg }: { msg: string }) => (msg ? <div className="form-err" role="alert">{msg}</div> : null);
export const Empty = ({ text }: { text: string }) => <p className="mg-empty">{text}</p>;
export const Badge = ({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "orange" | "red" }) => <span className={`badge ${tone}`}>{children}</span>;
export const Loading = ({ loading, error }: { loading: boolean; error: string }) => loading ? <p className="mg-empty">Загрузка…</p> : error ? <Err msg={error} /> : null;
export function Confirm({ text, onYes, onNo }: { text: string; onYes: () => void; onNo: () => void }) {
  return <Sheet title="Подтвердите" onClose={onNo}><p className="mg-text">{text}</p><div className="mg-actions"><button className="btn-soft" onClick={onNo}>Отмена</button><button className="btn-primary" onClick={onYes}>Да</button></div></Sheet>;
}
export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "—");
const ACTION_RU: Record<string, string> = { "auth.login": "Вход", "auth.logout": "Выход", "auth.login_failed": "Неудачный вход", "recipe.created": "Карта создана", "recipe.updated": "Карта изменена", "recipe.deleted": "Карта удалена", "recipe.published": "Карта опубликована", "recipe.archived": "Карта в архиве", "recipe.cost_changed": "Изменена себестоимость", "role.created": "Роль создана", "role.permissions_changed": "Права роли изменены", "role.deleted": "Роль удалена", "member.created": "Сотрудник добавлен", "member.permissions_changed": "Права сотрудника изменены", "member.blocked": "Сотрудник заблокирован", "member.unblocked": "Сотрудник разблокирован", "member.sessions_revoked": "Сессии отозваны", "member.removed": "Сотрудник удалён", "restaurant.created": "Ресторан создан", "restaurant.status_changed": "Статус ресторана", "restaurant.owner_changed": "Смена владельца", "ingredient.price_changed": "Изменена цена ингредиента", "import.recipes": "Импорт карточек" };
export const actionLabel = (a: string) => ACTION_RU[a] ?? a;
