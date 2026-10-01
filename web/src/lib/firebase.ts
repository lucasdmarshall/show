"use client";

/* ------------------------------------------------------------------
   Firebase Auth — how people sign in when it is configured: Google,
   a phone number with a one-time code, or an email. Firebase proves
   who they are; SHOW's server turns that proof into its own session.

   The SDK is loaded only when the sign-in sheet needs it, so nobody
   pays for it on a page they only browse.
   ------------------------------------------------------------------ */

import type { Auth, ConfirmationResult, User as FirebaseUser } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const firebaseOn = () => !!(config.apiKey && config.projectId);

let auth: Promise<Auth> | null = null;

export function getAuthLazy(): Promise<Auth> {
  auth ??= (async () => {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getAuth, useDeviceLanguage } = await import("firebase/auth");
    const app = getApps()[0] ?? initializeApp(config);
    const a = getAuth(app);
    useDeviceLanguage(a);
    return a;
  })();
  return auth;
}

/** 09xxxxxxxxx (how Myanmar writes it) → +959xxxxxxxxx (how Firebase wants it). */
export function toE164(raw: string): string {
  const s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("959")) return `+${s}`;
  if (s.startsWith("09")) return `+95${s.slice(1)}`;
  if (s.startsWith("9") && s.length >= 8) return `+95${s}`;
  return `+${s}`;
}

export async function withGoogle(): Promise<FirebaseUser> {
  const a = await getAuthLazy();
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  return (await signInWithPopup(a, new GoogleAuthProvider())).user;
}

export async function withEmail(email: string, password: string, create: boolean): Promise<FirebaseUser> {
  const a = await getAuthLazy();
  const m = await import("firebase/auth");
  const r = create
    ? await m.createUserWithEmailAndPassword(a, email.trim(), password)
    : await m.signInWithEmailAndPassword(a, email.trim(), password);
  return r.user;
}

/** Sends the code. `button` is the element the invisible reCAPTCHA sits on. */
export async function sendCode(phone: string, button: HTMLElement): Promise<ConfirmationResult> {
  const a = await getAuthLazy();
  const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
  const verifier = new RecaptchaVerifier(a, button, { size: "invisible" });
  try {
    return await signInWithPhoneNumber(a, toE164(phone), verifier);
  } catch (e) {
    verifier.clear();
    throw e;
  }
}

export async function firebaseSignOut() {
  if (!firebaseOn() || !auth) return;
  const { signOut } = await import("firebase/auth");
  await signOut(await auth);
}

/** Firebase's error codes, said plainly. */
export function explain(e: unknown, my: boolean): string {
  const code = (e as { code?: string })?.code ?? "";
  const t: Record<string, [string, string]> = {
    "auth/invalid-credential": ["That email and password do not match.", "Email နဲ့ password မကိုက်ပါ။"],
    "auth/wrong-password": ["That email and password do not match.", "Email နဲ့ password မကိုက်ပါ။"],
    "auth/user-not-found": ["No account with that email — create one instead.", "ဒီ email နဲ့ အကောင့် မရှိပါ — အသစ်ဖွင့်ပါ။"],
    "auth/email-already-in-use": ["That email already has an account — sign in instead.", "ဒီ email နဲ့ အကောင့်ရှိပြီး — ဝင်ပါ။"],
    "auth/weak-password": ["Use at least 6 characters.", "အနည်းဆုံး ၆ လုံး သုံးပါ။"],
    "auth/invalid-email": ["That email does not look right.", "Email ပုံစံ မမှန်ပါ။"],
    "auth/invalid-phone-number": ["That phone number does not look right — try 09…", "ဖုန်းနံပါတ် မမှန်ပါ — 09… နဲ့ ရိုက်ပါ။"],
    "auth/invalid-verification-code": ["That code is not right.", "Code မမှန်ပါ။"],
    "auth/code-expired": ["That code has expired — send a new one.", "Code သက်တမ်းကုန်ပြီ — အသစ်ပို့ပါ။"],
    "auth/too-many-requests": ["Too many tries — wait a little and try again.", "အကြိမ်များလွန်းလို့ — ခဏနေမှ ထပ်စမ်းပါ။"],
    "auth/popup-closed-by-user": ["The Google window was closed.", "Google window ကို ပိတ်လိုက်တယ်။"],
    "auth/popup-blocked": ["The browser blocked the Google window — allow pop-ups.", "Browser က Google window ကို ပိတ်ထားတယ် — pop-up ခွင့်ပြုပါ။"],
    "auth/operation-not-allowed": [
      "This way of signing in is not switched on in Firebase yet.",
      "ဒီနည်းနဲ့ ဝင်တာကို Firebase မှာ မဖွင့်ရသေးပါ။",
    ],
    "auth/unauthorized-domain": ["This address is not authorised in Firebase.", "ဒီလိပ်စာကို Firebase မှာ ခွင့်မပြုရသေးပါ။"],
    "auth/network-request-failed": ["No connection — check the internet.", "Internet မရပါ။"],
  };
  const hit = t[code];
  return hit ? (my ? hit[1] : hit[0]) : (e as Error)?.message || (my ? "မအောင်မြင်ပါ" : "That did not work");
}
