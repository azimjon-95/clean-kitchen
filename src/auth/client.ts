/**
 * Клиент единого API (/api/v1). Access-токен хранится ТОЛЬКО в памяти (не в localStorage);
 * refresh-токен — HttpOnly-cookie, недоступная скриптам. При 401 токен обновляется один раз и запрос повторяется.
 */
import { API_URL } from "../lib/api";

export type Perm = Record<string, string[]>;
export type Me = {
  user: { id: string; email: string; name: string; platformRole: "super_admin" | "user" };
  memberships: { restaurantId: string; restaurantName: string; restaurantStatus?: string; status: string; roleName: string; roleKey: string }[];
  restaurant: null | { id: string; name: string; organization: string; currency: string; timezone: string; logoUrl: string };
  role: null | { id: string; key: string; name: string };
  permissions: Perm; features: string[]; flags: { denyCost?: boolean; denyPurchasePriceEdit?: boolean };
  scope: null | "all" | "assigned"; assigned: null | { categoryIds: string[]; recipeIds: string[]; zones: string[] };
  tenantError: null | { code: string; message: string };
};

export class ApiError extends Error { constructor(public status: number, message: string, public code = "") { super(message); } }

let accessToken: string | null = null;
let tokenAt = 0;
/** true, если последнее обновление не удалось из-за сети (а не из-за отозванной сессии) — тогда не разлогиниваем */
let refreshNetworkFail = false;
let refreshing: Promise<Me | null> | null = null;
let onLoggedOut: (() => void) | null = null;
export const setLoggedOutHandler = (fn: () => void) => { onLoggedOut = fn; };

const base = () => `${API_URL}/api/v1`;
const jsonHeaders = (): Record<string, string> => ({ "Content-Type": "application/json", Accept: "application/json" });

async function parse(res: Response) {
  const text = await res.text(); let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { /* не JSON */ }
  return data;
}

/** Обновление access-токена по cookie (один запрос на всех, пока он выполняется) */
export function refreshSession(): Promise<Me | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${base()}/auth/refresh`, { method: "POST", credentials: "include", headers: { ...jsonHeaders(), "X-CK-CSRF": "1" } });
      refreshNetworkFail = res.status >= 500;
      if (!res.ok) { if (!refreshNetworkFail) accessToken = null; return null; }
      const d = await parse(res); accessToken = d.accessToken; tokenAt = Date.now(); return d as Me;
    } catch { refreshNetworkFail = true; return null; }
    finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

const TIMEOUT_MS = 15_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch с таймаутом; чтение (GET) при обрыве сети или 502/503/504 повторяется до 2 раз с паузой */
async function send(method: string, url: string, init: RequestInit): Promise<Response> {
  const idempotent = method === "GET";
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, method, signal: ctrl.signal });
      if (idempotent && attempt < 2 && [502, 503, 504].includes(res.status)) { await sleep(400 * 2 ** attempt); continue; }
      return res;
    } catch {
      if (idempotent && attempt < 2 && navigator.onLine !== false) { await sleep(400 * 2 ** attempt); continue; }
      throw new ApiError(0, "Нет соединения с сервером", "network");
    } finally { clearTimeout(t); }
  }
}

export async function api<T = any>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const res = await send(method, base() + path, { credentials: "include", headers: { ...jsonHeaders(), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 401 && retry && !path.startsWith("/auth/login")) {
    const me = await refreshSession();
    if (me) return api<T>(method, path, body, false);
    if (refreshNetworkFail) throw new ApiError(0, "Нет соединения с сервером", "network");
    accessToken = null; onLoggedOut?.();
  }
  const data = await parse(res);
  if (!res.ok) throw new ApiError(res.status, data?.error || `Ошибка ${res.status}`, data?.code);
  return data as T;
}

export async function login(email: string, password: string): Promise<Me> {
  const res = await fetch(`${base()}/auth/login`, { method: "POST", credentials: "include", headers: jsonHeaders(), body: JSON.stringify({ email, password }) }).catch(() => { throw new ApiError(0, "Нет соединения с сервером", "network"); });
  const d = await parse(res);
  if (!res.ok) throw new ApiError(res.status, d?.error || "Ошибка входа", d?.code);
  accessToken = d.accessToken; tokenAt = Date.now(); return d as Me;
}
export async function logout() {
  try { await fetch(`${base()}/auth/logout`, { method: "POST", credentials: "include", headers: { ...jsonHeaders(), "X-CK-CSRF": "1" } }); } catch { /* офлайн: токен всё равно забываем */ }
  accessToken = null;
}
export const fetchMe = () => api<Me>("GET", "/auth/me");
export const hasToken = () => !!accessToken;

// ───── разрешения: меню и экраны строятся из ответа сервера (сервер всё равно перепроверяет каждый запрос) ─────
export const can = (me: Me | null | undefined, section: string, action: string) => !!me?.permissions?.[section]?.includes(action);
export const hasFeature = (me: Me | null | undefined, f: string) => !!me?.features?.includes(f);
export const isSuper = (me: Me | null | undefined) => me?.user.platformRole === "super_admin";
export const canManage = (me: Me | null | undefined) =>
  !!me && ["dashboard", "members", "roles", "audit", "ingredients", "imports"].some((s) => can(me, s, "view")) ||
  !!me && (can(me, "recipes", "create") || can(me, "recipes", "edit") || can(me, "categories", "create") || can(me, "categories", "edit"));

/** Заголовок авторизации для запросов вне api() (например, загрузка аудио) */
export const authHeader = (): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {});

/**
 * Устойчивая сессия: токен обновляется заранее (до истечения 15 минут), при возврате в приложение
 * и при восстановлении сети — пользователь не видит «разлогина» и лишних ошибок.
 */
const REFRESH_EVERY_MS = 12 * 60_000;
let keepAliveStarted = false;
export function startSessionKeepAlive(onMe: (m: Me) => void, onLost: () => void) {
  if (keepAliveStarted) return; keepAliveStarted = true;
  const tick = async (force = false) => {
    if (!accessToken) return;
    if (!force && Date.now() - tokenAt < REFRESH_EVERY_MS) return;
    if (navigator.onLine === false) return;
    const me = await refreshSession();
    if (me) onMe(me); else if (!refreshNetworkFail) onLost();
  };
  setInterval(() => { if (document.visibilityState === "visible") void tick(); }, 60_000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void tick(Date.now() - tokenAt > 5 * 60_000); });
  window.addEventListener("online", () => void tick(true));
}
export const lastRefreshWasNetworkFail = () => refreshNetworkFail;
