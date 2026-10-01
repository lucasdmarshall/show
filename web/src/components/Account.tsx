"use client";

import { useEffect, useRef, useState } from "react";
import { ACCOUNT_EVENT, signIn, signInWithFirebase, signOut, signUp, useAccount } from "@/lib/account";
import { explain, firebaseOn, sendCode, withEmail, withGoogle } from "@/lib/firebase";
import type { ConfirmationResult, User as FirebaseUser } from "firebase/auth";
import "./account.css";

/* The account button in the bar, and the sheet it opens. Nothing shows
   when no server is connected — there is nothing to sign in to. */

export function Account({ my }: { my: boolean }) {
  const { status, me } = useAccount();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(ACCOUNT_EVENT, show);
    return () => window.removeEventListener(ACCOUNT_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);

  if (status === "off") return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = mode === "in" ? await signIn(login, password) : await signUp(login, password, name);
    setBusy(false);
    if (err) setError(err);
    else {
      setPassword("");
      setOpen(false);
    }
  };

  const until = me?.member_until ? new Date(me.member_until * 1000).toLocaleDateString() : null;

  return (
    <>
      <button
        type="button"
        className="acct"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={status === "in" && me ? me.name : my ? "ဝင်မည်" : "Sign in"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="acct__icon">
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {status === "in" && me ? (
          <>
            <span className="acct__dot" data-member={me.member || undefined} aria-hidden="true" />
            <span className="acct__name acct__label">{me.name}</span>
          </>
        ) : (
          <span className={`acct__label ${my ? "my" : ""}`}>{my ? "ဝင်မည်" : "Sign in"}</span>
        )}
      </button>

      {open ? (
        <div className="acct-sheet" role="dialog" aria-modal="true" aria-label={my ? "အကောင့်" : "Account"} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="acct-sheet__card">
            {status === "in" && me ? (
              <div className="acct-me">
                <p className="t-micro">{my ? "အကောင့်" : "Account"}</p>
                <h2 className="t-h3">{me.name}</h2>
                <p className="t-small acct-me__login">{me.login}</p>
                <p className={`acct-me__tier ${my ? "my" : "t-small"}`} data-member={me.member || undefined}>
                  {me.member
                    ? my
                      ? `Premium member${until ? ` — ${until} အထိ` : ""}`
                      : `Premium member${until ? ` until ${until}` : ""}`
                    : my
                      ? "Member မဟုတ်သေးပါ — prompt tool တွေ အကုန် အခမဲ့၊ ပုံထုတ်တာက member အတွက်"
                      : "Not a member yet — every prompt tool is free; making photographs is for members"}
                </p>
                <button type="button" className="btn btn--quiet" onClick={() => void signOut().then(() => setOpen(false))}>
                  {my ? "ထွက်မည်" : "Sign out"}
                </button>
              </div>
            ) : firebaseOn() ? (
              <FirebaseSignIn my={my} onDone={() => setOpen(false)} />
            ) : (
              <form className="acct-form" onSubmit={submit}>
                <div className="seg acct-form__mode" role="tablist">
                  <button type="button" aria-pressed={mode === "in"} onClick={() => setMode("in")}>
                    {my ? "ဝင်မည်" : "Sign in"}
                  </button>
                  <button type="button" aria-pressed={mode === "up"} onClick={() => setMode("up")}>
                    {my ? "အကောင့်သစ်" : "New account"}
                  </button>
                </div>
                {mode === "up" ? (
                  <label className="afield">
                    <span className={`afield__label ${my ? "my" : "t-micro"}`}>{my ? "အမည်" : "Name"}</span>
                    <input className="field my" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                  </label>
                ) : null}
                <label className="afield">
                  <span className={`afield__label ${my ? "my" : "t-micro"}`}>{my ? "ဖုန်းနံပါတ် (သို့) email" : "Phone number or email"}</span>
                  <input className="field" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" inputMode="email" required />
                </label>
                <label className="afield">
                  <span className={`afield__label ${my ? "my" : "t-micro"}`}>{my ? "စကားဝှက် (အနည်းဆုံး ၈ လုံး)" : "Password (8 or more)"}</span>
                  <input
                    className="field"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "in" ? "current-password" : "new-password"}
                    minLength={8}
                    required
                  />
                </label>
                {error ? (
                  <p className="acct-form__err t-small" role="alert">
                    {error}
                  </p>
                ) : null}
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? "…" : mode === "in" ? (my ? "ဝင်မည်" : "Sign in") : my ? "အကောင့် ဖွင့်မည်" : "Create account"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

/* -- Firebase: Google, a phone and a one-time code, or an email --------- */

function FirebaseSignIn({ my, onDone }: { my: boolean; onDone: () => void }) {
  const [way, setWay] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<ConfirmationResult | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sendBtn = useRef<HTMLButtonElement>(null);

  /* Firebase has proved who this is; the server makes it a SHOW session */
  const finish = async (u: FirebaseUser) => {
    const err = await signInWithFirebase(await u.getIdToken(), name || u.displayName || "");
    if (err) setError(err);
    else onDone();
  };

  const run = async (what: string, f: () => Promise<void>) => {
    setBusy(what);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(explain(e, my));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="acct-form">
      <p className="t-micro acct-form__kicker">{my ? "SHOW ကို ဝင်မယ်" : "Sign in to SHOW"}</p>

      <button type="button" className="acct-google" onClick={() => void run("google", async () => finish(await withGoogle()))} disabled={!!busy}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.2 6.6l4.1 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
        </svg>
        <span>{busy === "google" ? "…" : my ? "Google နဲ့ ဝင်မည်" : "Continue with Google"}</span>
      </button>

      <div className="acct-or t-micro">
        <span>{my ? "သို့မဟုတ်" : "or"}</span>
      </div>

      <div className="seg acct-form__mode" role="tablist">
        <button type="button" aria-pressed={way === "phone"} onClick={() => setWay("phone")}>
          {my ? "ဖုန်း" : "Phone"}
        </button>
        <button type="button" aria-pressed={way === "email"} onClick={() => setWay("email")}>
          Email
        </button>
      </div>

      <label className="afield">
        <span className={`afield__label ${my ? "my" : "t-micro"}`}>{my ? "အမည် (ပထမဆုံးအကြိမ်အတွက်)" : "Your name (first time only)"}</span>
        <input className="field my" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>

      {way === "phone" ? (
        sent ? (
          <form
            className="acct-form__step"
            onSubmit={(e) => {
              e.preventDefault();
              void run("code", async () => finish((await sent.confirm(code.trim())).user));
            }}
          >
            <label className="afield">
              <span className={`afield__label ${my ? "my" : "t-micro"}`}>{my ? "SMS နဲ့ ရောက်လာတဲ့ code" : "The code from the SMS"}</span>
              <input
                className="field acct-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </label>
            <button type="submit" className="btn" disabled={!!busy || code.length < 6}>
              {busy === "code" ? "…" : my ? "အတည်ပြုမည်" : "Confirm"}
            </button>
            <button type="button" className="lib__act" onClick={() => setSent(null)}>
              {my ? "နံပါတ် ပြောင်းမည်" : "Use another number"}
            </button>
          </form>
        ) : (
          <form
            className="acct-form__step"
            onSubmit={(e) => {
              e.preventDefault();
              void run("send", async () => setSent(await sendCode(phone, sendBtn.current!)));
            }}
          >
            <label className="afield">
              <span className={`afield__label ${my ? "my" : "t-micro"}`}>{my ? "ဖုန်းနံပါတ်" : "Phone number"}</span>
              <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09 7xx xxx xxx" inputMode="tel" autoComplete="tel" required />
            </label>
            <button ref={sendBtn} type="submit" className="btn" disabled={!!busy || phone.replace(/\D/g, "").length < 8}>
              {busy === "send" ? "…" : my ? "Code ပို့မည်" : "Send code"}
            </button>
          </form>
        )
      ) : (
        <form
          className="acct-form__step"
          onSubmit={(e) => {
            e.preventDefault();
            void run("email", async () => finish(await withEmail(email, password, create)));
          }}
        >
          <label className="afield">
            <span className="afield__label t-micro">Email</span>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="afield">
            <span className={`afield__label ${my ? "my" : "t-micro"}`}>{my ? "စကားဝှက်" : "Password"}</span>
            <input
              className="field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={create ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>
          <button type="submit" className="btn" disabled={!!busy}>
            {busy === "email" ? "…" : create ? (my ? "အကောင့် ဖွင့်မည်" : "Create account") : my ? "ဝင်မည်" : "Sign in"}
          </button>
          <button type="button" className="lib__act" onClick={() => setCreate((v) => !v)}>
            {create ? (my ? "အကောင့်ရှိပြီးသား — ဝင်မယ်" : "Have an account? Sign in") : my ? "အကောင့်အသစ် ဖွင့်မယ်" : "New here? Create an account"}
          </button>
        </form>
      )}

      {error ? (
        <p className={`acct-form__err ${my ? "my" : "t-small"}`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
