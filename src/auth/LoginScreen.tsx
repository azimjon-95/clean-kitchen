import { useState } from "react";
import { useAuth, GUEST_ALLOWED } from "./AuthProvider";
import { ApiError } from "./client";
import { LogoChef } from "../components/Icons";

export function LoginScreen() {
  const { signIn, enterGuest } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await signIn(email.trim(), password); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Не удалось войти"); }
    finally { setBusy(false); }
  };
  return (
    <div className="app">
      <form className="login" onSubmit={submit}>
        <div className="login-logo"><LogoChef size={46} /></div>
        <h1>Clean Kitchen</h1>
        <p className="login-sub">Войдите в рабочее пространство вашего ресторана</p>
        <label className="fld"><span>Логин или Email</span>
          <input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="логин или name@restaurant.com" /></label>
        <label className="fld"><span>Пароль</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <div className="form-err" role="alert">{err}</div>}
        <button className="btn-primary wide" disabled={busy || !email || !password}>{busy ? "Входим…" : "Войти"}</button>
        {GUEST_ALLOWED && <button type="button" className="btn-soft wide" onClick={enterGuest}>Демо без входа</button>}
        <p className="login-note">Доступ выдаёт владелец ресторана. Забыли пароль — обратитесь к нему или к администратору платформы.</p>
      </form>
    </div>
  );
}
